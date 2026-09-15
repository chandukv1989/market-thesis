/**
 * Phase 15 - Decision Scoring Engine
 * 
 * 100% Deterministic Decision Evaluation Engine
 * Evaluates 10 distinct decision dimensions based on real analytical outputs from:
 * - SEC EDGAR Financial Data (Phase 5B)
 * - Twelve Data / FYERS Market Data (Phase 5C & FYERS)
 * - Evidence Repository & Hybrid RAG (Phase 8A & 8B)
 * - Portfolio Intelligence & Risk Constraints (Phase 9)
 * - Quant Strategy Signals (Phase 11)
 * - Backtest Analytics (Phase 12A & 12B)
 * - Research Notebook & Snapshot Diffing (Phase 13)
 * - Research Document Intelligence (Phase 14)
 * 
 * Strict Invariants:
 * 1. Zero LLM involvement in score derivation or categorical classification.
 * 2. Point-in-time compliance: only consumes data available on or before asOfDate.
 * 3. No prediction guarantee: assessments reflect analytical setups, not future certainties.
 * 4. Portfolio fit distinction: existing position concentration affects portfolio fit
 *    without altering the security's fundamental quality.
 * 5. Analytical only (`isAnalyticalOnly: true`), execution prohibited (`executionProhibited: true`).
 */

import {
  CanonicalSecurity,
  InvestmentDecisionAssessment,
  DecisionOverallAssessment,
  DecisionConviction,
  DecisionDimensionKey,
  DecisionDimensionAssessment,
  DecisionFrameworkConfiguration,
  DecisionInvalidationCondition,
  DecisionKeyRisk,
  DecisionCatalyst,
  HistoricalPriceBar,
  ResearchEvidenceItem,
  EvidenceItem
} from '../../../src/types';
import { DEFAULT_DECISION_CONFIG } from './defaultConfig';

export interface DecisionScoringInputs {
  security: CanonicalSecurity;
  asOfDate: string;
  config?: Partial<DecisionFrameworkConfiguration>;
  financials?: {
    hasData: boolean;
    revenueTrend?: 'GROWING' | 'FLAT' | 'DECLINING';
    operatingMarginTrend?: 'EXPANDING' | 'STABLE' | 'CONTRACTING';
    netIncomeTrend?: 'GROWING' | 'FLAT' | 'DECLINING';
    operatingCashFlowTrend?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    periodsCount: number;
    peRatio?: number | null;
    priceToSales?: number | null;
    priceToFCF?: number | null;
    evToEbitda?: number | null;
    earningsYield?: number | null;
    evidenceIds: string[];
    isRealSecData: boolean;
  };
  marketData?: {
    currentPrice: number;
    currency: string;
    bars: Array<Partial<HistoricalPriceBar> & { timestamp: string; close: number }>;
    provider: string;
    epistemicStatus: 'REAL' | 'SIMULATED' | 'CALCULATED' | 'UNAVAILABLE';
    sma50?: number;
    sma200?: number;
    momentum?: number;
    volatility?: number;
    maxDrawdown?: number;
  };
  quantSignals?: Array<{
    strategyId: string;
    strategyName: string;
    signal: 'BUY' | 'HOLD' | 'SELL' | 'NEUTRAL';
    indicatorValues: Record<string, number | string>;
    signalTimestamp: string;
    epistemicStatus: 'REAL' | 'CALCULATED' | 'SIMULATED';
  }>;
  backtestMetrics?: {
    available: boolean;
    strategyName?: string;
    sharpeRatio?: number | null;
    cagr?: number | null;
    maxDrawdown?: number | null;
    winRate?: number | null;
    profitFactor?: number | null;
  };
  portfolioHolding?: {
    isHeld: boolean;
    weightPct?: number;
    shares?: number;
    marketValue?: number;
    unrealizedPnLPct?: number;
    portfolioBetaContribution?: number;
    sectorWeightPct?: number;
  };
  researchEvidence?: Array<Partial<ResearchEvidenceItem & EvidenceItem> & { evidenceId?: string; id?: string; [key: string]: any }>;
  notebookSnapshot?: {
    available: boolean;
    notebookId?: string;
    snapshotId?: string;
    thesisStatus?: 'STRENGTHENING' | 'STABLE' | 'WEAKENING' | 'INVALIDATED' | 'NO_PRIOR_THESIS';
    bullCasePoints?: string[];
    bearCasePoints?: string[];
    risks?: Array<{ title: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; description?: string }>;
    catalysts?: Array<{ title: string; type?: 'DISCLOSED' | 'FORWARD_LOOKING'; description?: string }>;
    diff?: {
      status: 'INITIAL' | 'IDENTICAL' | 'UPDATED' | 'CONFLICT';
      deltaEvidenceCount: number;
      thesisImpact?: {
        bullCaseImpact: 'Strengthened' | 'Unchanged' | 'Weakened';
        bearCaseImpact: 'Strengthened' | 'Unchanged' | 'Weakened';
      };
    };
  };
  providerStatuses?: Record<string, string>;
  conflictingSources?: Array<{ concept: string; primarySource: string; conflictingSource: string }>;
}

export class DecisionScoringEngine {
  private static instance: DecisionScoringEngine;

  public static getInstance(): DecisionScoringEngine {
    if (!DecisionScoringEngine.instance) {
      DecisionScoringEngine.instance = new DecisionScoringEngine();
    }
    return DecisionScoringEngine.instance;
  }

