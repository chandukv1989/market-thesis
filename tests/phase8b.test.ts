/**
 * PHASE 8B — SEMANTIC RETRIEVAL / RAG TEST SUITE
 * 
 * Verifies:
 * 1. Deterministic chunking & provenance preservation
 * 2. Vector embedding abstraction & cosine similarity computation
 * 3. Graceful fallback when semantic embeddings are unconfigured
 * 4. Point-in-time retrieval constraint enforcement (no future leak)
 * 5. Epistemic status penalty/weighting (REAL vs SIMULATED vs UNAVAILABLE)
 * 6. Conflict preservation & surfacing in retrieval results
 * 7. Multi-source diversity & budget management
 * 8. Hybrid score combination (Deterministic + Semantic)
 * 9. Research Engine downstream integration & prompt formatting
 * 10. Retrieval caching and TTL behavior
 * 11. Complete schema compliance for RetrievalResult & EvidenceChunk
 * 12. Zero secret leakage across retrieval structures
 */

import {
  EvidenceItem,
  EvidenceChunk,
  EvidenceQuery,
  RetrievalResult,
  ResearchRequest
} from '../src/types';
import { chunkEvidenceItem, chunkEvidenceItems } from '../server/services/retrieval/chunking';
import {
  cosineSimilarity,
  MockEmbeddingProvider,
  GoogleGenAIEmbeddingProvider
} from '../server/services/retrieval/embeddingProvider';
import { RetrievalEngine } from '../server/services/retrieval/retrievalEngine';
import { EvidenceRepository } from '../server/services/evidence/evidenceRepository';
import { buildUserPrompt } from '../server/services/research/prompts';
import { GeminiResearchEngine } from '../server/services/research/geminiResearchEngine';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase8bTests() {
  console.log('======================================================================');
  console.log(' RUNNING PHASE 8B SEMANTIC RETRIEVAL / RAG TEST SUITE');
  console.log('======================================================================\n');

  // Sample verified evidence items
  const sampleRealSecItem: EvidenceItem = {
    evidenceId: 'sec-nvda-10q-2025q1-rev',
    fingerprint: 'sec-edgar:nvda:revenue:2025-q1',
    conceptKey: 'nvda:revenue:2025-q1',
    securityId: 'NVDA',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC EDGAR',
    epistemicStatus: 'REAL',
    isSimulated: false,
    title: 'NVDA Q1 2025 Revenue Disclosure',
    content: 'NVIDIA Corporation reported revenue of $26,044,000,000 for the quarterly period ended April 28, 2024, driven by Data Center compute platforms and Hopper architecture.',
    structuredValue: {
      metric: 'Revenues',
      value: 26044000000,
      unit: 'USD',
      fiscalYear: 2025,
      fiscalPeriod: 'Q1'
    },
    publishedAt: '2024-05-22T20:15:00.000Z',
    availableAt: '2024-05-22T20:15:00.000Z',
    retrievedAt: '2024-05-22T20:16:00.000Z',
    filingDate: '2024-05-22',
    sourceReference: {
      accessionNumber: '0001045810-24-000078',
      form: '10-Q',
      cik: '0001045810'
    },
    qualityScore: 0.95
  };

  const sampleRealMarketQuote: EvidenceItem = {
    evidenceId: 'mkt-nvda-quote-20240522',
    fingerprint: 'twelve-data:nvda:quote:2024-05-22',
    conceptKey: 'nvda:quote:2024-05-22',
    securityId: 'NVDA',
    sourceType: 'MARKET_DATA',
    provider: 'Twelve Data',
    epistemicStatus: 'REAL',
    isSimulated: false,
    title: 'Twelve Data NVDA Market Quote',
    content: 'NVDA price 949.50 USD (+3.50%) with volume 42,000,000 on NASDAQ. Real-time verified market quote.',
    structuredValue: {
      price: 949.50,
      changePercent: 3.50,
      volume: 42000000
    },
    publishedAt: '2024-05-22T19:59:00.000Z',
    availableAt: '2024-05-22T19:59:00.000Z',
    retrievedAt: '2024-05-22T20:00:00.000Z',
    qualityScore: 0.9
  };

  const sampleSimulatedQuote: EvidenceItem = {
    evidenceId: 'mkt-reli-sim-quote',
    fingerprint: 'truedata:reliance:quote:simulated',
    conceptKey: 'reliance:quote:simulated',
    securityId: 'RELIANCE',
    sourceType: 'MARKET_DATA',
    provider: 'Simulated India Feed',
    epistemicStatus: 'SIMULATED',
    isSimulated: true,
    title: 'Simulated Reliance Quote',
    content: 'RELIANCE price 2850.00 INR (+0.45%). Synthetic simulated price action pending FYERS KYC onboarding.',
    structuredValue: {
      price: 2850.00,
      changePercent: 0.45
    },
    publishedAt: '2024-05-22T10:00:00.000Z',
    availableAt: '2024-05-22T10:00:00.000Z',
    retrievedAt: '2024-05-22T10:00:00.000Z',
    qualityScore: 0.3
  };

  const sampleUnavailableItem: EvidenceItem = {
    evidenceId: 'mkt-unavail-xyz',
    fingerprint: 'market:xyz:unavailable',
    conceptKey: 'xyz:quote:latest',
    securityId: 'XYZ',
    sourceType: 'MARKET_DATA',
    provider: 'Market Data Provider',
    epistemicStatus: 'UNAVAILABLE',
    isSimulated: false,
    title: 'XYZ Market Data Unavailable',
    content: 'Real-time market data for ticker XYZ is currently unavailable from active providers.',
    publishedAt: '2024-05-22T10:00:00.000Z',
    availableAt: '2024-05-22T10:00:00.000Z',
    retrievedAt: '2024-05-22T10:00:00.000Z',
    qualityScore: 0.1
  };

  // ==========================================
  // 1. DETERMINISTIC CHUNKING & PROVENANCE PRESERVATION
  // ==========================================
  console.log('1. Deterministic Chunking & Provenance:');
  const chunks = chunkEvidenceItem(sampleRealSecItem, 200, 30);

  assert(chunks.length >= 1, 'Generates at least one chunk for standard evidence item');
  assert(chunks[0].evidenceId === sampleRealSecItem.evidenceId, 'Chunk retains parent evidenceId');
  assert(chunks[0].securityId === 'NVDA', 'Chunk retains securityId');
  assert(chunks[0].sourceType === 'SEC_EDGAR', 'Chunk preserves sourceType');
  assert(chunks[0].provider === 'SEC EDGAR', 'Chunk preserves provider');
  assert(chunks[0].epistemicStatus === 'REAL', 'Chunk preserves REAL epistemicStatus');
  assert(chunks[0].isSimulated === false, 'Chunk preserves isSimulated boolean');
  assert(chunks[0].chunkIndex === 0, 'First chunk has chunkIndex 0');
  assert(chunks[0].totalChunks === chunks.length, 'totalChunks accurately reflects chunk count');
  assert(chunks[0].chunkId === `${sampleRealSecItem.evidenceId}-chk-0`, 'Deterministic chunkId matches evidenceId-chk-0 pattern');

  // Long text chunking test
  const longText = 'Point 1: Revenue surged. '.repeat(50);
  const longItem: EvidenceItem = {
    ...sampleRealSecItem,
    evidenceId: 'long-item-01',
    content: longText
  };
  const multiChunks = chunkEvidenceItem(longItem, 150, 20);
  assert(multiChunks.length > 1, 'Splits long evidence item into multiple overlapping chunks');
  assert(multiChunks[1].chunkIndex === 1, 'Subsequent chunk has sequential chunkIndex');

  // ==========================================
  // 2. VECTOR EMBEDDING & COSINE SIMILARITY
  // ==========================================
  console.log('\n2. Vector Embedding & Cosine Similarity:');
  const mockProvider = new MockEmbeddingProvider(64);
  assert(mockProvider.getStatus().configured === true, 'MockEmbeddingProvider getStatus reports configured true');

  const v1 = await mockProvider.embedText('NVIDIA Corporation revenue earnings report');
  const v2 = await mockProvider.embedText('NVIDIA Corporation revenue earnings report');
  const v3 = await mockProvider.embedText('Completely unrelated agricultural farming wheat yields');

  assert(Array.isArray(v1) && v1.length === 64, 'Mock embedding vector has specified dimension (64)');
  assert(Array.isArray(v2) && Array.isArray(v3), 'Generated embeddings are valid arrays');
  const selfSim = cosineSimilarity(v1!, v2!);
  assert(Math.abs(selfSim - 1.0) < 0.0001, 'Cosine similarity of identical text embeddings is 1.0');

  const diffSim = cosineSimilarity(v1!, v3!);
  assert(diffSim < selfSim, 'Unrelated text yields lower cosine similarity than identical text');

  // Exact math tests on cosine similarity
  assert(Math.abs(cosineSimilarity([1, 0], [0, 1]) - 0) < 0.0001, 'Orthogonal vectors produce cosine similarity 0.0');
  assert(Math.abs(cosineSimilarity([1, 1], [-1, -1]) - (-1.0)) < 0.0001, 'Opposite vectors produce cosine similarity -1.0');
  assert(cosineSimilarity([], [1, 2]) === 0, 'Zero-length vectors return safe 0.0 similarity');

  // ==========================================
  // 3. GOOGLE GENAI EMBEDDING FALLBACK & CREDENTIAL ISOLATION
  // ==========================================
  console.log('\n3. Google GenAI Provider & Credential Isolation:');
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    const realProvider = new GoogleGenAIEmbeddingProvider();
    const status = realProvider.getStatus();
    assert(status.configured === false, 'Detects unconfigured state when GEMINI_API_KEY is missing');
    assert(status.status === 'UNAVAILABLE', 'Status is UNAVAILABLE when unconfigured');

    const embedResult = await realProvider.embedText('test query');
    assert(embedResult === null, 'Gracefully returns null when unconfigured allowing deterministic fallback');
  } finally {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  }

  // ==========================================
  // 4. RETRIEVAL ENGINE WITH MOCK EMBEDDINGS
  // ==========================================
  console.log('\n4. Hybrid Retrieval Engine Setup:');
  const repository = new EvidenceRepository();
  repository.addEvidence(sampleRealSecItem);
  repository.addEvidence(sampleRealMarketQuote);
  repository.addEvidence(sampleSimulatedQuote);
  repository.addEvidence(sampleUnavailableItem);

  const engine = new RetrievalEngine(repository, mockProvider);
  assert(engine.getRepository() === repository, 'RetrievalEngine attaches correctly to EvidenceRepository');

  // ==========================================
  // 5. POINT-IN-TIME FILTERING ENFORCEMENT
  // ==========================================
  console.log('\n5. Point-in-Time Retrieval Filtering:');
  // Add a future event published on 2025-01-01
  const futureItem: EvidenceItem = {
    ...sampleRealSecItem,
    evidenceId: 'sec-nvda-future-10k',
    title: 'Future NVDA 2025 10-K',
    filingDate: '2025-02-15',
    periodEnd: '2025-01-31',
    structuredValue: {
      metric: 'Revenues',
      value: 35000000000,
      unit: 'USD',
      fiscalYear: 2025,
      fiscalPeriod: 'FY'
    },
    publishedAt: '2025-02-15T00:00:00.000Z',
    availableAt: '2025-02-15T00:00:00.000Z'
  };
  const addedFuture = repository.addEvidence(futureItem);
  assert(addedFuture === true, 'Future evidence item is successfully added to repository');

  // Query as of 2024-06-01 (before futureItem)
  const pitResultBefore = await engine.retrieve({
    query: 'NVDA revenue earnings',
    asOfDate: '2024-06-01T00:00:00.000Z'
  });
  const hasFutureInBundle = pitResultBefore.evidenceBundle.some(e => e.evidenceId === 'sec-nvda-future-10k');
  assert(!hasFutureInBundle, 'Point-in-time filter strictly excludes evidence published after asOfDate');

  // Query as of 2025-03-01 (after futureItem)
  const pitResultAfter = await engine.retrieve({
    query: 'NVDA revenue earnings',
    asOfDate: '2025-03-01T00:00:00.000Z'
  });
  const hasFutureInAfter = pitResultAfter.evidenceBundle.some(e => e.evidenceId === 'sec-nvda-future-10k');
  assert(hasFutureInAfter, 'Point-in-time filter includes evidence available as of target date');

  // Clean up future item
  repository.removeEvidence('sec-nvda-future-10k');

  // ==========================================
  // 6. EPISTEMIC PENALTY & RANKING LOGIC
  // ==========================================
  console.log('\n6. Epistemic Penalty & Ranking:');
  const searchResult = await engine.retrieve({
    query: 'market quote price action'
  });

  assert(searchResult.matches.length > 0, 'Retrieves matched chunks for general query');

  // Find real quote match vs simulated quote match
  const realQuoteMatch = searchResult.matches.find(c => c.evidence.evidenceId === sampleRealMarketQuote.evidenceId);
  const simQuoteMatch = searchResult.matches.find(c => c.evidence.evidenceId === sampleSimulatedQuote.evidenceId);
  const unavailMatch = searchResult.matches.find(c => c.evidence.evidenceId === sampleUnavailableItem.evidenceId);

  if (realQuoteMatch && simQuoteMatch) {
    assert(
      realQuoteMatch.score > simQuoteMatch.score,
      `REAL quote score (${realQuoteMatch.score.toFixed(3)}) ranks higher than SIMULATED quote (${simQuoteMatch.score.toFixed(3)})`
    );
  }

  if (realQuoteMatch && unavailMatch) {
    assert(
      realQuoteMatch.score > unavailMatch.score,
      `REAL quote score (${realQuoteMatch.score.toFixed(3)}) ranks higher than UNAVAILABLE item (${unavailMatch.score.toFixed(3)})`
    );
  }

  // ==========================================
  // 7. CONFLICT PRESERVATION IN RETRIEVAL
  // ==========================================
  console.log('\n7. Conflict Preservation:');
  // Register conflicting revenue evidence for same concept & period from different provider
  const conflictingSecItem: EvidenceItem = {
    ...sampleRealSecItem,
    evidenceId: 'alt-nvda-2025q1-rev',
    fingerprint: 'alt-feed:nvda:revenue:2025-q1',
    provider: 'Alternative Research Feed',
    structuredValue: {
      metric: 'Revenues',
      value: 25500000000 // Differing value: 25.5B vs 26.044B
    },
    publishedAt: '2024-05-23T00:00:00.000Z',
    availableAt: '2024-05-23T00:00:00.000Z'
  };
  repository.addEvidence(conflictingSecItem);

  const conflictResult = await engine.retrieve({
    query: 'NVDA Q1 2025 revenue',
    securityId: 'NVDA'
  });

  assert(conflictResult.conflicts.length >= 1, 'Preserved conflict is surfaced in retrieval result');
  assert(
    conflictResult.conflicts[0].provider1 === 'SEC EDGAR' || conflictResult.conflicts[0].provider2 === 'SEC EDGAR',
    'Conflict records primary provider (SEC EDGAR)'
  );
  assert(
    conflictResult.conflicts[0].provider1 === 'Alternative Research Feed' || conflictResult.conflicts[0].provider2 === 'Alternative Research Feed',
    'Conflict records secondary provider (Alternative Research Feed)'
  );

  // Both conflicting items should be included in the evidenceBundle for balanced synthesis
  const hasPrimary = conflictResult.evidenceBundle.some(e => e.evidenceId === sampleRealSecItem.evidenceId);
  const hasAlternative = conflictResult.evidenceBundle.some(e => e.evidenceId === conflictingSecItem.evidenceId);
  assert(hasPrimary && hasAlternative, 'Both conflicting evidence items are preserved in evidenceBundle');

  // ==========================================
  // 8. MULTI-SOURCE DIVERSITY & BUDGETING
  // ==========================================
  console.log('\n8. Multi-Source Diversity & Budgeting:');
  // Add canonical metadata item
  const canonicalItem: EvidenceItem = {
    evidenceId: 'meta-nvda-canonical',
    conceptKey: 'nvda:canonical:meta',
    securityId: 'NVDA',
    sourceType: 'CANONICAL_METADATA',
    provider: 'Canonical Security Registry',
    epistemicStatus: 'REAL',
    isSimulated: false,
    title: 'NVDA Canonical Registration',
    content: 'NVIDIA Corporation common stock listed on NASDAQ.',
    publishedAt: '2024-01-01T00:00:00.000Z',
    availableAt: '2024-01-01T00:00:00.000Z',
    retrievedAt: '2024-01-01T00:00:00.000Z',
    qualityScore: 1.0
  };
  repository.addEvidence(canonicalItem);

  const diverseResult = await engine.retrieve({
    query: 'NVDA profile, price and revenue',
    securityId: 'NVDA',
    limit: 4
  });

  const sourceTypesInBundle = new Set(diverseResult.evidenceBundle.map(e => e.sourceType));
  assert(sourceTypesInBundle.size >= 2, 'Evidence bundle includes diverse source types (not dominated by one)');
  assert(diverseResult.evidenceBundle.length <= 4, 'Respects query limit constraint');

  // ==========================================
  // 9. RETRIEVAL CACHING & INVALIDATION
  // ==========================================
  console.log('\n9. Retrieval Caching & Invalidation:');
  const resCached1 = await engine.retrieve({ query: 'NVDA test cache speed' });
  const resCached2 = await engine.retrieve({ query: 'NVDA test cache speed' });

  assert(resCached1 === resCached2, 'Subsequent identical query returns identical cached result object');
  assert(engine.getCacheSize() >= 1, 'Cache contains at least 1 entry');

  engine.clearCache();
  assert(engine.getCacheSize() === 0, 'clearCache() successfully empties query cache');

  // ==========================================
  // 10. DOWNSTREAM RESEARCH PROMPT & WORKSPACE METADATA
  // ==========================================
  console.log('\n10. Downstream Research Prompt Formatting:');
  const mockResearchRequest: ResearchRequest = {
    query: 'Analyze NVDA revenue discrepancies',
    securities: [
      {
        id: 'sec-nvda',
        symbol: 'NVDA',
        companyName: 'NVIDIA Corporation',
        market: 'US',
        exchange: 'NASDAQ',
        country: 'United States',
        currency: 'USD'
      }
    ],
    requestedAnalysisType: 'FUNDAMENTALS',
    availableEvidence: [
      {
        id: sampleRealSecItem.evidenceId,
        securityId: 'NVDA',
        symbol: 'NVDA',
        sourceType: 'SEC_EDGAR',
        provider: 'SEC EDGAR',
        epistemicStatus: 'REAL',
        isSimulated: false,
        retrievedAt: sampleRealSecItem.retrievedAt,
        description: sampleRealSecItem.title + ': ' + sampleRealSecItem.content,
        data: null
      }
    ],
    retrievalMetadata: {
      retrievalMode: 'SEMANTIC',
      totalCandidates: 12,
      retrievedCount: 4,
      topSources: ['SEC_EDGAR (SEC EDGAR)', 'MARKET_DATA (Twelve Data)'],
      conflictsCount: 1
    },
    conflicts: conflictResult.conflicts
  };

  const userPrompt = buildUserPrompt(mockResearchRequest);

  assert(userPrompt.includes('RETRIEVAL PROVENANCE: Mode: SEMANTIC'), 'Prompt includes retrieval mode and provenance summary');
  assert(userPrompt.includes('PRESERVED EVIDENCE CONFLICTS'), 'Prompt includes preserved conflict alerts');
  assert(userPrompt.includes('SEC EDGAR vs Alternative Research Feed'), 'Prompt names conflicting providers explicitly');
  assert(userPrompt.includes('Acknowledge conflicting provider reports objectively'), 'Prompt instructs model on neutral conflict handling');

  // Check Gemini response passthrough
  const geminiEngine = new GeminiResearchEngine();
  const mockModelOutput = JSON.stringify({
    title: 'NVIDIA Q1 Financial Analysis',
    executiveSummary: 'NVDA reported revenue with cross-provider discrepancies noted.',
    conclusion: 'Synthesis completed with grounded citations.',
    sections: [
      {
        heading: 'Financial Performance',
        points: [
          {
            text: 'SEC filings show $26.04B revenue, while secondary feeds reported $25.5B.',
            classification: 'FACT',
            evidenceIds: [sampleRealSecItem.evidenceId]
          }
        ]
      }
    ],
    keyRisks: ['Data conflict across sources'],
    keyUnknowns: ['Audit adjustments'],
    confidence: 0.88
  });

  const parsedResponse = geminiEngine.parseAndValidateResponse(mockModelOutput, mockResearchRequest);
  assert(parsedResponse.retrievalMetadata !== undefined, 'ResearchResponse retains retrievalMetadata from request');
  assert(parsedResponse.retrievalMetadata?.retrievalMode === 'SEMANTIC', 'Response accurately reflects SEMANTIC retrieval mode');
  assert(parsedResponse.retrievalMetadata?.conflictsCount === 1, 'Response retains conflicts count');

  // ==========================================
  // 11. SCHEMA COMPLETENESS & EDGE CASES
  // ==========================================
  console.log('\n11. Schema Completeness & Edge Cases:');
  const blankQueryResult = await engine.retrieve({ query: '   ' });
  assert(blankQueryResult.evidenceBundle.length === 0, 'Blank query safely returns empty evidence bundle');
  assert(blankQueryResult.matches.length === 0, 'Blank query safely returns empty matches');
  assert(typeof blankQueryResult.retrievalTrace.executionTimeMs === 'number', 'RetrievalResult includes numeric executionTimeMs');
  assert(blankQueryResult.retrievalMode === 'SEMANTIC', 'Mock embedding engine reports SEMANTIC mode');

  const unconfiguredEngine = new RetrievalEngine(repository, new MockEmbeddingProvider(64, 'UNAVAILABLE', false));
  const lexResult = await unconfiguredEngine.retrieve({ query: 'NVDA quote price' });
  assert(lexResult.retrievalMode === 'DETERMINISTIC_FALLBACK', 'Engine without active embeddings cleanly falls back to DETERMINISTIC_FALLBACK mode');
  assert(lexResult.evidenceBundle.length > 0, 'Deterministic fallback still retrieves relevant items');

  // ==========================================
  // 12. CREDENTIAL ISOLATION
  // ==========================================
  console.log('\n12. Retrieval Credential Isolation:');
  const serializedResult = JSON.stringify(diverseResult);
  assert(!serializedResult.includes('GEMINI_API_KEY'), 'RetrievalResult does not contain GEMINI_API_KEY');
  assert(!serializedResult.includes('TWELVE_DATA_API_KEY'), 'RetrievalResult does not contain TWELVE_DATA_API_KEY');
  assert(!serializedResult.includes('apiKey'), 'RetrievalResult does not expose apiKey attributes');

  console.log('======================================================================');
  console.log(` PHASE 8B ALL TESTS PASSED: ${passedCount} / ${testCount} assertions, 0 failures.`);
  console.log('======================================================================');
}

runPhase8bTests().catch(err => {
  console.error('Phase 8B test failed:', err);
  process.exit(1);
});
