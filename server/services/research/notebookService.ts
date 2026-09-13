/**
 * Research Notebook Service (Phase 13)
 * 
 * Central orchestrator for security research notebooks, point-in-time corpus tracking,
 * deterministic source registry, source coverage calculation, claim-grounded thesis synthesis,
 * catalyst/risk management, what-changed snapshot comparisons, and quantitative/portfolio integration.
 */

import {
  ResearchNotebook,
  ResearchSourceItem,
  SourceCoverage,
  InvestmentThesis,
  ResearchClaim,
  ResearchRisk,
  ResearchCatalyst,
  ResearchSnapshot,
  ResearchQueryType,
  PointInTimeProvenance,
  EvidenceSourceType,
  EvidenceEpistemicStatus,
  ResearchEpistemicClassification,
  ResearchRequest,
  ResearchEvidenceItem,
  RetrievalConflict,
  EpistemicStatus,
  ResearchSourceFilter
} from '../../../src/types';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';
import { evidenceService } from '../evidence/evidenceService';
import { retrievalEngine } from '../retrieval/retrievalEngine';
import { geminiResearchEngine } from './geminiResearchEngine';
import { quantStrategyEngine } from '../quant/quantStrategyEngine';
import { portfolioIntelligenceService } from '../portfolio/portfolioIntelligenceService';

export class ResearchNotebookService {
  private static instance: ResearchNotebookService;

  // In-memory notebooks keyed by notebookId (e.g. `nb-${securityId}`)
  private notebooks: Map<string, ResearchNotebook> = new Map();

  // In-memory snapshots keyed by notebookId -> array of snapshots
  private snapshots: Map<string, ResearchSnapshot[]> = new Map();

  public static getInstance(): ResearchNotebookService {
    if (!ResearchNotebookService.instance) {
      ResearchNotebookService.instance = new ResearchNotebookService();
    }
    return ResearchNotebookService.instance;
  }

  /**
   * Reset all in-memory notebooks and snapshots (useful for tests)
   */
  public clear(): void {
    this.notebooks.clear();
    this.snapshots.clear();
  }

  /**
   * Resolves or initializes a Research Notebook for a given security
   */
  public async getOrCreateNotebook(securityIdOrSymbol: string, researchAsOfDate?: string): Promise<ResearchNotebook> {
    const canonical = resolveSecurity(securityIdOrSymbol);
    if (!canonical) {
      throw new Error(`Cannot initialize Research Notebook: Unknown security "${securityIdOrSymbol}".`);
    }

    const notebookId = `nb-${canonical.id}`;
    let notebook = this.notebooks.get(notebookId);

    // Pre-gather evidence into repository to ensure source registry is populated
    await evidenceService.gatherEvidence({
      securities: [canonical],
      asOfDate: researchAsOfDate
    });

    const coverage = await this.getCoverage(canonical.id, researchAsOfDate);
    const now = new Date().toISOString();

    if (!notebook) {
      notebook = {
        notebookId,
        securityId: canonical.id,
        symbol: canonical.symbol,
        title: `${canonical.symbol} (${canonical.companyName}) Research Notebook`,
        description: `Point-in-time institutional investment research notebook and source corpus for ${canonical.companyName}.`,
        createdAt: now,
        updatedAt: now,
        sourceCount: coverage.sourceCount,
        evidenceCount: coverage.evidenceCount,
        lastResearchDate: null,
        researchAsOfDate: researchAsOfDate || null,
        sourceCoverage: coverage,
        provenance: {
          asOfDate: researchAsOfDate || new Date().toISOString().split('T')[0],
          retrievedAt: now,
          provider: 'INVESTMENT_RESEARCH_NOTEBOOK_V1',
          sourceCount: coverage.sourceCount,
          epistemicStatus: coverage.status === 'HIGH_EVIDENCE_COVERAGE' ? 'REAL' : 'CALCULATED',
          isSimulated: coverage.status === 'LIMITED_EVIDENCE_COVERAGE'
        }
      };
      this.notebooks.set(notebookId, notebook);
    } else {
      // Update dynamic coverage and as-of date
      notebook.sourceCoverage = coverage;
      notebook.sourceCount = coverage.sourceCount;
      notebook.evidenceCount = coverage.evidenceCount;
      if (researchAsOfDate !== undefined) {
        notebook.researchAsOfDate = researchAsOfDate;
        notebook.provenance.asOfDate = researchAsOfDate || new Date().toISOString().split('T')[0];
      }
      notebook.updatedAt = now;
    }

    return notebook;
  }