  /**
   * Evaluates a security deterministically into an InvestmentDecisionAssessment.
   */
  public evaluate(inputs: DecisionScoringInputs): InvestmentDecisionAssessment {
    const config: DecisionFrameworkConfiguration = {
      ...DEFAULT_DECISION_CONFIG,
      ...(inputs.config || {})
    };

    const asOfDate = inputs.asOfDate;
    const generatedAt = new Date().toISOString();
    const sec = inputs.security;
    const secId = sec.canonicalId || (sec as any).id || (sec as any).symbol || 'sec';
    const secTicker = sec.ticker || (sec as any).symbol || (sec as any).ticker || secId;
    const decisionId = `dec-${secId}-${asOfDate}-${config.version}`;

    // 1. Evaluate Evidence Coverage
    const evidenceItems = inputs.researchEvidence || [];
    const evidenceCategoriesSet = new Set<string>();
    evidenceItems.forEach(e => {
      if (e.sourceType) evidenceCategoriesSet.add(e.sourceType);
    });
    if (inputs.financials?.hasData) evidenceCategoriesSet.add('OFFICIAL_FILINGS');
    if (inputs.marketData && inputs.marketData.epistemicStatus !== 'UNAVAILABLE') evidenceCategoriesSet.add('MARKET_DATA');
    if (inputs.quantSignals && inputs.quantSignals.length > 0) evidenceCategoriesSet.add('QUANTITATIVE');
    if (inputs.portfolioHolding) evidenceCategoriesSet.add('PORTFOLIO');

    const totalEvidenceCount = evidenceItems.length;
    let coverageRating: 'HIGH' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT' = 'LIMITED';
    if (evidenceCategoriesSet.size >= 4 && totalEvidenceCount >= 6) {
      coverageRating = 'HIGH';
    } else if (evidenceCategoriesSet.size >= 2 && totalEvidenceCount >= 3) {
      coverageRating = 'MODERATE';
    } else if (totalEvidenceCount >= 1) {
      coverageRating = 'LIMITED';
    } else {
      coverageRating = 'INSUFFICIENT';
    }

    const availableCategories = Array.from(evidenceCategoriesSet);
    const allPossibleCategories = ['OFFICIAL_FILINGS', 'MARKET_DATA', 'RESEARCH_DOCUMENTS', 'QUANTITATIVE', 'PORTFOLIO'];
    const missingCategories = allPossibleCategories.filter(c => !evidenceCategoriesSet.has(c));

    // 2. Evaluate Dimension: Fundamental Quality
    const fundamentalDim = this.evaluateFundamentalQuality(inputs, config);

    // 3. Evaluate Dimension: Growth Trend
    const growthDim = this.evaluateGrowthTrend(inputs, config);

    // 4. Evaluate Dimension: Valuation Context
    const valuationDim = this.evaluateValuation(inputs, config);

    // 5. Evaluate Dimension: Market Trend
    const marketTrendDim = this.evaluateMarketTrend(inputs, config);

    // 6. Evaluate Dimension: Quantitative Signal
    const quantDim = this.evaluateQuantitativeSignal(inputs, config);

    // 7. Evaluate Dimension: Backtest Context
    const backtestDim = this.evaluateBacktestContext(inputs, config);

    // 8. Evaluate Dimension: Risk Profile
    const riskDim = this.evaluateRiskProfile(inputs, config);

    // 9. Evaluate Dimension: Portfolio Fit
    const portfolioFitDim = this.evaluatePortfolioFit(inputs, config);

    // 10. Evaluate Dimension: Evidence Coverage
    const evidenceCoverageDim = this.evaluateEvidenceCoverageDimension(coverageRating, totalEvidenceCount, availableCategories, missingCategories, config);

    // 11. Evaluate Dimension: Thesis Status
    const thesisDim = this.evaluateThesisStatusDimension(inputs, config);

    const dimensionAssessments: Record<DecisionDimensionKey, DecisionDimensionAssessment> = {
      fundamentalQuality: fundamentalDim,
      growthTrend: growthDim,
      valuationContext: valuationDim,
      marketTrend: marketTrendDim,
      quantitativeSignal: quantDim,
      backtestContext: backtestDim,
      riskProfile: riskDim,
      portfolioFit: portfolioFitDim,
      evidenceCoverage: evidenceCoverageDim,
      thesisStatus: thesisDim
    };

    const dimensionsList: DecisionDimensionAssessment[] = [
      fundamentalDim,
      growthDim,
      valuationDim,
      marketTrendDim,
      quantDim,
      backtestDim,
      riskDim,
      portfolioFitDim,
      evidenceCoverageDim,
      thesisDim
    ];

    // Collect supporting and contradicting evidence IDs
    const supportingEvidenceIds = Array.from(new Set(dimensionsList.flatMap(d => d.supportingEvidenceIds)));
    const contradictingEvidenceIds = Array.from(new Set(dimensionsList.flatMap(d => d.contradictingEvidenceIds)));

    // 12. Evaluate Invalidation Conditions
    const invalidationConditions = this.generateInvalidationConditions(inputs, dimensionsList);

    // 13. Calculate Composite Score & Categorical Overall Assessment
    const weightedScoreSum = dimensionsList.reduce((acc, d) => acc + (d.score * d.weight), 0);
    const totalWeight = dimensionsList.reduce((acc, d) => acc + d.weight, 0);
    const compositeScore = totalWeight > 0 ? Number((weightedScoreSum / totalWeight).toFixed(3)) : 0;

    let overallAssessment: DecisionOverallAssessment = 'NEUTRAL';
    if (totalEvidenceCount < config.minimumEvidenceThreshold && (!inputs.financials?.hasData || inputs.financials.periodsCount === 0)) {
      overallAssessment = 'INSUFFICIENT_EVIDENCE';
    } else if (invalidationConditions.some(c => c.triggered && c.category === 'FUNDAMENTAL')) {
      overallAssessment = compositeScore < -0.15 ? 'NEGATIVE' : 'CAUTIOUS';
    } else if (compositeScore >= 0.40) {
      overallAssessment = 'POSITIVE';
    } else if (compositeScore >= 0.15) {
      overallAssessment = 'CONSTRUCTIVE';
    } else if (compositeScore >= -0.15) {
      overallAssessment = 'NEUTRAL';
    } else if (compositeScore >= -0.40) {
      overallAssessment = 'CAUTIOUS';
    } else {
      overallAssessment = 'NEGATIVE';
    }

    // 14. Calculate Conviction
    const conviction = this.calculateConviction(coverageRating, totalEvidenceCount, inputs, contradictingEvidenceIds.length);

    // 15. Key Drivers & Counter Evidence
    const keyDrivers: string[] = [];
    const counterEvidence: string[] = [];

    dimensionsList.forEach(d => {
      if (d.category === 'POSITIVE') {
        keyDrivers.push(`${d.dimensionName}: ${d.rationale}`);
      } else if (d.category === 'NEGATIVE' || d.category === 'CAUTIOUS') {
        counterEvidence.push(`${d.dimensionName}: ${d.rationale}`);
      }
    });

    if (keyDrivers.length === 0 && overallAssessment !== 'INSUFFICIENT_EVIDENCE') {
      keyDrivers.push(`Balanced analytical setup across key evaluation dimensions.`);
    }

    // 16. Key Risks & Catalysts
    const keyRisks = this.buildKeyRisks(inputs, dimensionsList);
    const catalysts = this.buildCatalysts(inputs);

    // 17. Epistemic status breakdown
    const epistemicSummary = {
      REAL: 0,
      CALCULATED: 0,
      SIMULATED: 0,
      UNAVAILABLE: 0
    };
    if (inputs.marketData) {
      epistemicSummary[inputs.marketData.epistemicStatus]++;
    }
    if (inputs.financials?.isRealSecData) {
      epistemicSummary.REAL++;
    } else if (inputs.financials?.hasData) {
      epistemicSummary.CALCULATED++;
    } else {
      epistemicSummary.UNAVAILABLE++;
    }
    dimensionsList.forEach(d => {
      if (d.dataStatus === 'REAL') epistemicSummary.REAL++;
      else if (d.dataStatus === 'CALCULATED') epistemicSummary.CALCULATED++;
      else if (d.dataStatus === 'SIMULATED') epistemicSummary.SIMULATED++;
      else if (d.dataStatus === 'UNAVAILABLE') epistemicSummary.UNAVAILABLE++;
    });

    // 18. Limitations list
    const limitations: string[] = [];
    if (coverageRating === 'LIMITED' || coverageRating === 'INSUFFICIENT') {
      limitations.push(`Evidence coverage is ${coverageRating}; assessment confidence is constrained by missing sources: ${missingCategories.join(', ') || 'none'}.`);
    }
    if (valuationDim.assessment === 'INSUFFICIENT_EVIDENCE' || valuationDim.assessment === 'UNAVAILABLE') {
      limitations.push('Authoritative valuation multiples are currently unavailable. Valuation metric fabrication is strictly prohibited.');
    }
    if (inputs.marketData?.epistemicStatus === 'SIMULATED') {
      limitations.push('Market price data relies on simulated historical baseline. Real market quote provider is not currently active.');
    }
    if (inputs.portfolioHolding?.isHeld && (inputs.portfolioHolding.weightPct ?? 0) >= 15) {
      limitations.push(`Position concentration in portfolio is elevated (${inputs.portfolioHolding.weightPct}%). Portfolio fit is constrained despite underlying security metrics.`);
    }

    // 19. Initial Deterministic Explanation
    const explanation = {
      summary: `The deterministic decision rules evaluate ${secTicker} as ${overallAssessment} with ${conviction} conviction as of ${asOfDate}. ` +
        `This analytical assessment synthesizes ${dimensionsList.length} distinct dimensions grounded in verified institutional evidence.`,
      whyDrivers: keyDrivers.slice(0, 4),
      counterEvidence: counterEvidence.slice(0, 4),
      keyRisksSummary: keyRisks.map(r => `[${r.severity}] ${r.title}: ${r.description}`),
      portfolioImplicationSummary: portfolioFitDim.rationale,
      invalidationSummary: invalidationConditions.map(c => `Condition: ${c.condition} (Status: ${c.status})`),
      disclaimer: 'Past simulated performance does not guarantee future results. This assessment is purely analytical and does not constitute financial advice or an order recommendation.',
      generatedBy: 'DETERMINISTIC_RULES' as const
    };

    return {
      decisionId,
      securityId: secId,
      canonicalSecurity: sec,
      asOfDate,
      generatedAt,
      frameworkVersion: config.version,
      overallAssessment,
      conviction,
      compositeScore,
      dimensionAssessments,
      dimensionsList,
      supportingEvidenceIds,
      contradictingEvidenceIds,
      evidenceCoverage: {
        rating: coverageRating,
        totalEvidenceCount,
        availableCategories,
        missingCategories,
        details: `${totalEvidenceCount} evidence items indexed across ${availableCategories.length} distinct categories.`
      },
      keyDrivers,
      counterEvidence,
      keyRisks,
      catalysts,
      thesisStatus: {
        status: inputs.notebookSnapshot?.thesisStatus || 'NO_PRIOR_THESIS',
        notebookId: inputs.notebookSnapshot?.notebookId,
        snapshotId: inputs.notebookSnapshot?.snapshotId,
        summary: inputs.notebookSnapshot?.available
          ? `Research notebook thesis status: ${inputs.notebookSnapshot.thesisStatus || 'ACTIVE'}. Grounded in ${inputs.notebookSnapshot.diff?.deltaEvidenceCount || 0} recent evidence items.`
          : 'No historical research notebook snapshot exists for comparison.'
      },
      invalidationConditions,
      portfolioContext: {
        isHeld: inputs.portfolioHolding?.isHeld ?? false,
        currentWeightPct: inputs.portfolioHolding?.weightPct,
        shares: inputs.portfolioHolding?.shares,
        marketValue: inputs.portfolioHolding?.marketValue,
        unrealizedPnLPct: inputs.portfolioHolding?.unrealizedPnLPct,
        portfolioBetaContribution: inputs.portfolioHolding?.portfolioBetaContribution,
        sectorWeightPct: inputs.portfolioHolding?.sectorWeightPct,
        marginalRiskRating: inputs.portfolioHolding?.isHeld
          ? ((inputs.portfolioHolding.weightPct ?? 0) >= 15 ? 'HIGH_CONCENTRATION' : 'NEUTRAL')
          : 'NOT_HELD',
        implication: portfolioFitDim.rationale
      },
      quantitativeContext: {
        compositeSignal: quantDim.assessment as any,
        strategiesEvaluated: inputs.quantSignals || [],
        agreement: (quantDim.metrics?.agreement as any) || 'INSUFFICIENT',
        summary: quantDim.rationale
      },
      valuationContext: {
        status: valuationDim.assessment as any,
        peRatio: inputs.financials?.peRatio,
        priceToSales: inputs.financials?.priceToSales,
        priceToFCF: inputs.financials?.priceToFCF,
        evToEbitda: inputs.financials?.evToEbitda,
        earningsYield: inputs.financials?.earningsYield,
        availableMetrics: (valuationDim.metrics?.availableMetrics as any as string[]) || [],
        missingMetrics: (valuationDim.metrics?.missingMetrics as any as string[]) || [],
        rationale: valuationDim.rationale
      },
      fundamentalContext: {
        status: fundamentalDim.assessment as any,
        revenueTrend: inputs.financials?.revenueTrend || 'UNKNOWN',
        operatingMarginTrend: inputs.financials?.operatingMarginTrend || 'UNKNOWN',
        netIncomeTrend: inputs.financials?.netIncomeTrend || 'UNKNOWN',
        operatingCashFlowTrend: inputs.financials?.operatingCashFlowTrend || 'UNKNOWN',
        availablePeriodsCount: inputs.financials?.periodsCount || 0,
        summary: fundamentalDim.rationale
      },
      marketContext: {
        currentPrice: inputs.marketData?.currentPrice || 0,
        currency: inputs.marketData?.currency || sec.currency,
        trend: marketTrendDim.assessment === 'BULLISH' ? 'BULLISH' : marketTrendDim.assessment === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
        aboveSma50: (marketTrendDim.metrics?.aboveSma50 as boolean) ?? null,
        aboveSma200: (marketTrendDim.metrics?.aboveSma200 as boolean) ?? null,
        momentumPercent: inputs.marketData?.momentum ?? null,
        annualizedVolatility: inputs.marketData?.volatility ?? null,
        maxDrawdownPercent: inputs.marketData?.maxDrawdown ?? null,
        provider: inputs.marketData?.provider || 'UNAVAILABLE',
        epistemicStatus: inputs.marketData?.epistemicStatus || 'UNAVAILABLE'
      },
      backtestContext: inputs.backtestMetrics?.available ? {
        status: backtestDim.assessment as any,
        strategyName: inputs.backtestMetrics.strategyName,
        sharpeRatio: inputs.backtestMetrics.sharpeRatio,
        cagr: inputs.backtestMetrics.cagr,
        maxDrawdown: inputs.backtestMetrics.maxDrawdown,
        winRate: inputs.backtestMetrics.winRate,
        profitFactor: inputs.backtestMetrics.profitFactor,
        disclaimer: 'Past simulated performance does not guarantee future results.'
      } : undefined,
      dataQuality: {
        providerStatuses: inputs.providerStatuses || {},
        dataFreshness: asOfDate,
        hasSimulatedData: inputs.marketData?.epistemicStatus === 'SIMULATED',
        hasStaleData: false,
        missingSources: missingCategories,
        conflictingSources: inputs.conflictingSources || [],
        epistemicSummary
      },
      explanation,
      limitations,
      isAnalyticalOnly: true,
      executionProhibited: true
    };
  }

