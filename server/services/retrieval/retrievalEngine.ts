/**
 * Semantic Retrieval & RAG Engine (Phase 8B)
 * 
 * Provides hybrid semantic and deterministic evidence retrieval over the
 * EvidenceRepository with point-in-time correctness, conflict preservation,
 * epistemic weighting, source diversity, and provenance tracing.
 */

import {
  EvidenceItem,
  EvidenceChunk,
  EvidenceQuery,
  EvidenceMatch,
  MatchSignal,
  RetrievalResult,
  RetrievalTrace,
  RetrievalMode,
  RetrievalConflict,
  EmbeddingStatus,
  IRetrievalEngine,
  IEvidenceRepository,
  SecurityIdentifier,
  EvidenceEpistemicStatus
} from '../../../src/types';
import { evidenceService } from '../evidence/evidenceService';
import { generateConceptKey } from '../evidence/evidenceRepository';
import { chunkEvidenceItem } from './chunking';
import {
  IEmbeddingProvider,
  getEmbeddingProvider,
  cosineSimilarity
} from './embeddingProvider';
import { extractSecuritiesFromText } from '../../../src/services/searchIntelligence';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';

export interface RetrievalEngineOptions {
  repository?: IEvidenceRepository;
  embeddingProvider?: IEmbeddingProvider;
  defaultLimit?: number;
  maxChunksPerItem?: number;
}

export class RetrievalEngine implements IRetrievalEngine {
  private repository: IEvidenceRepository;
  private embeddingProvider: IEmbeddingProvider;
  private readonly defaultLimit: number;
  private readonly maxChunksPerItem: number;

  // In-memory query result cache for identical inquiries within session
  private readonly queryCache: Map<string, { result: RetrievalResult; timestamp: number }> = new Map();
  private readonly cacheTtlMs: number = 60 * 1000; // 1 minute
  private readonly maxCacheEntries: number = 200;

  constructor(optionsOrRepo?: RetrievalEngineOptions | IEvidenceRepository, embeddingProvider?: IEmbeddingProvider) {
    if (optionsOrRepo && 'queryEvidence' in optionsOrRepo) {
      this.repository = optionsOrRepo;
      this.embeddingProvider = embeddingProvider || getEmbeddingProvider();
      this.defaultLimit = 10;
      this.maxChunksPerItem = 2;
    } else {
      const options = optionsOrRepo as RetrievalEngineOptions | undefined;
      this.repository = options?.repository || evidenceService.getRepository();
      this.embeddingProvider = options?.embeddingProvider || embeddingProvider || getEmbeddingProvider();
      this.defaultLimit = options?.defaultLimit ?? 10;
      this.maxChunksPerItem = options?.maxChunksPerItem ?? 2;
    }
  }

  public getRepository(): IEvidenceRepository {
    return this.repository;
  }

  public getCacheSize(): number {
    return this.queryCache.size;
  }

  public setRepository(repo: IEvidenceRepository): void {
    this.repository = repo;
    this.clearCache();
  }

  public setEmbeddingProvider(provider: IEmbeddingProvider): void {
    this.embeddingProvider = provider;
    this.clearCache();
  }

  public getEmbeddingStatus(): EmbeddingStatus {
    return this.embeddingProvider.getStatus();
  }

  public clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Primary retrieval entrypoint.
   */
  public async retrieve(query: EvidenceQuery): Promise<RetrievalResult> {
    const startTime = Date.now();
    const rawQuery = (query.query || '').trim();

    // Generate deterministic cache key
    const cacheKey = JSON.stringify({
      q: rawQuery.toLowerCase(),
      secId: query.securityId,
      secIds: query.securityIds?.slice().sort(),
      src: query.sourceType,
      docType: query.documentType,
      asOf: query.asOfDate ? new Date(query.asOfDate).toISOString() : undefined,
      limit: query.limit,
      userId: query.userId
    });

    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return cached.result;
    }

