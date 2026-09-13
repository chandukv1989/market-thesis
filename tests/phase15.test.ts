/**
 * PHASE 15 — INVESTMENT DECISION INTELLIGENCE TEST SUITE
 * 
 * Comprehensive functional verification of:
 * 1. Deterministic Decision Engine (Strict reproducibility without LLM math)
 * 2. 10 Dimension Assessment Coverage (Fundamentals, Growth, Valuation, Trend, Quant, Backtest, Risk, Portfolio Fit, Evidence, Thesis)
 * 3. Point-in-Time (PIT) Discipline (No lookahead bias, strict date boundaries)
 * 4. Falsifiable Invalidation Conditions (Observable, measurable guards)
 * 5. Portfolio Fit & Concentration Handling (Sizing impact without distorting fundamental score)
 * 6. Conviction & Epistemic Uncertainty Mapping (Evidence density + dispersion)
 * 7. Gemini Fallback & Explanation Engine (Deterministic fallback under 429 / missing key)
 * 8. Comparative Security Evaluation (Side-by-side deterministic dimension diffs)
 * 9. Epistemic Provenance Preservation (REAL, CALCULATED, SIMULATED, UNAVAILABLE)
 * 10. Analytical-Only & Execution Prohibition Safeguards (isAnalyticalOnly, executionProhibited, disclaimers)
 */