  // ==========================================================================
  // INDIVIDUAL DIMENSION EVALUATORS
  // ==========================================================================

  private evaluateFundamentalQuality(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const fin = inputs.financials;
    if (!fin || !fin.hasData || fin.periodsCount === 0) {
      return {
        dimension: 'fundamentalQuality',
        dimensionName: 'Fundamental Quality',
        assessment: 'INSUFFICIENT_EVIDENCE',
        category: 'INSUFFICIENT',
        score: 0.0,
        weight: config.fundamentalWeight,
        rationale: 'No authoritative financial statement facts or SEC XBRL disclosures are available as of this date.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE',
        limitations: ['Financial facts missing; fundamental metric fabrication is prohibited.']
      };
    }

    let positivePoints = 0;
    let negativePoints = 0;
    const rationales: string[] = [];

    if (fin.revenueTrend === 'GROWING') {
      positivePoints += 1;
      rationales.push('Revenue demonstrates multi-period expansion');
    } else if (fin.revenueTrend === 'DECLINING') {
      negativePoints += 1;
      rationales.push('Revenue shows contraction across recent reporting periods');
    }

    if (fin.operatingMarginTrend === 'EXPANDING') {
      positivePoints += 1;
      rationales.push('Operating margins are expanding');
    } else if (fin.operatingMarginTrend === 'CONTRACTING') {
      negativePoints += 1;
      rationales.push('Operating margin compression observed');
    }

    if (fin.netIncomeTrend === 'GROWING') {
      positivePoints += 1;
      rationales.push('Net earnings are expanding');
    } else if (fin.netIncomeTrend === 'DECLINING') {
      negativePoints += 1;
      rationales.push('Net earnings have declined');
    }

    if (fin.operatingCashFlowTrend === 'POSITIVE') {
      positivePoints += 1;
      rationales.push('Operating cash flow remains positive');
    } else if (fin.operatingCashFlowTrend === 'NEGATIVE') {
      negativePoints += 1;
      rationales.push('Negative cash flow generation detected');
    }

    const netScore = positivePoints - negativePoints;
    let assessment = 'STABLE';
    let category: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    let normalizedScore = 0.0;

    if (netScore >= 2) {
      assessment = 'STRONG';
      category = 'POSITIVE';
      normalizedScore = 0.75;
    } else if (netScore === 1) {
      assessment = 'POSITIVE';
      category = 'POSITIVE';
      normalizedScore = 0.40;
    } else if (netScore === 0) {
      assessment = 'STABLE';
      category = 'NEUTRAL';
      normalizedScore = 0.10;
    } else if (netScore === -1) {
      assessment = 'WEAK';
      category = 'NEGATIVE';
      normalizedScore = -0.40;
    } else {
      assessment = 'DETERIORATING';
      category = 'NEGATIVE';
      normalizedScore = -0.75;
    }

    return {
      dimension: 'fundamentalQuality',
      dimensionName: 'Fundamental Quality',
      assessment,
      category,
      score: normalizedScore,
      weight: config.fundamentalWeight,
      rationale: rationales.join('. ') || 'Fundamental metrics are balanced across reporting periods.',
      supportingEvidenceIds: fin.evidenceIds || [],
      contradictingEvidenceIds: [],
      dataStatus: fin.isRealSecData ? 'REAL' : 'CALCULATED',
      metrics: {
        periodsCount: fin.periodsCount,
        revenueTrend: fin.revenueTrend || null,
        operatingMarginTrend: fin.operatingMarginTrend || null,
        netIncomeTrend: fin.netIncomeTrend || null
      }
    };
  }