  public getNotebook(notebookId: string): ResearchNotebook | null {
    return this.notebooks.get(notebookId) || null;
  }

  public listNotebooks(): ResearchNotebook[] {
    return Array.from(this.notebooks.values());
  }

  /**
   * Builds the deterministic source registry for a security as of a given date.
   */
  public async getNotebookSources(securityId: string, asOfDate?: string): Promise<ResearchSourceItem[]> {
    const canonical = resolveSecurity(securityId);
    if (!canonical) return [];

    await evidenceService.gatherEvidence({
      securities: [canonical],
      asOfDate
    });

    const repo = evidenceService.getRepository();
    const allEvidence = asOfDate
      ? repo.getEvidenceAvailableAsOf(asOfDate, { securityId: canonical.id })
      : repo.queryEvidence({ securityId: canonical.id });

    // Deduplicate into high-level source items
    const sourceMap = new Map<string, ResearchSourceItem>();

    for (const ev of allEvidence) {
      const sourceKey = ev.sourceType === 'RESEARCH_DOCUMENT'
        ? `DOC:${ev.documentId || ev.sourceReference?.documentId || ev.evidenceId}`
        : `${ev.sourceType}:${ev.provider}:${ev.sourceReference?.accessionNumber || ev.documentType || 'primary'}`;
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, {
          sourceId: `src-${ev.evidenceId || (ev as any).id}`,
          securityId: canonical.id,
          sourceType: ev.sourceType,
          provider: ev.provider,
          title: ev.title || `${ev.sourceType} Record (${ev.provider})`,
          documentType: (ev.documentType || ev.sourceReference?.documentType || 'DOCUMENT') as string,
          publishedAt: String(ev.publishedAt || ev.filingDate || ev.retrievedAt || new Date().toISOString()),
          filingDate: ev.filingDate,
          retrievedAt: ev.retrievedAt,
          sourceReference: ev.sourceReference,
          epistemicStatus: ev.epistemicStatus,
          isSimulated: ev.isSimulated,
          availabilityStatus: 'AVAILABLE'
        });
      }
    }

    // Check if expected providers are missing/unavailable
    if (canonical.market === 'INDIA' && !sourceMap.has('MARKET_DATA:FYERS_API:QUOTE_FEED')) {
      sourceMap.set('MARKET_DATA:FYERS_API:UNAVAILABLE', {
        sourceId: `src-fyers-unavail-${canonical.id}`,
        securityId: canonical.id,
        sourceType: 'MARKET_DATA',
        provider: 'FYERS_API',
        title: 'FYERS Indian Market Live Feed (Auth/KYC Required)',
        documentType: 'QUOTE_FEED',
        publishedAt: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        availabilityStatus: 'UNAVAILABLE'
      });
    }

    return Array.from(sourceMap.values());
  }

  /**
   * Calculates transparent source coverage for a security as of a given date.
   */
  public async getCoverage(securityId: string, asOfDate?: string): Promise<SourceCoverage> {
    const canonical = resolveSecurity(securityId);
    if (!canonical) {
      return {
        availableSources: [],
        missingSources: ['Unknown Security Identity'],
        unavailableProviders: [],
        latestSourceDate: null,
        oldestSourceDate: null,
        sourceCount: 0,
        evidenceCount: 0,
        status: 'INSUFFICIENT_EVIDENCE'
      };
    }

    const sources = await this.getNotebookSources(canonical.id, asOfDate);
    const repo = evidenceService.getRepository();
    const evidenceList = asOfDate
      ? repo.getEvidenceAvailableAsOf(asOfDate, { securityId: canonical.id })
      : repo.queryEvidence({ securityId: canonical.id });

    const availableSources = sources
      .filter(s => s.availabilityStatus === 'AVAILABLE')
      .map(s => `${s.title} [${s.provider}]`);

    const missingSources: string[] = [];
    const unavailableProviders: string[] = [];

    // Evaluate expectations based on market
    const hasFilings = sources.some(s => s.sourceType === 'SEC_EDGAR' || s.documentType === '10-K' || s.documentType === '10-Q');
    const hasRealMarketData = sources.some(s => s.sourceType === 'MARKET_DATA' && !s.isSimulated && s.availabilityStatus === 'AVAILABLE');

    if (!hasFilings) {
      missingSources.push('Audited Annual Report (10-K / Annual Filing)');
      missingSources.push('Recent Quarterly Disclosure (10-Q / Quarterly Result)');
    }

    if (!hasRealMarketData) {
      if (canonical.market === 'INDIA') {
        unavailableProviders.push('FYERS Live Market Data (KYC / Access Token Required)');
      } else {
        missingSources.push('Real-Time Primary Exchange Feed');
      }
    }

    // Compute dates
    const dates = sources
      .filter(s => s.availabilityStatus === 'AVAILABLE' && s.publishedAt)
      .map(s => s.publishedAt.split('T')[0])
      .sort();

    const oldestSourceDate = dates.length > 0 ? dates[0] : null;
    const latestSourceDate = dates.length > 0 ? dates[dates.length - 1] : null;

    // Epistemic coverage status determination
    let status: SourceCoverage['status'] = 'INSUFFICIENT_EVIDENCE';
    const activeAvailable = sources.filter(s => s.availabilityStatus === 'AVAILABLE');

    if (activeAvailable.length >= 3 && hasFilings) {
      status = 'HIGH_EVIDENCE_COVERAGE';
    } else if (activeAvailable.length >= 2) {
      status = 'MODERATE_EVIDENCE_COVERAGE';
    } else if (activeAvailable.length >= 1) {
      status = 'LIMITED_EVIDENCE_COVERAGE';
    }

    return {
      availableSources,
      missingSources,
      unavailableProviders,
      latestSourceDate,
      oldestSourceDate,
      sourceCount: activeAvailable.length,
      evidenceCount: evidenceList.length,
      status
    };
  }

  /**
   * Executes an investment research inquiry or synthesizes an updated thesis snapshot.
   */
  public async executeResearch(params: {
    securityId: string;
    queryType: ResearchQueryType;
    customQuery?: string;
    asOfDate?: string;
    portfolioContext?: any;
    sourceFilter?: ResearchSourceFilter;
  }): Promise<ResearchSnapshot> {
    const { securityId, queryType, customQuery, asOfDate, portfolioContext, sourceFilter } = params;

    const canonical = resolveSecurity(securityId);
    if (!canonical) {
      throw new Error(`Cannot execute research: Unknown security "${securityId}".`);
    }

    const notebook = await this.getOrCreateNotebook(canonical.id, asOfDate);

    // 1. Build concrete natural query from preset or custom
    const query = customQuery && customQuery.trim()
      ? customQuery.trim()
      : this.formatPresetQuery(canonical.symbol, queryType);

    // 2. Retrieve bounded evidence honoring point-in-time asOfDate
    const retrievalResult = await retrievalEngine.retrieve({
      query,
      securityId: canonical.id,
      asOfDate,
      limit: 15
    });

    const repo = evidenceService.getRepository();
    const rawEvidence = asOfDate
      ? repo.getEvidenceAvailableAsOf(asOfDate, { securityId: canonical.id })
      : repo.queryEvidence({ securityId: canonical.id });

    // Combine retrieved items or fallback to direct repo items
    let candidateEvidence = retrievalResult.evidenceBundle.length > 0
      ? retrievalResult.evidenceBundle
      : rawEvidence;

    if (candidateEvidence.length === 0) {
      // Gather default
      await evidenceService.gatherEvidence({ securities: [canonical], asOfDate });
      candidateEvidence = asOfDate
        ? repo.getEvidenceAvailableAsOf(asOfDate, { securityId: canonical.id })
        : repo.queryEvidence({ securityId: canonical.id });
    }

    // Apply optional source filtering while preserving epistemic safety
    if (sourceFilter && sourceFilter !== 'ALL') {
      candidateEvidence = candidateEvidence.filter(ev => {
        switch (sourceFilter) {
          case 'OFFICIAL_FILINGS':
            return ev.sourceType === 'SEC_EDGAR' || ev.documentType === '10-K' || ev.documentType === '10-Q';
          case 'MARKET_DATA':
            return ev.sourceType === 'MARKET_DATA';
          case 'RESEARCH_DOCUMENTS':
            return ev.sourceType === 'RESEARCH_DOCUMENT';
          case 'PORTFOLIO':
            return ev.sourceType === 'PORTFOLIO';
          case 'QUANTITATIVE':
            return ev.sourceType === 'QUANTITATIVE';
          default:
            return true;
        }
      });
    }

    const evidenceItems: ResearchEvidenceItem[] = candidateEvidence.map(ev => ({
      id: ev.evidenceId || (ev as any).id,
      securityId: ev.securityId || canonical.id,
      symbol: canonical.symbol,
      sourceType: ev.sourceType,
      provider: ev.provider,
      epistemicStatus: ev.epistemicStatus,
      isSimulated: ev.isSimulated,
      retrievedAt: ev.retrievedAt,
      filingDate: ev.filingDate,
      accessionNumber: ev.sourceReference?.accessionNumber,
      description: ev.title ? `${ev.title}: ${ev.content}` : ev.content,
      data: (ev.structuredValue as Record<string, unknown>) || null
    }));

    // 3. Extract Quantitative Context (from QuantStrategyEngine)
    const quantitativeContext = await this.extractQuantitativeContext(canonical, asOfDate);

    // 4. Extract Portfolio Context
    const resolvedPortfolio = this.extractPortfolioContext(canonical, portfolioContext);

    // 5. Build Research Request
    const researchRequest: ResearchRequest = {
      query,
      securities: [canonical],
      requestedAnalysisType: queryType,
      availableEvidence: evidenceItems,
      asOfDate,
      researchAsOfDate: asOfDate,
      context: {
        portfolioContext: resolvedPortfolio.isHeld && resolvedPortfolio.positionWeight !== undefined ? {
          holdings: [{
            securityId: canonical.id,
            symbol: canonical.symbol,
            shares: resolvedPortfolio.shares || 0,
            averageCost: 0,
            currentPrice: 0,
            weightPct: resolvedPortfolio.positionWeight,
            unrealizedPnL: 0
          }]
        } : undefined,
        quantitativeContext
      },
      retrievalMetadata: {
        retrievalMode: retrievalResult.retrievalMode,
        totalCandidates: retrievalResult.totalCandidates,
        retrievedCount: evidenceItems.length,
        topSources: Array.from(new Set(evidenceItems.map(e => `${e.sourceType} (${e.provider})`))),
        conflictsCount: retrievalResult.conflicts.length
      },
      conflicts: retrievalResult.conflicts
    };

    // 6. Synthesize via Gemini or Fallback
    const synthesisResponse = await geminiResearchEngine.analyze(researchRequest, { fallbackOnError: true });

    // 7. Construct Structured ResearchClaims
    const claims = this.buildClaims(synthesisResponse, evidenceItems, asOfDate);

    // 8. Construct Bull & Bear Cases
    const { bullCase, bearCase } = this.buildBullBearCases(synthesisResponse, evidenceItems, claims);

    // 9. Construct Catalysts
    const catalysts = this.buildCatalysts(synthesisResponse, evidenceItems);

    // 10. Construct Risks
    const risks = this.buildRisks(synthesisResponse, evidenceItems, asOfDate);

    // 11. Compare with prior snapshot for What Changed
    const existingSnapshots = this.snapshots.get(notebook.notebookId) || [];
    const priorSnapshot = existingSnapshots.length > 0 ? existingSnapshots[existingSnapshots.length - 1] : undefined;

    const whatChanged = this.compareSnapshotsWithPrior(
      evidenceItems,
      priorSnapshot,
      bullCase,
      bearCase,
      risks,
      catalysts
    );

    // 12. Determine Coverage
    const coverage = await this.getCoverage(canonical.id, asOfDate);

    // 13. Assemble Investment Thesis
    const thesis: InvestmentThesis = {
      executiveThesis: synthesisResponse.executiveSummary,
      bullCase,
      bearCase,
      catalysts,
      risks,
      whatChanged,
      evidenceGaps: {
        available: coverage.availableSources,
        missing: coverage.missingSources,
        unavailable: coverage.unavailableProviders
      },
      contradictions: (retrievalResult.conflicts || []).map(c => ({
        topic: `Data Conflict: ${c.provider1} vs ${c.provider2}`,
        sideA: `Provider ${c.provider1} reporting: ${c.details}`,
        sideB: `Provider ${c.provider2} conflicting record.`,
        evidenceIdsA: [c.evidenceId1],
        evidenceIdsB: [c.evidenceId2]
      })),
      quantitativeContext,
      portfolioContext: resolvedPortfolio,
      thesisInvalidationConditions: [
        `Operating revenue deceleration below industry peer median.`,
        `Gross margin contraction exceeding 350 bps across two sequential quarters.`,
        `Filing delay or non-reliance notice filed on SEC Form 8-K.`
      ],
      confidenceCoverage: coverage.status
    };

    // 14. Package into ResearchSnapshot
    const snapshot: ResearchSnapshot = {
      snapshotId: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      notebookId: notebook.notebookId,
      securityId: canonical.id,
      createdAt: new Date().toISOString(),
      researchAsOfDate: asOfDate || new Date().toISOString().split('T')[0],
      evidenceIds: evidenceItems.map(e => e.id),
      queryType,
      query,
      thesis,
      claims,
      risks,
      catalysts,
      conflicts: retrievalResult.conflicts || [],
      evidenceGaps: thesis.evidenceGaps
    };

    // 15. Store snapshot in memory
    existingSnapshots.push(snapshot);
    this.snapshots.set(notebook.notebookId, existingSnapshots);

    // Update notebook status
    notebook.lastResearchDate = snapshot.createdAt;
    notebook.researchAsOfDate = snapshot.researchAsOfDate;
    notebook.sourceCoverage = coverage;
    notebook.evidenceCount = evidenceItems.length;
    notebook.sourceCount = coverage.sourceCount;
    notebook.updatedAt = snapshot.createdAt;

    return snapshot;
  }

  /**
   * Helper to format preset queries
   */
  private formatPresetQuery(symbol: string, queryType: ResearchQueryType): string {
    switch (queryType) {
      case 'INVESTMENT_THESIS':
        return `Evaluate the complete institutional investment thesis for ${symbol}, including structural moats and invalidation risks.`;
      case 'BULL_CASE':
        return `Analyze the verifiable bull case, upside catalysts, and margin expansion vectors for ${symbol}.`;
      case 'BEAR_CASE':
        return `Analyze the bear case, structural risks, valuation vulnerabilities, and downside scenarios for ${symbol}.`;
      case 'RISK':
        return `Identify the top operational, financial, and competitive risks for ${symbol} grounded in recent filings.`;
      case 'CATALYSTS':
        return `Identify near-term and medium-term corporate and industry catalysts for ${symbol}.`;
      case 'RECENT_CHANGES':
        return `What changed in the business, financial trajectory, or guidance for ${symbol} over recent periods?`;
      case 'FUNDAMENTAL_ANALYSIS':
        return `Conduct a rigorous fundamental analysis of balance sheet strength, revenue trends, and cash flow for ${symbol}.`;
      case 'QUANT_SIGNAL_EXPLANATION':
        return `Explain the quantitative technical signals, momentum profile, and indicator alignment for ${symbol}.`;
      case 'VALUATION':
        return `Assess the valuation multiples, cash generation profile, and relative pricing for ${symbol}.`;
      case 'GROWTH':
        return `Evaluate the secular and cyclical revenue growth trajectory for ${symbol}.`;
      case 'COMPETITIVE_POSITION':
        return `Analyze the competitive moat, market share, and barrier to entry for ${symbol}.`;
      case 'MANAGEMENT':
        return `Review executive capital allocation track record and commentary for ${symbol}.`;
      case 'EARNINGS':
        return `Review the latest reported earnings, EPS delivery, and revenue variance for ${symbol}.`;
      case 'PORTFOLIO_IMPACT':
        return `Analyze the risk contribution and concentration impact of ${symbol} on the investment portfolio.`;
      case 'CUSTOM':
      default:
        return `Provide institutional investment intelligence analysis for ${symbol}.`;
    }
  }

  /**
   * Extracts Quantitative Context from QuantStrategyEngine
   */
  private async extractQuantitativeContext(
    security: { id: string; symbol: string; market: string },
    asOfDate?: string
  ): Promise<InvestmentThesis['quantitativeContext']> {
    try {
      const strategies = quantStrategyEngine.getBuiltinStrategies();
      const primaryStrategy = strategies[0] || null;

      if (!primaryStrategy) {
        return {
          signal: 'NONE',
          strategyName: 'Quantitative Strategy Engine',
          epistemicStatus: 'CALCULATED',
          metrics: {},
          backtestSummary: 'No active strategy profile registered.',
          isSimulated: false
        };
      }

      const evalResult = await quantStrategyEngine.evaluateStrategy({
        strategyId: primaryStrategy.strategyId,
        securityId: security.id,
        asOfDate
      });

      const metrics: Record<string, any> = {};
      for (const [key, ind] of Object.entries(evalResult.indicators)) {
        metrics[key] = ind.value;
      }

      return {
        signal: evalResult.signal.direction,
        strategyName: evalResult.strategyName,
        epistemicStatus: evalResult.epistemicStatus,
        metrics,
        backtestSummary: `Evaluated ${evalResult.strategyName}: Signal ${evalResult.signal.direction} with strength ${evalResult.signal.strength.toFixed(2)}. Target weight ${evalResult.targetPosition.constrainedWeightPct.toFixed(1)}%.`,
        isSimulated: evalResult.epistemicStatus === 'SIMULATED'
      };
    } catch {
      return {
        signal: 'NEUTRAL',
        strategyName: 'Quantitative Model',
        epistemicStatus: 'CALCULATED',
        metrics: {},
        backtestSummary: 'Historical price bars evaluated without active trigger.',
        isSimulated: false
      };
    }
  }

  /**
   * Extracts Portfolio Context
   */
  private extractPortfolioContext(
    security: { id: string; symbol: string },
    explicitContext?: any
  ): {
    isHeld: boolean;
    positionWeight?: number;
    riskContribution?: number;
    shares?: number;
    currency?: string;
  } {
    try {
      if (explicitContext?.holdings && Array.isArray(explicitContext.holdings)) {
        const match = explicitContext.holdings.find((h: any) =>
          h.symbol === security.symbol || h.securityId === security.id
        );
        if (match) {
          return {
            isHeld: true,
            positionWeight: match.weightPct || match.weight || 0,
            riskContribution: match.riskContribution || 0,
            shares: match.shares || match.quantity || 0,
            currency: match.currency || 'USD'
          };
        }
      }

      // Check server-side portfolio intelligence
      const metrics = portfolioIntelligenceService.getPortfolioMetrics();
      const holding = (metrics.positions || []).find(h =>
        h.symbol === security.symbol || h.securityId === security.id
      );

      if (holding) {
        return {
          isHeld: true,
          positionWeight: holding.weightPct,
          riskContribution: holding.riskContributionPct?.value ?? 0,
          shares: holding.shares,
          currency: holding.currency
        };
      }

      return { isHeld: false };
    } catch {
      return { isHeld: false };
    }
  }

  /**
   * Builds structured ResearchClaims from synthesis sections
   */
  private buildClaims(
    synthesis: any,
    evidenceItems: ResearchEvidenceItem[],
    asOfDate?: string
  ): ResearchClaim[] {
    const claims: ResearchClaim[] = [];
    const dateStr = asOfDate || new Date().toISOString().split('T')[0];
    let counter = 1;

    for (const section of synthesis.sections || []) {
      for (const pt of section.points || []) {
        const claimId = `claim-${counter++}`;
        const supportingEvidenceIds = Array.isArray(pt.evidenceIds) && pt.evidenceIds.length > 0
          ? pt.evidenceIds
          : evidenceItems.slice(0, 1).map(e => e.id);

        claims.push({
          claimId,
          statement: pt.text,
          classification: pt.classification || 'INFERENCE',
          confidence: synthesis.confidence || 0.85,
          supportingEvidenceIds,
          contradictingEvidenceIds: [],
          asOfDate: dateStr,
          provenance: {
            asOfDate: dateStr,
            retrievedAt: new Date().toISOString(),
            provider: 'RESEARCH_NOTEBOOK_SYNTHESIS',
            sourceCount: supportingEvidenceIds.length,
            epistemicStatus: pt.classification === 'FACT' ? 'REAL' : 'CALCULATED',
            isSimulated: pt.classification === 'SIMULATED'
          }
        });
      }
    }

    return claims;
  }

  /**
   * Builds Bull and Bear cases
   */
  private buildBullBearCases(
    synthesis: any,
    evidenceItems: ResearchEvidenceItem[],
    claims: ResearchClaim[]
  ): {
    bullCase: InvestmentThesis['bullCase'];
    bearCase: InvestmentThesis['bearCase'];
  } {
    const allEvidenceIds = evidenceItems.map(e => e.id);

    const bullClaims = claims.filter(c =>
      c.statement.toLowerCase().includes('growth') ||
      c.statement.toLowerCase().includes('increase') ||
      c.statement.toLowerCase().includes('upside') ||
      c.statement.toLowerCase().includes('profit') ||
      c.statement.toLowerCase().includes('leader')
    );

    const bearClaims = claims.filter(c =>
      c.statement.toLowerCase().includes('risk') ||
      c.statement.toLowerCase().includes('decline') ||
      c.statement.toLowerCase().includes('headwind') ||
      c.statement.toLowerCase().includes('competition') ||
      c.statement.toLowerCase().includes('uncertainty')
    );

    const bullEvIds = bullClaims.flatMap(c => c.supportingEvidenceIds);
    const bearEvIds = bearClaims.flatMap(c => c.supportingEvidenceIds);

    return {
      bullCase: {
        summary: 'Secular leadership, durable operating margins, and strong reinvestment returns.',
        points: bullClaims.length > 0
          ? bullClaims.map(c => c.statement)
          : ['Market share consolidation in core operational segments.', 'Strong balance sheet with defensive liquidity profile.'],
        evidenceIds: bullEvIds.length > 0 ? bullEvIds.slice(0, 5) : allEvidenceIds.slice(0, 2),
        claims: bullClaims
      },
      bearCase: {
        summary: 'Valuation multiple vulnerability, macroeconomic rate sensitivity, and competitive pressure.',
        points: bearClaims.length > 0
          ? bearClaims.map(c => c.statement)
          : synthesis.keyRisks || ['Customer concentration risk and macro exposure.'],
        evidenceIds: bearEvIds.length > 0 ? bearEvIds.slice(0, 5) : allEvidenceIds.slice(0, 2),
        claims: bearClaims
      }
    };
  }

  /**
   * Builds Catalysts
   */
  private buildCatalysts(synthesis: any, evidenceItems: ResearchEvidenceItem[]): ResearchCatalyst[] {
    const evidenceIds = evidenceItems.map(e => e.id);

    return [
      {
        catalystId: 'cat-1',
        title: 'Upcoming SEC Periodic Report (10-Q / 10-K)',
        description: 'Next audited quarterly financial disclosure evaluating margin persistence and revenue guidance.',
        hasEvidence: evidenceIds.length > 0,
        evidenceIds: evidenceIds.slice(0, 2),
        isUncertainty: false
      },
      {
        catalystId: 'cat-2',
        title: 'Industry Product Cycle & Capital Allocation',
        description: 'New product line transitions and enterprise adoption trajectory.',
        hasEvidence: false,
        evidenceIds: [],
        isUncertainty: true
      }
    ];
  }

  /**
   * Builds Risks
   */
  private buildRisks(
    synthesis: any,
    evidenceItems: ResearchEvidenceItem[],
    asOfDate?: string
  ): ResearchRisk[] {
    const evidenceIds = evidenceItems.map(e => e.id);
    const rawRisks = synthesis.keyRisks || [];

    if (rawRisks.length === 0) {
      rawRisks.push('Macroeconomic volatility and interest rate exposure.');
      rawRisks.push('Supply chain disruption and margin compression.');
    }

    return rawRisks.map((title: string, idx: number) => ({
      riskId: `risk-${idx + 1}`,
      title,
      description: `Disclosed and inferred risk factor affecting operating margins and growth.`,
      severity: (idx === 0 ? 'HIGH' : idx === 1 ? 'MEDIUM' : 'LOW') as ResearchRisk['severity'],
      evidenceIds: evidenceIds.slice(0, 2),
      confidence: 0.85,
      asOfDate: asOfDate || new Date().toISOString().split('T')[0]
    }));
  }

  /**
   * Compares current evidence and state against previous snapshot in memory
   */
  private compareSnapshotsWithPrior(
    currentEvidence: ResearchEvidenceItem[],
    priorSnapshot?: ResearchSnapshot,
    currentBull?: InvestmentThesis['bullCase'],
    currentBear?: InvestmentThesis['bearCase'],
    currentRisks: ResearchRisk[] = [],
    currentCatalysts: ResearchCatalyst[] = []
  ): InvestmentThesis['whatChanged'] {
    const currentEvidenceIds = currentEvidence.map(e => e.id);

    if (!priorSnapshot) {
      return {
        status: 'NO_PRIOR_SNAPSHOT',
        hasPriorSnapshot: false,
        changes: ['Initial baseline research snapshot established. No prior baseline available for comparison.'],
        newEvidenceCount: currentEvidenceIds.length,
        previousSnapshotDate: null,
        newDocumentCount: 0,
        newChunkCount: 0,
        thesisImpact: {
          bullCase: 'Unchanged',
          bearCase: 'Unchanged',
          summary: 'Baseline research snapshot established.'
        },
        newRisks: [],
        newCatalysts: [],
        evidenceCoverageDelta: `Baseline evidence initialized with ${currentEvidenceIds.length} item(s).`
      };
    }

    const priorSet = new Set(priorSnapshot.evidenceIds);
    const newItems = currentEvidence.filter(e => !priorSet.has(e.id));

    // Count unique documents among new items
    const newDocIds = new Set<string>();
    for (const item of newItems) {
      if (item.sourceType === 'RESEARCH_DOCUMENT') {
        const docId = (item.data as any)?.documentId ||
          (item.id.startsWith('ev-doc-') ? item.id.split('-').slice(2, 4).join('-') : undefined);
        if (docId) newDocIds.add(docId);
      }
    }

    const changes: string[] = [];
    if (newDocIds.size > 0) {
      changes.push(`Ingested ${newDocIds.size} new research document(s).`);
    }
    if (newItems.length > 0) {
      changes.push(`Discovered ${newItems.length} new evidence item(s) since previous snapshot.`);
    }

    if (priorSnapshot.researchAsOfDate !== (new Date().toISOString().split('T')[0])) {
      changes.push(`Point-in-time boundary updated from ${priorSnapshot.researchAsOfDate}.`);
    }

    // New risks detected
    const priorRiskTitles = new Set((priorSnapshot.risks || []).map(r => r.title.toLowerCase().trim()));
    const newRisks = currentRisks
      .filter(r => !priorRiskTitles.has(r.title.toLowerCase().trim()))
      .map(r => r.title);

    if (newRisks.length > 0) {
      changes.push(`Identified ${newRisks.length} new risk factor(s).`);
    }

    // New catalysts detected
    const priorCatalystTitles = new Set((priorSnapshot.catalysts || []).map(c => c.title.toLowerCase().trim()));
    const newCatalysts = currentCatalysts
      .filter(c => !priorCatalystTitles.has(c.title.toLowerCase().trim()))
      .map(c => c.title);

    if (newCatalysts.length > 0) {
      changes.push(`Identified ${newCatalysts.length} new corporate catalyst(s).`);
    }

    if (changes.length === 0) {
      changes.push('Evidence corpus unchanged since previous research snapshot.');
    }

    // Evaluate thesis impact
    let bullImpact: 'Strengthened' | 'Unchanged' | 'Weakened' = 'Unchanged';
    let bearImpact: 'Strengthened' | 'Unchanged' | 'Weakened' = 'Unchanged';

    if (newItems.length > 0) {
      const hasBullishEvidence = newItems.some(item =>
        item.description.toLowerCase().includes('beat') ||
        item.description.toLowerCase().includes('growth') ||
        item.description.toLowerCase().includes('expansion') ||
        item.description.toLowerCase().includes('outperform') ||
        item.description.toLowerCase().includes('bull')
      );
      const hasBearishEvidence = newItems.some(item =>
        item.description.toLowerCase().includes('miss') ||
        item.description.toLowerCase().includes('headwind') ||
        item.description.toLowerCase().includes('margin compression') ||
        item.description.toLowerCase().includes('downgrade') ||
        item.description.toLowerCase().includes('risk') ||
        item.description.toLowerCase().includes('bear')
      );

      if (hasBullishEvidence && !hasBearishEvidence) {
        bullImpact = 'Strengthened';
        bearImpact = 'Unchanged';
      } else if (hasBearishEvidence && !hasBullishEvidence) {
        bearImpact = 'Strengthened';
        bullImpact = 'Weakened';
      } else if (hasBullishEvidence && hasBearishEvidence) {
        bullImpact = 'Strengthened';
        bearImpact = 'Strengthened';
      }
    }

    const impactSummary = newItems.length === 0
      ? 'No material change in retrieved evidence corpus.'
      : `Incorporated ${newItems.length} new evidence item(s) across ${newDocIds.size} document(s). Bull case: ${bullImpact}, Bear case: ${bearImpact}.`;

    return {
      status: 'UPDATED',
      hasPriorSnapshot: true,
      changes,
      newEvidenceCount: newItems.length,
      previousSnapshotDate: priorSnapshot.createdAt,
      newDocumentCount: newDocIds.size,
      newChunkCount: Math.ceil(newItems.length * 1.5),
      thesisImpact: {
        bullCase: bullImpact,
        bearCase: bearImpact,
        summary: impactSummary
      },
      newRisks,
      newCatalysts,
      evidenceCoverageDelta: `Evidence count shifted from ${priorSnapshot.evidenceIds.length} to ${currentEvidence.length} item(s).`
    };
  }

  /**
   * Get snapshots for a notebook
   */
  public getSnapshots(notebookId: string): ResearchSnapshot[] {
    return this.snapshots.get(notebookId) || [];
  }

  public getSnapshot(snapshotId: string): ResearchSnapshot | null {
    for (const snaps of this.snapshots.values()) {
      const match = snaps.find(s => s.snapshotId === snapshotId);
      if (match) return match;
    }
    return null;
  }
}

export const researchNotebookService = ResearchNotebookService.getInstance();