import { decisionScoringEngine } from '../server/services/decision/decisionScoringEngine';
import { decisionIntelligenceService } from '../server/services/decision/decisionIntelligenceService';
import { decisionExplanationEngine } from '../server/services/decision/decisionExplanationEngine';
import { DEFAULT_DECISION_CONFIG } from '../server/services/decision/defaultConfig';
import { resolveSecurity } from '../src/data/canonicalSecurities';
import { InvestmentDecisionAssessment, SecurityDecisionComparison } from '../src/types';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('PHASE 15: INVESTMENT DECISION INTELLIGENCE FUNCTIONAL TESTS');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // 1. DETERMINISTIC SCORING ENGINE REPRODUCIBILITY
  // -------------------------------------------------------------
  console.log('[SECTION 1] Deterministic Reproducibility & Scoring Math');

  const nvdaSec = resolveSecurity('NVDA')!;
  assert(!!nvdaSec, 'Canonical security NVDA resolved successfully');

  const mockInputsA = {
    security: nvdaSec,
    asOfDate: '2026-06-30',
    config: DEFAULT_DECISION_CONFIG,
    financials: {
      hasData: true,
      revenueTrend: 'GROWING' as const,
      operatingMarginTrend: 'EXPANDING' as const,
      netIncomeTrend: 'GROWING' as const,
      operatingCashFlowTrend: 'POSITIVE' as const,
      periodsCount: 8,
      peRatio: 45.0,
      priceToSales: 24.0,
      evidenceIds: ['ev-fin-1', 'ev-fin-2'],
      isRealSecData: true
    },
    marketData: {
      currentPrice: 120.5,
      currency: 'USD',
      bars: [
        { timestamp: '2026-06-28', open: 118, high: 121, low: 117, close: 120.5, volume: 1000000 }
      ],
      provider: 'Twelve Data',
      epistemicStatus: 'REAL' as const,
      sma50: 110.0,
      sma200: 95.0,
      momentum: 12.5,
      volatility: 30.0,
      maxDrawdown: 15.0
    },
    quantSignals: [
      {
        strategyId: 'trend_follow',
        strategyName: 'Moving Average Crossover',
        signal: 'BUY' as const,
        indicatorValues: { smaFast: 110, smaSlow: 95 },
        signalTimestamp: '2026-06-28',
        epistemicStatus: 'CALCULATED' as const
      }
    ],
    backtestMetrics: {
      available: true,
      strategyName: 'Moving Average Benchmark',
      sharpeRatio: 1.45,
      cagr: 22.0,
      maxDrawdown: 18.0,
      winRate: 62.0,
      profitFactor: 2.1
    },
    portfolioHolding: {
      isHeld: true,
      weightPct: 8.5,
      shares: 100,
      marketValue: 12050,
      unrealizedPnLPct: 35.0,
      portfolioBetaContribution: 0.18,
      sectorWeightPct: 18.0
    },
    researchEvidence: [
      {
        evidenceId: 'ev-1',
        securityId: 'US:NVDA',
        sourceType: 'OFFICIAL_FILINGS' as const,
        title: 'Form 10-Q Q2 2026',
        sourceName: 'SEC EDGAR',
        publicationDate: '2026-06-15',
        extractedText: 'Data center revenue accelerated 85% year over year.',
        confidence: 0.95,
        epistemicStatus: 'REAL' as const,
        createdAt: '2026-06-15T10:00:00Z'
      }
    ],
    notebookSnapshot: {
      available: true,
      notebookId: 'nb-nvda-1',
      snapshotId: 'snap-nvda-1',
      thesisStatus: 'STABLE' as const,
      bullCasePoints: ['Leading AI compute architecture with sustained gross margins'],
      bearCasePoints: ['Customer capex deceleration or hyperscaler custom ASICs'],
      risks: [{ title: 'Geopolitical export restriction', severity: 'HIGH' as const, description: 'Restrictions on advanced chip shipments.' }],
      catalysts: [{ title: 'Next-gen architecture launch', type: 'DISCLOSED' as const, description: 'Commercial ramp in H2 2026.' }]
    },
    providerStatuses: { 'SEC EDGAR': 'UP', 'Twelve Data': 'UP' }
  };

  const evalRun1 = decisionScoringEngine.evaluate(mockInputsA);
  const evalRun2 = decisionScoringEngine.evaluate(mockInputsA);

  assert(evalRun1.compositeScore === evalRun2.compositeScore, 'Scoring engine is strictly deterministic: composite scores match exactly');
  assert(evalRun1.overallAssessment === evalRun2.overallAssessment, 'Overall classification matches identically across runs');
  assert(evalRun1.conviction === evalRun2.conviction, 'Conviction matches identically across runs');
  assert(evalRun1.dimensionsList.length === 10, 'Evaluates all 10 distinct analytical dimensions');
  assert(evalRun1.invalidationConditions.length >= 3, 'Produces multiple falsifiable thesis invalidation conditions');

  // -------------------------------------------------------------
  // 2. 10 DIMENSION VERIFICATION & BOUNDS
  // -------------------------------------------------------------
  console.log('\n[SECTION 2] Dimension Score Integrity & Weights');

  const expectedDimensions = [
    'fundamentalQuality',
    'growthTrend',
    'valuationContext',
    'marketTrend',
    'quantitativeSignal',
    'backtestContext',
    'riskProfile',
    'portfolioFit',
    'evidenceCoverage',
    'thesisStatus'
  ];

  for (const dimKey of expectedDimensions) {
    const dim = evalRun1.dimensionAssessments[dimKey as any];
    assert(dim !== undefined, `Dimension '${dimKey}' exists in assessment output`);
    assert(dim.score >= 0 && dim.score <= 1.0, `Dimension '${dimKey}' score ${dim.score} is bounded in [0, 1]`);
    assert(dim.weight > 0 && dim.weight <= 1.0, `Dimension '${dimKey}' has positive weighting ${dim.weight}`);
    assert(dim.rationale.length > 10, `Dimension '${dimKey}' provides descriptive rationale`);
    assert(!!dim.dataStatus, `Dimension '${dimKey}' declares epistemic data status: ${dim.dataStatus}`);
  }

  const totalWeight = evalRun1.dimensionsList.reduce((sum, d) => sum + d.weight, 0);
  assert(Math.abs(totalWeight - 1.0) < 0.001, `Dimension weights sum to 1.0 (actual: ${totalWeight})`);

  // -------------------------------------------------------------
  // 3. THRESHOLD INTEGRITY & CLASSIFICATIONS
  // -------------------------------------------------------------
  console.log('\n[SECTION 3] Decision Classification Thresholds');

  // Check that positive setup classifies as POSITIVE or CONSTRUCTIVE
  assert(
    evalRun1.overallAssessment === 'POSITIVE' || evalRun1.overallAssessment === 'CONSTRUCTIVE',
    `High-quality setup produces POSITIVE or CONSTRUCTIVE assessment (got ${evalRun1.overallAssessment})`
  );

  // Test missing data degrades to INSUFFICIENT_EVIDENCE
  const emptyInputs = {
    security: nvdaSec,
    asOfDate: '2026-06-30',
    config: DEFAULT_DECISION_CONFIG,
    researchEvidence: [],
    providerStatuses: {}
  };
  const emptyEval = decisionScoringEngine.evaluate(emptyInputs);
  assert(
    emptyEval.overallAssessment === 'INSUFFICIENT_EVIDENCE',
    `Missing research evidence correctly triggers INSUFFICIENT_EVIDENCE (got: ${emptyEval.overallAssessment})`
  );
  assert(emptyEval.conviction === 'INSUFFICIENT', `Empty evidence yields INSUFFICIENT conviction (got: ${emptyEval.conviction})`);

  // -------------------------------------------------------------
  // 4. FALSIFIABLE THESIS INVALIDATION SAFEGUARDS
  // -------------------------------------------------------------
  console.log('\n[SECTION 4] Falsifiable Invalidation Conditions');

  const conditions = evalRun1.invalidationConditions;
  assert(conditions.length >= 4, `Generated ${conditions.length} distinct invalidation conditions`);
  for (const cond of conditions) {
    assert(!!cond.conditionId, `Condition has ID: ${cond.conditionId}`);
    assert(!!cond.condition, `Condition statement is defined: "${cond.condition}"`);
    assert(cond.status === 'ACTIVE_GUARD' || cond.status === 'TRIGGERED', `Condition status valid: ${cond.status}`);
    assert(!!cond.threshold, `Condition has measurable threshold: "${cond.threshold}"`);
  }

  // Verify that an invalidation condition gets TRIGGERED when violated
  const deterioratingInputs = {
    ...mockInputsA,
    financials: {
      ...mockInputsA.financials,
      revenueTrend: 'DECLINING' as const,
      netIncomeTrend: 'DECLINING' as const
    },
    marketData: {
      ...mockInputsA.marketData,
      currentPrice: 80.0,
      sma50: 90.0,
      sma200: 95.0, // price < sma200 -> breach
      maxDrawdown: 35.0
    }
  };
  const detEval = decisionScoringEngine.evaluate(deterioratingInputs);
  const breached = detEval.invalidationConditions.filter(c => c.status === 'TRIGGERED');
  assert(breached.length > 0, `Deteriorating fundamentals/technicals trigger invalidation breach (${breached.length} breached)`);
  assert(detEval.compositeScore < evalRun1.compositeScore, `Deteriorating inputs lower composite score (${detEval.compositeScore} < ${evalRun1.compositeScore})`);

  // -------------------------------------------------------------
  // 5. PORTFOLIO CONTEXT & SIZING DISCIPLINE
  // -------------------------------------------------------------
  console.log('\n[SECTION 5] Portfolio Fit & Concentration Constraints');

  // Test overconcentrated position
  const overConcentratedInputs = {
    ...mockInputsA,
    portfolioHolding: {
      isHeld: true,
      weightPct: 22.0, // High concentration > 15%
      shares: 300,
      marketValue: 36150,
      unrealizedPnLPct: 80.0,
      portfolioBetaContribution: 0.42,
      sectorWeightPct: 35.0
    }
  };
  const overConcEval = decisionScoringEngine.evaluate(overConcentratedInputs);
  const portFit = overConcEval.dimensionAssessments.portfolioFit;
  assert(portFit.category === 'CAUTIOUS', `High portfolio concentration (22%) results in CAUTIOUS portfolio fit category (got ${portFit.category})`);
  assert(overConcEval.portfolioContext.marginalRiskRating === 'HIGH_CONCENTRATION', 'Portfolio context flags HIGH_CONCENTRATION');
  assert(
    overConcEval.portfolioContext.implication.toLowerCase().includes('trim') ||
    overConcEval.portfolioContext.implication.toLowerCase().includes('cautious') ||
    overConcEval.portfolioContext.implication.toLowerCase().includes('rebalance') ||
    overConcEval.portfolioContext.implication.toLowerCase().includes('concentration'),
    'Implication suggests sizing caution or rebalancing discipline'
  );

  // Fundamental quality must remain untouched by portfolio holding status
  assert(
    overConcEval.dimensionAssessments.fundamentalQuality.score === evalRun1.dimensionAssessments.fundamentalQuality.score,
    'Portfolio concentration does NOT corrupt intrinsic fundamental quality score'
  );

  // -------------------------------------------------------------
  // 6. GEMINI FALLBACK & EXPLANATION ENGINE
  // -------------------------------------------------------------
  console.log('\n[SECTION 6] Explanation Engine & Graceful Fallback');

  const deterministicFallback = decisionExplanationEngine.generateDeterministicFallback(evalRun1);
  assert(deterministicFallback.generatedBy === 'DETERMINISTIC_FALLBACK', 'Fallback engine explicitly flags generatedBy: DETERMINISTIC_FALLBACK');
  assert(deterministicFallback.summary.length > 20, 'Generates comprehensive deterministic executive summary');
  assert(deterministicFallback.whyDrivers.length > 0, 'Includes key analytical drivers in fallback');
  assert(deterministicFallback.counterEvidence.length > 0, 'Includes counter-evidence in fallback');
  assert(
    deterministicFallback.disclaimer.includes('Past simulated performance does not guarantee future results'),
    'Fallback includes mandatory historical performance disclaimer'
  );

  // Full enrich call should return clean explanation even with Gemini errors or missing keys
  const enriched = await decisionExplanationEngine.enrichExplanation(evalRun1);
  assert(!!enriched.summary, 'Explanation engine returned valid summary');
  assert(enriched.disclaimer.includes('Past simulated performance'), 'Explanation includes institutional disclaimer');

  // -------------------------------------------------------------
  // 7. POINT-IN-TIME (PIT) DISCIPLINE
  // -------------------------------------------------------------
  console.log('\n[SECTION 7] Point-in-Time Discipline');

  const historicalDate = '2024-01-15';
  const pitAssessment = await decisionIntelligenceService.evaluateDecision({
    securityId: 'NVDA',
    asOfDate: historicalDate,
    forceRefresh: true
  });
  assert(pitAssessment.asOfDate === historicalDate, `Assessment honors requested historical asOfDate: ${historicalDate}`);
  assert(pitAssessment.canonicalSecurity.ticker === 'NVDA', 'Assessment resolves canonical security');
  assert(pitAssessment.compositeScore >= 0 && pitAssessment.compositeScore <= 1.0, 'Historical assessment composite score is valid');

  // -------------------------------------------------------------
  // 8. SECURITY COMPARISON ENGINE
  // -------------------------------------------------------------
  console.log('\n[SECTION 8] Side-by-Side Security Comparison');

  const comparison = await decisionIntelligenceService.compareDecisions({
    securityIdA: 'NVDA',
    securityIdB: 'MSFT',
    asOfDate: '2026-06-30'
  });

  assert(comparison.securityA.canonicalSecurity.ticker === 'NVDA', 'Comparison security A is NVDA');
  assert(comparison.securityB.canonicalSecurity.ticker === 'MSFT', 'Comparison security B is MSFT');
  assert(comparison.dimensionComparisons.length === 10, 'Compares all 10 dimensions side-by-side');
  assert(
    ['SECURITY_A', 'SECURITY_B', 'BALANCED', 'INSUFFICIENT_EVIDENCE'].includes(comparison.overallAdvantage),
    `Overall comparison advantage is valid (${comparison.overallAdvantage})`
  );
  assert(comparison.isAnalyticalOnly === true, 'Comparison flags isAnalyticalOnly: true');
  assert(comparison.executionProhibited === true, 'Comparison flags executionProhibited: true');

  // -------------------------------------------------------------
  // 9. CROSS-MARKET COVERAGE (US & INDIA)
  // -------------------------------------------------------------
  console.log('\n[SECTION 9] Cross-Market Security Coverage');

  const relianceSec = resolveSecurity('RELIANCE');
  assert(!!relianceSec, 'Indian canonical security RELIANCE resolved');
  assert(relianceSec!.market === 'INDIA', 'RELIANCE identified as Indian equity');
  assert(relianceSec!.currency === 'INR', 'RELIANCE uses INR currency');

  const relianceAssessment = await decisionIntelligenceService.evaluateDecision({
    securityId: 'RELIANCE',
    forceRefresh: true
  });
  assert(relianceAssessment.canonicalSecurity.ticker === 'RELIANCE', 'Evaluated RELIANCE assessment');
  assert(relianceAssessment.canonicalSecurity.currency === 'INR', 'RELIANCE assessment preserves INR currency');
  assert(relianceAssessment.dimensionAssessments.fundamentalQuality !== undefined, 'Evaluated Indian security fundamental quality');

  // -------------------------------------------------------------
  // 10. COMPREHENSIVE SAFEGUARDS & AUDIT INTEGRITY
  // -------------------------------------------------------------
  console.log('\n[SECTION 10] Regulatory Safeguards & Audit Trails');

  assert(evalRun1.isAnalyticalOnly === true, 'Assessment enforces isAnalyticalOnly: true');
  assert(evalRun1.executionProhibited === true, 'Assessment enforces executionProhibited: true');
  assert(
    evalRun1.explanation.disclaimer.includes('Past simulated performance does not guarantee future results'),
    'Disclaimer contains exact regulatory past performance wording'
  );
  assert(
    evalRun1.explanation.disclaimer.includes('purely analytical and does not constitute financial advice'),
    'Disclaimer contains advisory prohibition wording'
  );
  assert(!!evalRun1.decisionId, `Assessment has unique decision ID: ${evalRun1.decisionId}`);
  assert(evalRun1.frameworkVersion === '1.0.0', 'Assessment logs framework version 1.0.0');

  console.log('\n===============================================================');
  console.log(`PHASE 15 TEST SUITE COMPLETED: ${passedCount}/${testCount} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTests().catch(err => {
  console.error('\nTest execution failed:', err);
  process.exit(1);
});