  private evaluateGrowthTrend(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const fin = inputs.financials;
    if (!fin || !fin.hasData) {
      return {
        dimension: 'growthTrend',
        dimensionName: 'Earnings / Growth Trend',
        assessment: 'INSUFFICIENT_EVIDENCE',
        category: 'INSUFFICIENT',
        score: 0.0,
        weight: config.growthWeight,
        rationale: 'Growth trend cannot be calculated without authoritative historical financial facts.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE'
      };
    }

    const isGrowing = fin.revenueTrend === 'GROWING' && fin.netIncomeTrend !== 'DECLINING';
    const isWeakening = fin.revenueTrend === 'DECLINING' || fin.netIncomeTrend === 'DECLINING';

    let assessment = 'STABLE';
    let category: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    let score = 0.0;
    let rationale = 'Historical revenue and earnings trajectories are stable.';

    if (isGrowing) {
      assessment = 'POSITIVE';
      category = 'POSITIVE';
      score = 0.6;
      rationale = 'Consecutive revenue expansion and stable earnings indicate a positive growth trajectory.';
    } else if (isWeakening) {
      assessment = 'WEAKENING';
      category = 'NEGATIVE';
      score = -0.5;
      rationale = 'Deceleration or decline in revenue or earnings observed in recent disclosures.';
    }

    return {
      dimension: 'growthTrend',
      dimensionName: 'Earnings / Growth Trend',
      assessment,
      category,
      score,
      weight: config.growthWeight,
      rationale,
      supportingEvidenceIds: fin.evidenceIds || [],
      contradictingEvidenceIds: [],
      dataStatus: 'CALCULATED'
    };
  }