    // Guard for empty/whitespace-only query with no filters
    const hasAnyFilter = !!(query.securityId || (query.securityIds && query.securityIds.length > 0) || query.sourceType || query.documentType || query.epistemicStatus);
    if (!rawQuery && !hasAnyFilter) {
      const activeMode: RetrievalMode = this.embeddingProvider.getStatus().status === 'ACTIVE' ? 'SEMANTIC' : 'DETERMINISTIC_FALLBACK';
      return {
        query: rawQuery,
        retrievalMode: activeMode,
        matches: [],
        evidenceBundle: [],
        chunks: [],
        totalCandidates: 0,
        retrievalTrace: {
          normalizedQuery: '',
          detectedSecurities: [],
          appliedFilters: {},
          totalRepositoryItems: this.repository.count(),
          candidatesAfterMetadataFilter: 0,
          candidatesAfterPointInTime: 0,
          retrievalMode: activeMode,
          scoringDetails: [],
          diversityApplied: false,
          executionTimeMs: Date.now() - startTime
        },
        conflicts: [],
        embeddingStatus: this.embeddingProvider.getStatus()
      };
    }

    // 1. Query normalization & security entity resolution
    const normalizedQuery = rawQuery.toLowerCase();
    const queryTokens = normalizedQuery
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);

    const explicitSecurities: string[] = [];
    if (query.securityId) explicitSecurities.push(query.securityId);
    if (Array.isArray(query.securityIds)) explicitSecurities.push(...query.securityIds);

    const extractedSecurities = extractSecuritiesFromText(rawQuery).flatMap(s => [s.id, s.symbol, (s as any).ticker].filter(Boolean) as string[]);
    const rawTargetSecurityIds = Array.from(new Set([...explicitSecurities, ...extractedSecurities]));
    const targetSecurityIds: string[] = [];
    for (const sec of rawTargetSecurityIds) {
      const lower = sec.toLowerCase();
      targetSecurityIds.push(lower);
      if (lower.startsWith('sec-')) {
        targetSecurityIds.push(lower.replace(/^sec-/, ''));
      } else {
        targetSecurityIds.push(`sec-${lower}`);
      }
    }

    // 2. Fetch candidates from repository with point-in-time and metadata filtering
    const totalRepositoryItems = this.repository.count();

    const asOfTime = query.asOfDate ? new Date(query.asOfDate).getTime() : undefined;
    let candidates: EvidenceItem[] = [];

    if (asOfTime && !isNaN(asOfTime)) {
      candidates = this.repository.getEvidenceAvailableAsOf(query.asOfDate!);
    } else {
      candidates = this.repository.getAll();
    }

    const candidatesAfterPointInTime = candidates.length;

    // Apply metadata filters (security, source, provider, epistemic status, etc.)
    if (targetSecurityIds.length > 0) {
      const lowerSecs = targetSecurityIds.map(s => s.toLowerCase());
      candidates = candidates.filter(item => {
        const itemSec = (item.securityId || '').toLowerCase();
        const itemSym = (item.sourceReference?.symbol || '').toLowerCase();
        return lowerSecs.includes(itemSec) || lowerSecs.includes(itemSym);
      });
    }

    if (query.sourceType) {
      const sources = Array.isArray(query.sourceType) ? query.sourceType : [query.sourceType];
      candidates = candidates.filter(item => sources.includes(item.sourceType));
    }

    if (query.documentType) {
      const normDoc = query.documentType.toLowerCase();
      candidates = candidates.filter(item => (item.documentType || '').toLowerCase() === normDoc);
    }

    if (query.epistemicStatus) {
      const statuses = Array.isArray(query.epistemicStatus) ? query.epistemicStatus : [query.epistemicStatus];
      candidates = candidates.filter(item => statuses.includes(item.epistemicStatus));
    }

    if (query.startDate) {
      const startMs = new Date(query.startDate).getTime();
      if (!isNaN(startMs)) {
        candidates = candidates.filter(item => new Date(item.publishedAt).getTime() >= startMs);
      }
    }

    if (query.endDate) {
      const endMs = new Date(query.endDate).getTime();
      if (!isNaN(endMs)) {
        candidates = candidates.filter(item => new Date(item.publishedAt).getTime() <= endMs);
      }
    }

    // User data isolation: public evidence items (no ownerUserId) are accessible to all,
    // while user-owned evidence items are only visible to their respective owner.
    if (query.userId) {
      candidates = candidates.filter(item => {
        const itemOwner = item.ownerUserId || (item as any).userId;
        return !itemOwner || itemOwner === query.userId;
      });
    } else {
      // If query does not specify a userId, only public evidence is retrieved
      candidates = candidates.filter(item => {
        const itemOwner = item.ownerUserId || (item as any).userId;
        return !itemOwner;
      });
    }

    const candidatesAfterMetadataFilter = candidates.length;

    // 3. Detect and collect conflicts
    const conflicts: RetrievalConflict[] = [];
    const candidatesByConcept = new Map<string, EvidenceItem[]>();
    for (const item of candidates) {
      const cKey = generateConceptKey(item);
      const group = candidatesByConcept.get(cKey) || [];
      group.push(item);
      candidatesByConcept.set(cKey, group);
    }

    for (const [conceptKey, items] of candidatesByConcept.entries()) {
      if (items.length > 1) {
        // Multiple items for the same concept key: detect conflicts
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const item1 = items[i];
            const item2 = items[j];
            const hasStatusDiff = item1.epistemicStatus !== item2.epistemicStatus;
            const hasProviderDiff = item1.provider !== item2.provider;
            const hasValDiff = JSON.stringify(item1.structuredValue) !== JSON.stringify(item2.structuredValue);

            if (hasStatusDiff || hasProviderDiff || hasValDiff || item1.hasConflict || item2.hasConflict) {
              conflicts.push({
                evidenceId1: item1.evidenceId,
                evidenceId2: item2.evidenceId,
                provider1: item1.provider,
                provider2: item2.provider,
                details: `Preserved conflict on [${conceptKey}]: ${item1.provider} (${item1.epistemicStatus}) vs ${item2.provider} (${item2.epistemicStatus})`
              });
            }
          }
        }
      }
    }

    // 4. Chunk candidate items
    const allChunks: EvidenceChunk[] = [];
    const itemByEvidenceId = new Map<string, EvidenceItem>();
    for (const item of candidates) {
      itemByEvidenceId.set(item.evidenceId, item);
      const chunks = chunkEvidenceItem(item);
      allChunks.push(...chunks);
    }

    // 5. Embedding & Semantic Search Setup
    const embeddingStatus = this.embeddingProvider.getStatus();
    let queryVector: number[] | null = null;
    let retrievalMode: RetrievalMode = 'DETERMINISTIC_FALLBACK';

    if (embeddingStatus.configured && embeddingStatus.status === 'ACTIVE' && rawQuery) {
      try {
        queryVector = await this.embeddingProvider.embedText(rawQuery);
        if (queryVector && queryVector.length > 0) {
          retrievalMode = 'SEMANTIC';
        }
      } catch {
        queryVector = null;
        retrievalMode = 'DETERMINISTIC_FALLBACK';
      }
    }

    // Embed candidate chunks if in SEMANTIC mode
    const chunkVectors = new Map<string, number[]>();
    if (retrievalMode === 'SEMANTIC' && queryVector) {
      for (const chunk of allChunks) {
        const textToEmbed = `${chunk.title}: ${chunk.content}`;
        const vec = await this.embeddingProvider.embedText(textToEmbed);
        if (vec) {
          chunkVectors.set(chunk.chunkId, vec);
        }
      }
    }

    // 6. Score each chunk / item
    const scoredMatches: EvidenceMatch[] = [];

    for (const chunk of allChunks) {
      const parentItem = itemByEvidenceId.get(chunk.evidenceId);
      if (!parentItem) continue;

      const signals: MatchSignal[] = [];
      let deterministicScore = 0;

      // Signal 1: Security Match
      const chunkSec = (chunk.securityId || '').toLowerCase();
      const chunkSym = (chunk.sourceReference?.symbol || '').toLowerCase();
      const isTargetSec = targetSecurityIds.some(
        s => s.toLowerCase() === chunkSec || s.toLowerCase() === chunkSym
      );

      if (isTargetSec) {
        deterministicScore += 0.35;
        signals.push({
          signal: 'SECURITY_MATCH',
          weight: 0.35,
          description: `Target security match (${chunk.securityId || chunk.sourceReference?.symbol})`
        });
      }

      // Signal 2: Company Name / Canonical Metadata Match
      const resolved = targetSecurityIds.length > 0 ? resolveSecurity(targetSecurityIds[0]) : null;
      if (resolved?.companyName) {
        const companyTokens = resolved.companyName.toLowerCase().split(/\s+/);
        const hasCompanyWord = companyTokens.some(w => w.length > 2 && normalizedQuery.includes(w));
        if (hasCompanyWord) {
          deterministicScore += 0.15;
          signals.push({
            signal: 'COMPANY_NAME_MATCH',
            weight: 0.15,
            description: `Query mentions company name (${resolved.companyName})`
          });
        }
      }

      // Signal 3: Lexical / Token Overlap with Title & Content
      const chunkText = `${chunk.title} ${chunk.content} ${(chunk.sourceReference?.concept || '')}`.toLowerCase();
      let matchedTokenCount = 0;
      for (const token of queryTokens) {
        if (chunkText.includes(token)) {
          matchedTokenCount++;
        }
      }

      if (queryTokens.length > 0 && matchedTokenCount > 0) {
        const overlapRatio = matchedTokenCount / queryTokens.length;
        const lexicalScore = Math.min(0.30, overlapRatio * 0.30);
        deterministicScore += lexicalScore;
        signals.push({
          signal: 'LEXICAL_OVERLAP',
          weight: lexicalScore,
          description: `Matched ${matchedTokenCount}/${queryTokens.length} query tokens`
        });
      }

      // Signal 4: Financial Concept Alignment
      const conceptWords = ['revenue', 'income', 'profit', 'margin', 'debt', 'cash', 'capex', 'asset', 'fcf', 'quote', 'price', 'filing', '10-k', '10-q'];
      for (const cw of conceptWords) {
        if (normalizedQuery.includes(cw) && chunkText.includes(cw)) {
          deterministicScore += 0.10;
          signals.push({
            signal: 'FINANCIAL_CONCEPT_MATCH',
            weight: 0.10,
            description: `Shared financial concept '${cw}'`
          });
          break;
        }
      }

      // Signal 5: Recency Boost (within valid point-in-time window)
      const pubMs = new Date(chunk.publishedAt).getTime();
      if (!isNaN(pubMs)) {
        // Boost up to 0.05 for items published in recent past relative to asOfTime or now
        const refTime = asOfTime || Date.now();
        const daysAgo = Math.max(0, (refTime - pubMs) / (1000 * 60 * 60 * 24));
        const recencyBonus = Math.max(0, 0.05 * (1 - daysAgo / 365));
        if (recencyBonus > 0) {
          deterministicScore += recencyBonus;
          signals.push({
            signal: 'RECENCY_BOOST',
            weight: recencyBonus,
            description: `Published ${daysAgo.toFixed(0)} days before observation point`
          });
        }
      }

      // Semantic Score
      let semanticScore: number | undefined = undefined;
      if (retrievalMode === 'SEMANTIC' && queryVector) {
        const chunkVec = chunkVectors.get(chunk.chunkId);
        if (chunkVec) {
          const sim = cosineSimilarity(queryVector, chunkVec);
          semanticScore = Math.max(0, sim);
          signals.push({
            signal: 'SEMANTIC_SIMILARITY',
            weight: semanticScore,
            description: `Vector cosine similarity: ${(semanticScore * 100).toFixed(1)}%`
          });
        }
      }

      // Signal 6: EPISTEMIC STATUS WEIGHTING (CRITICAL RULE)
      // REAL facts have normal/preferred status.
      // SIMULATED data receives a deterministic penalty so it NEVER outranks REAL evidence.
      let epistemicMultiplier = 1.0;
      if (chunk.epistemicStatus === 'REAL') {
        epistemicMultiplier = 1.0;
        signals.push({
          signal: 'EPISTEMIC_REAL',
          weight: 0.0,
          description: 'Verified real-world provenance'
        });
      } else if (chunk.epistemicStatus === 'CALCULATED') {
        epistemicMultiplier = 0.95;
      } else if (chunk.epistemicStatus === 'SIMULATED') {
        epistemicMultiplier = 0.65;
        signals.push({
          signal: 'EPISTEMIC_PENALTY_SIMULATED',
          weight: -0.35,
          description: 'Simulated fallback data down-ranked relative to verified facts'
        });
      } else if (chunk.epistemicStatus === 'UNAVAILABLE' || chunk.epistemicStatus === 'ERROR') {
        epistemicMultiplier = 0.40;
        signals.push({
          signal: 'EPISTEMIC_PENALTY_UNAVAILABLE',
          weight: -0.60,
          description: 'Unavailable/Error status down-ranked'
        });
      }

      // Signal 7: Preserved Conflict Boost
      // If this item is part of a detected conflict, boost so both perspectives are presented to synthesis
      if (chunk.hasConflict || conflicts.some(c => c.evidenceId1 === chunk.evidenceId || c.evidenceId2 === chunk.evidenceId)) {
        deterministicScore += 0.15;
        signals.push({
          signal: 'CONFLICT_PRESERVATION',
          weight: 0.15,
          description: 'Preserved conflicting data surfaced for balanced synthesis'
        });
      }

      // Compute final combined score
      let combinedScore = 0;
      if (retrievalMode === 'SEMANTIC' && typeof semanticScore === 'number') {
        combinedScore = (0.55 * semanticScore + 0.45 * deterministicScore) * epistemicMultiplier;
      } else {
        combinedScore = deterministicScore * epistemicMultiplier;
      }

      // Normalization clamp 0..1
      combinedScore = Math.max(0, Math.min(1.0, combinedScore));

      const minScore = query.minRelevanceScore ?? 0.05;
      if (combinedScore >= minScore || isTargetSec) {
        scoredMatches.push({
          evidence: parentItem,
          chunk,
          score: combinedScore,
          semanticScore,
          deterministicScore,
          matchSignals: signals,
          retrievalReason: signals.map(s => s.description).join('; ')
        });
      }
    }

    // 7. Sort matches deterministically
    scoredMatches.sort((a, b) => {
      // Primary: Score descending
      if (Math.abs(b.score - a.score) > 0.001) {
        return b.score - a.score;
      }
      // Epistemic priority: REAL before SIMULATED
      if (a.evidence.epistemicStatus === 'REAL' && b.evidence.epistemicStatus !== 'REAL') return -1;
      if (b.evidence.epistemicStatus === 'REAL' && a.evidence.epistemicStatus !== 'REAL') return 1;
      // Secondary: Publication time descending (more recent first)
      const timeA = new Date(a.evidence.publishedAt).getTime() || 0;
      const timeB = new Date(b.evidence.publishedAt).getTime() || 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      // Deterministic tie-breaker: evidenceId
      return a.evidence.evidenceId.localeCompare(b.evidence.evidenceId);
    });

    // 8. Enforce source diversity and retrieval budget
    const targetLimit = query.limit ?? this.defaultLimit;
    const finalMatches: EvidenceMatch[] = [];
    const selectedEvidenceIds = new Set<string>();
    const chunkCountPerItem = new Map<string, number>();
    const selectedSourceTypes = new Set<string>();

    // Pass 1: Select top distinct sources and ensure diverse representation
    for (const match of scoredMatches) {
      const evId = match.evidence.evidenceId;
      const currentChunksForItem = chunkCountPerItem.get(evId) || 0;

      if (currentChunksForItem >= this.maxChunksPerItem) {
        continue;
      }

      // Check if we reached the limit of distinct evidence items
      if (!selectedEvidenceIds.has(evId) && selectedEvidenceIds.size >= targetLimit) {
        // If it's a conflict item that we haven't included yet, make an exception to preserve both sides
        const isUnincludedConflict = conflicts.some(
          c => (c.evidenceId1 === evId && selectedEvidenceIds.has(c.evidenceId2)) ||
               (c.evidenceId2 === evId && selectedEvidenceIds.has(c.evidenceId1))
        );
        if (!isUnincludedConflict) {
          continue;
        }
      }

      finalMatches.push(match);
      selectedEvidenceIds.add(evId);
      chunkCountPerItem.set(evId, currentChunksForItem + 1);
      selectedSourceTypes.add(match.evidence.sourceType);
    }

    // Build bounded distinct evidence bundle
    const evidenceBundle: EvidenceItem[] = [];
    const bundledIds = new Set<string>();
    for (const m of finalMatches) {
      if (!bundledIds.has(m.evidence.evidenceId)) {
        bundledIds.add(m.evidence.evidenceId);
        evidenceBundle.push(m.evidence);
      }
    }

    // Ensure all conflicting pairs are present in the evidenceBundle
    for (const conflict of conflicts) {
      const hasItem1 = bundledIds.has(conflict.evidenceId1);
      const hasItem2 = bundledIds.has(conflict.evidenceId2);
      if (hasItem1 && !hasItem2) {
        const item2 = this.repository.getEvidence(conflict.evidenceId2);
        if (item2) {
          bundledIds.add(item2.evidenceId);
          evidenceBundle.push(item2);
        }
      } else if (hasItem2 && !hasItem1) {
        const item1 = this.repository.getEvidence(conflict.evidenceId1);
        if (item1) {
          bundledIds.add(item1.evidenceId);
          evidenceBundle.push(item1);
        }
      }
    }

    const executionTimeMs = Date.now() - startTime;

    // Build retrieval trace for auditability
    const retrievalTrace: RetrievalTrace = {
      normalizedQuery,
      detectedSecurities: targetSecurityIds,
      appliedFilters: {
        securityId: query.securityId,
        securityIds: query.securityIds,
        sourceType: query.sourceType,
        documentType: query.documentType,
        epistemicStatus: query.epistemicStatus,
        startDate: query.startDate,
        endDate: query.endDate,
        asOfDate: query.asOfDate,
        limit: targetLimit
      },
      asOfDate: query.asOfDate ? new Date(query.asOfDate).toISOString() : undefined,
      totalRepositoryItems,
      candidatesAfterMetadataFilter,
      candidatesAfterPointInTime,
      retrievalMode,
      scoringDetails: finalMatches.slice(0, 10).map(m => ({
        evidenceId: m.evidence.evidenceId,
        title: m.evidence.title,
        score: parseFloat(m.score.toFixed(4)),
        signals: m.matchSignals.map(s => s.signal),
        epistemicStatus: m.evidence.epistemicStatus
      })),
      diversityApplied: selectedSourceTypes.size > 1,
      executionTimeMs
    };

    const result: RetrievalResult = {
      query: rawQuery,
      retrievalMode,
      matches: finalMatches,
      evidenceBundle,
      chunks: finalMatches.map(m => m.chunk!).filter(Boolean),
      totalCandidates: candidates.length,
      retrievalTrace,
      conflicts,
      embeddingStatus
    };

    // Store in query cache
    if (this.queryCache.size >= this.maxCacheEntries) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) this.queryCache.delete(oldestKey);
    }
    this.queryCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }
}

// Global default instance singleton
export const retrievalEngine = new RetrievalEngine();