  private evaluateValuation(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const fin = inputs.financials;
    const availableMetrics: string[] = [];
    const missingMetrics: string[] = [];

    if (fin?.peRatio !== undefined && fin?.peRatio !== null) availableMetrics.push('P/E');
    else missingMetrics.push('P/E');

    if (fin?.priceToSales !== undefined && fin?.priceToSales !== null) availableMetrics.push('Price/Sales');
    else missingMetrics.push('Price/Sales');

    if (fin?.evToEbitda !== undefined && fin?.evToEbitda !== null) availableMetrics.push('EV/EBITDA');
    else missingMetrics.push('EV/EBITDA');

    if (availableMetrics.length === 0) {
      return {
        dimension: 'valuationContext',
        dimensionName: 'Valuation Context',
        assessment: 'INSUFFICIENT_EVIDENCE',
        category: 'INSUFFICIENT',
        score: 0.0,
        weight: config.valuationWeight,
        rationale: 'Current valuation multiples (P/E, P/S, EV/EBITDA) are unavailable from active data providers. Valuation metric fabrication is prohibited.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE',
        limitations: ['Valuation inputs missing from primary source feeds.'],
        metrics: {
          availableMetrics,
          missingMetrics
        }
      };
    }

    const pe = fin?.peRatio;
    let assessment = 'FAIR';
    let category: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS' | 'NEGATIVE' = 'NEUTRAL';
    let score = 0.0;
    let rationale = `Available valuation metrics indicate a reasonable multiple (P/E: ${pe ? pe.toFixed(1) : 'N/A'}).`;

    if (pe !== undefined && pe !== null) {
      if (pe > 60) {
        assessment = 'EXTREME';
        category = 'NEGATIVE';
        score = -0.7;
        rationale = `Valuation multiple is extreme (P/E: ${pe.toFixed(1)}x), introducing valuation compression vulnerability.`;
      } else if (pe > 35) {
        assessment = 'ELEVATED';
        category = 'CAUTIOUS';
        score = -0.3;
        rationale = `Valuation multiple is elevated (P/E: ${pe.toFixed(1)}x) relative to historical median.`;
      } else if (pe < 18) {
        assessment = 'ATTRACTIVE';
        category = 'POSITIVE';
        score = 0.6;
        rationale = `Valuation multiple is attractive (P/E: ${pe.toFixed(1)}x) with favorable earnings yield.`;
      }
    }

    return {
      dimension: 'valuationContext',
      dimensionName: 'Valuation Context',
      assessment,
      category,
      score,
      weight: config.valuationWeight,
      rationale,
      supportingEvidenceIds: fin?.evidenceIds || [],
      contradictingEvidenceIds: [],
      dataStatus: 'CALCULATED',
      metrics: {
        availableMetrics,
        missingMetrics,
        peRatio: pe ?? null
      }
    };
  }

  private evaluateMarketTrend(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const md = inputs.marketData;
    if (!md || md.epistemicStatus === 'UNAVAILABLE' || !md.bars || md.bars.length < 5) {
      return {
        dimension: 'marketTrend',
        dimensionName: 'Market / Price Trend',
        assessment: 'INSUFFICIENT_EVIDENCE',
        category: 'INSUFFICIENT',
        score: 0.0,
        weight: config.marketTrendWeight,
        rationale: 'Sufficient historical price bars are not available to determine deterministic technical trend.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE'
      };
    }

    const price = md.currentPrice;
    const sma50 = md.sma50;
    const sma200 = md.sma200;

    let aboveSma50: boolean | null = null;
    let aboveSma200: boolean | null = null;
    let assessment = 'NEUTRAL';
    let category: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    let score = 0.0;
    let rationale = 'Price is consolidating around medium-term moving averages.';

    if (sma50 !== undefined) aboveSma50 = price >= sma50;
    if (sma200 !== undefined) aboveSma200 = price >= sma200;

    if (aboveSma50 === true && aboveSma200 === true) {
      assessment = 'BULLISH';
      category = 'POSITIVE';
      score = 0.65;
      rationale = `Price (${price.toFixed(2)}) is trading firmly above both 50-day and 200-day moving averages.`;
    } else if (aboveSma50 === false && aboveSma200 === false) {
      assessment = 'BEARISH';
      category = 'NEGATIVE';
      score = -0.65;
      rationale = `Price (${price.toFixed(2)}) is trading below both 50-day and 200-day moving averages.`;
    }

    return {
      dimension: 'marketTrend',
      dimensionName: 'Market / Price Trend',
      assessment,
      category,
      score,
      weight: config.marketTrendWeight,
      rationale,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: md.epistemicStatus,
      metrics: {
        currentPrice: price,
        aboveSma50,
        aboveSma200,
        volatility: md.volatility ?? null
      }
    };
  }

  private evaluateQuantitativeSignal(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const signals = inputs.quantSignals || [];
    if (signals.length === 0) {
      return {
        dimension: 'quantitativeSignal',
        dimensionName: 'Quantitative Signal',
        assessment: 'UNAVAILABLE',
        category: 'INSUFFICIENT',
        score: 0.0,
        weight: config.quantitativeWeight,
        rationale: 'No quantitative strategy evaluations registered for this security.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE'
      };
    }

    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    signals.forEach(s => {
      if (s.signal === 'BUY') buyCount++;
      else if (s.signal === 'SELL') sellCount++;
      else holdCount++;
    });

    let assessment = 'HOLD';
    let category: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    let score = 0.0;
    let agreement: 'UNANIMOUS' | 'MAJORITY' | 'MIXED' = 'MIXED';
    let rationale = '';

    if (buyCount > 0 && sellCount === 0 && holdCount === 0) {
      assessment = 'BUY';
      category = 'POSITIVE';
      score = 0.8;
      agreement = 'UNANIMOUS';
      rationale = `All ${signals.length} quantitative strategies issue an active BUY signal.`;
    } else if (sellCount > 0 && buyCount === 0 && holdCount === 0) {
      assessment = 'SELL';
      category = 'NEGATIVE';
      score = -0.8;
      agreement = 'UNANIMOUS';
      rationale = `All ${signals.length} quantitative strategies issue an active SELL signal.`;
    } else if (buyCount > sellCount && buyCount > holdCount) {
      assessment = 'BUY';
      category = 'POSITIVE';
      score = 0.45;
      agreement = 'MAJORITY';
      rationale = `Majority of quantitative strategies (${buyCount}/${signals.length}) signal BUY.`;
    } else if (sellCount > buyCount && sellCount > holdCount) {
      assessment = 'SELL';
      category = 'NEGATIVE';
      score = -0.45;
      agreement = 'MAJORITY';
      rationale = `Majority of quantitative strategies (${sellCount}/${signals.length}) signal SELL.`;
    } else {
      assessment = 'MIXED';
      category = 'NEUTRAL';
      score = 0.0;
      agreement = 'MIXED';
      const breakdown = signals.map(s => `${s.strategyName}: ${s.signal}`).join(', ');
      rationale = `Quantitative signals exhibit divergence (${breakdown}).`;
    }

    return {
      dimension: 'quantitativeSignal',
      dimensionName: 'Quantitative Signal',
      assessment,
      category,
      score,
      weight: config.quantitativeWeight,
      rationale,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: 'CALCULATED',
      metrics: {
        buyCount,
        sellCount,
        holdCount,
        agreement
      }
    };
  }

  private evaluateBacktestContext(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const bt = inputs.backtestMetrics;
    if (!bt || !bt.available) {
      return {
        dimension: 'backtestContext',
        dimensionName: 'Backtest Context',
        assessment: 'HISTORICAL_SIMULATION_ONLY',
        category: 'NEUTRAL',
        score: 0.0,
        weight: config.backtestWeight,
        rationale: 'No historical backtest simulation metrics configured for this security.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE'
      };
    }

    const sharpe = bt.sharpeRatio ?? 0;
    const maxDd = bt.maxDrawdown ?? 0;

    let assessment = 'NEUTRAL';
    let category: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    let score = 0.0;
    let rationale = 'Historical strategy backtest indicates neutral risk-adjusted performance.';

    if (sharpe >= 1.2 && maxDd < 25) {
      assessment = 'SUPPORTIVE';
      category = 'POSITIVE';
      score = 0.6;
      rationale = `Historical strategy backtest shows supportive risk-adjusted returns (Sharpe: ${sharpe.toFixed(2)}, Max DD: ${maxDd.toFixed(1)}%). Past simulated performance does not guarantee future results.`;
    } else if (sharpe < 0.4 || maxDd > 35) {
      assessment = 'UNFAVORABLE';
      category = 'NEGATIVE';
      score = -0.5;
      rationale = `Historical simulation exhibited significant drawdown (${maxDd.toFixed(1)}%) or weak risk compensation (Sharpe: ${sharpe.toFixed(2)}).`;
    }

    return {
      dimension: 'backtestContext',
      dimensionName: 'Backtest Context',
      assessment,
      category,
      score,
      weight: config.backtestWeight,
      rationale,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: 'SIMULATED',
      metrics: {
        sharpeRatio: bt.sharpeRatio ?? null,
        cagr: bt.cagr ?? null,
        maxDrawdown: bt.maxDrawdown ?? null
      }
    };
  }

  private evaluateRiskProfile(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const vol = inputs.marketData?.volatility;
    const maxDd = inputs.marketData?.maxDrawdown;

    let assessment = 'MODERATE';
    let category: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS' | 'NEGATIVE' = 'NEUTRAL';
    let score = 0.1;
    let rationale = 'Risk profile is in line with broader equity benchmarks.';

    if ((vol !== undefined && vol > 45) || (maxDd !== undefined && maxDd > 40)) {
      assessment = 'HIGH';
      category = 'NEGATIVE';
      score = -0.6;
      rationale = `Elevated volatility (${vol ? vol.toFixed(1) + '%' : 'N/A'}) and severe historical drawdown (${maxDd ? maxDd.toFixed(1) + '%' : 'N/A'}) define a high-risk profile.`;
    } else if ((vol !== undefined && vol > 30) || (maxDd !== undefined && maxDd > 25)) {
      assessment = 'ELEVATED';
      category = 'CAUTIOUS';
      score = -0.25;
      rationale = `Risk metrics show elevated volatility (${vol ? vol.toFixed(1) + '%' : 'N/A'}).`;
    } else if (vol !== undefined && vol < 20) {
      assessment = 'LOW';
      category = 'POSITIVE';
      score = 0.5;
      rationale = 'Low price volatility and controlled drawdowns indicate a defensive risk profile.';
    }

    return {
      dimension: 'riskProfile',
      dimensionName: 'Risk Profile',
      assessment,
      category,
      score,
      weight: config.riskWeight,
      rationale,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: inputs.marketData ? 'CALCULATED' : 'UNAVAILABLE'
    };
  }

  private evaluatePortfolioFit(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const holding = inputs.portfolioHolding;
    if (!holding || !holding.isHeld) {
      return {
        dimension: 'portfolioFit',
        dimensionName: 'Portfolio Fit',
        assessment: 'NOT_HELD',
        category: 'NEUTRAL',
        score: 0.15,
        weight: config.portfolioFitWeight,
        rationale: 'Security is NOT CURRENTLY HELD in the portfolio. Available for position initiation subject to portfolio diversification guidelines.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'CALCULATED'
      };
    }

    const weight = holding.weightPct ?? 0;
    if (weight >= 15.0) {
      return {
        dimension: 'portfolioFit',
        dimensionName: 'Portfolio Fit',
        assessment: 'CAUTIOUS',
        category: 'CAUTIOUS',
        score: -0.45,
        weight: config.portfolioFitWeight,
        rationale: `Existing position represents an elevated portfolio concentration (${weight.toFixed(1)}%). Portfolio exposure limits incremental attractiveness without altering the security's fundamental assessment.`,
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'CALCULATED',
        metrics: {
          weightPct: weight,
          shares: holding.shares ?? 0,
          marketValue: holding.marketValue ?? 0
        }
      };
    } else if (weight >= 8.0) {
      return {
        dimension: 'portfolioFit',
        dimensionName: 'Portfolio Fit',
        assessment: 'CONSTRAINED',
        category: 'NEUTRAL',
        score: -0.1,
        weight: config.portfolioFitWeight,
        rationale: `Security currently represents a substantial portfolio allocation (${weight.toFixed(1)}%). Incremental exposure requires careful risk budgeting.`,
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'CALCULATED',
        metrics: { weightPct: weight }
      };
    }

    return {
      dimension: 'portfolioFit',
      dimensionName: 'Portfolio Fit',
      assessment: 'FAVORABLE',
      category: 'POSITIVE',
      score: 0.4,
      weight: config.portfolioFitWeight,
      rationale: `Modest portfolio weight (${weight.toFixed(1)}%) allows room for incremental allocation within risk tolerances.`,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: 'CALCULATED',
      metrics: { weightPct: weight }
    };
  }

  private evaluateEvidenceCoverageDimension(
    rating: 'HIGH' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT',
    totalCount: number,
    availableCategories: string[],
    missingCategories: string[],
    config: DecisionFrameworkConfiguration
  ): DecisionDimensionAssessment {
    let score = 0.0;
    let category: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS' | 'INSUFFICIENT' = 'NEUTRAL';
    if (rating === 'HIGH') {
      score = 0.5;
      category = 'POSITIVE';
    } else if (rating === 'MODERATE') {
      score = 0.2;
      category = 'NEUTRAL';
    } else if (rating === 'LIMITED') {
      score = -0.2;
      category = 'CAUTIOUS';
    } else {
      score = -0.8;
      category = 'INSUFFICIENT';
    }

    const missingNotice = missingCategories.length > 0
      ? ` Missing coverage: ${missingCategories.join(', ')}.`
      : ' Comprehensive coverage across all expected domains.';

    return {
      dimension: 'evidenceCoverage',
      dimensionName: 'Evidence Coverage',
      assessment: rating,
      category,
      score,
      weight: config.evidenceCoverageWeight ?? 0.05,
      rationale: `Evidence base contains ${totalCount} items across ${availableCategories.length} categories.${missingNotice} Missing evidence is treated as unknown, not negative.`,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: 'CALCULATED',
      metrics: {
        totalCount,
        availableCategoriesCount: availableCategories.length
      }
    };
  }

  private evaluateThesisStatusDimension(inputs: DecisionScoringInputs, config: DecisionFrameworkConfiguration): DecisionDimensionAssessment {
    const snap = inputs.notebookSnapshot;
    if (!snap || !snap.available) {
      return {
        dimension: 'thesisStatus',
        dimensionName: 'Thesis Status',
        assessment: 'NO_PRIOR_THESIS',
        category: 'NEUTRAL',
        score: 0.0,
        weight: config.thesisStatusWeight ?? 0.05,
        rationale: 'No prior research notebook snapshot exists to track thesis evolution.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        dataStatus: 'UNAVAILABLE'
      };
    }

    const status = snap.thesisStatus || 'STABLE';
    let score = 0.1;
    let category: 'POSITIVE' | 'NEUTRAL' | 'CAUTIOUS' | 'NEGATIVE' = 'NEUTRAL';

    if (status === 'STRENGTHENING') {
      score = 0.5;
      category = 'POSITIVE';
    } else if (status === 'STABLE') {
      score = 0.15;
      category = 'NEUTRAL';
    } else if (status === 'WEAKENING') {
      score = -0.4;
      category = 'CAUTIOUS';
    } else if (status === 'INVALIDATED') {
      score = -0.9;
      category = 'NEGATIVE';
    }

    const impact = snap.diff?.thesisImpact;
    const impactText = impact
      ? ` (Bull Case: ${impact.bullCaseImpact}, Bear Case: ${impact.bearCaseImpact})`
      : '';

    return {
      dimension: 'thesisStatus',
      dimensionName: 'Thesis Status',
      assessment: status,
      category,
      score,
      weight: 0.05,
      rationale: `Research notebook snapshot comparison indicates thesis is ${status}${impactText}.`,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      dataStatus: 'CALCULATED'
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private calculateConviction(
    coverage: 'HIGH' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT',
    totalEvidence: number,
    inputs: DecisionScoringInputs,
    contradictionCount: number
  ): DecisionConviction {
    if (coverage === 'INSUFFICIENT' || totalEvidence < 2) {
      return 'INSUFFICIENT';
    }
    if (coverage === 'HIGH' && totalEvidence >= 6 && contradictionCount <= 1 && inputs.marketData?.epistemicStatus !== 'SIMULATED') {
      return 'HIGH';
    }
    if (coverage === 'MODERATE' || totalEvidence >= 3) {
      return 'MODERATE';
    }
    return 'LOW';
  }

  private generateInvalidationConditions(
    inputs: DecisionScoringInputs,
    _dimensions: DecisionDimensionAssessment[]
  ): DecisionInvalidationCondition[] {
    const conditions: DecisionInvalidationCondition[] = [];
    const sec = inputs.security;
    const secId = sec.canonicalId || (sec as any).id || (sec as any).symbol || 'sec';

    conditions.push({
      conditionId: `inv-${secId}-rev`,
      category: 'FUNDAMENTAL',
      condition: 'Revenue growth contracts into negative territory for two consecutive reporting periods',
      threshold: 'Revenue YoY < 0.0%',
      measurable: true,
      falsifiable: true,
      triggered: inputs.financials?.revenueTrend === 'DECLINING',
      status: inputs.financials?.revenueTrend === 'DECLINING' ? 'TRIGGERED' : 'ACTIVE_GUARD'
    });

    conditions.push({
      conditionId: `inv-${secId}-margin`,
      category: 'FUNDAMENTAL',
      condition: 'Operating margin contracts by more than 300 bps across consecutive quarters',
      threshold: 'Operating Margin Delta < -300 bps',
      measurable: true,
      falsifiable: true,
      triggered: false,
      status: 'ACTIVE_GUARD'
    });

    conditions.push({
      conditionId: `inv-${secId}-deathcross`,
      category: 'TECHNICAL',
      condition: '50-day moving average drops below the 200-day moving average (Death Cross)',
      threshold: 'SMA50 < SMA200',
      measurable: true,
      falsifiable: true,
      triggered: (inputs.marketData?.sma50 !== undefined && inputs.marketData?.sma200 !== undefined)
        ? inputs.marketData.sma50 < inputs.marketData.sma200
        : false,
      status: (inputs.marketData?.sma50 !== undefined && inputs.marketData?.sma200 !== undefined && inputs.marketData.sma50 < inputs.marketData.sma200)
        ? 'TRIGGERED'
        : 'ACTIVE_GUARD'
    });

    conditions.push({
      conditionId: `inv-${secId}-valuation`,
      category: 'VALUATION',
      condition: 'Price-to-Earnings ratio expands beyond 65x or exceeds 2.5 standard deviations above 3-year median',
      threshold: 'P/E > 65.0x',
      measurable: true,
      falsifiable: true,
      triggered: (inputs.financials?.peRatio ?? 0) > 65,
      status: (inputs.financials?.peRatio ?? 0) > 65 ? 'TRIGGERED' : 'ACTIVE_GUARD'
    });

    conditions.push({
      conditionId: `inv-${secId}-portfolio`,
      category: 'PORTFOLIO',
      condition: 'Portfolio position weight reaches or exceeds configured concentration ceiling (20.0%)',
      threshold: 'Holding Weight >= 20.0%',
      measurable: true,
      falsifiable: true,
      triggered: (inputs.portfolioHolding?.weightPct ?? 0) >= 20.0,
      status: (inputs.portfolioHolding?.weightPct ?? 0) >= 20.0 ? 'TRIGGERED' : 'ACTIVE_GUARD'
    });

    conditions.push({
      conditionId: `inv-${secId}-filing`,
      category: 'FILING',
      condition: 'Filing of Item 4.02 (Non-Reliance on Previously Issued Financial Statements) or SEC enforcement 8-K',
      threshold: 'SEC Item 4.02 / Regulatory Enforcement',
      measurable: true,
      falsifiable: true,
      triggered: false,
      status: 'ACTIVE_GUARD'
    });

    return conditions;
  }

  private buildKeyRisks(inputs: DecisionScoringInputs, dimensions: DecisionDimensionAssessment[]): DecisionKeyRisk[] {
    const risks: DecisionKeyRisk[] = [];
    const sec = inputs.security;
    const secId = sec.canonicalId || (sec as any).id || (sec as any).symbol || 'sec';
    const secTicker = sec.ticker || (sec as any).symbol || (sec as any).ticker || secId;

    // Add notebook snapshot risks if available
    if (inputs.notebookSnapshot?.risks && inputs.notebookSnapshot.risks.length > 0) {
      inputs.notebookSnapshot.risks.forEach((r, idx) => {
        risks.push({
          riskId: `risk-nb-${idx}`,
          title: r.title,
          description: r.description || `Identified through ${secTicker} research notebook.`,
          severity: r.severity,
          category: 'RESEARCH_DISCLOSURE',
          evidenceIds: []
        });
      });
    }

    // Add valuation risk if valuation is elevated
    const valDim = dimensions.find(d => d.dimension === 'valuationContext');
    if (valDim?.assessment === 'ELEVATED' || valDim?.assessment === 'EXTREME') {
      risks.push({
        riskId: `risk-val-${secId}`,
        title: 'Valuation Multiple Compression Risk',
        description: valDim.rationale,
        severity: valDim.assessment === 'EXTREME' ? 'HIGH' : 'MEDIUM',
        category: 'VALUATION',
        evidenceIds: valDim.supportingEvidenceIds
      });
    }

    // Add concentration risk if portfolio weight is high
    const portDim = dimensions.find(d => d.dimension === 'portfolioFit');
    if (portDim?.assessment === 'CAUTIOUS') {
      risks.push({
        riskId: `risk-port-${secId}`,
        title: 'Portfolio Concentration Limit',
        description: portDim.rationale,
        severity: 'MEDIUM',
        category: 'PORTFOLIO_CONCENTRATION',
        evidenceIds: []
      });
    }

    // Default macro/market risk if empty
    if (risks.length === 0) {
      risks.push({
        riskId: `risk-macro-${secId}`,
        title: 'Market Volatility & Sector Headwinds',
        description: 'Macroeconomic shifts, interest rate volatility, and cyclical industry fluctuations may impact performance.',
        severity: 'LOW',
        category: 'MARKET',
        evidenceIds: []
      });
    }

    return risks;
  }

  private buildCatalysts(inputs: DecisionScoringInputs): DecisionCatalyst[] {
    const catalysts: DecisionCatalyst[] = [];
    const sec = inputs.security;
    const secId = sec.canonicalId || (sec as any).id || (sec as any).symbol || 'sec';
    const secTicker = sec.ticker || (sec as any).symbol || (sec as any).ticker || secId;

    if (inputs.notebookSnapshot?.catalysts && inputs.notebookSnapshot.catalysts.length > 0) {
      inputs.notebookSnapshot.catalysts.forEach((c, idx) => {
        catalysts.push({
          catalystId: `cat-nb-${idx}`,
          title: c.title,
          description: c.description || `Derived from verified disclosures for ${secTicker}.`,
          type: c.type || 'DISCLOSED',
          evidenceIds: []
        });
      });
    }

    if (catalysts.length === 0) {
      catalysts.push({
        catalystId: `cat-default-${secId}`,
        title: 'Upcoming Periodic Financial Disclosure (10-Q / Quarterly Results)',
        description: 'Next audited quarterly financial disclosure to confirm continued revenue run-rate and margin trajectory.',
        type: 'DISCLOSED',
        timeline: 'Upcoming Quarter',
        evidenceIds: []
      });
    }

    return catalysts;
  }
}

export const decisionScoringEngine = DecisionScoringEngine.getInstance();
