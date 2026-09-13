/**
 * PHASE 9 — PORTFOLIO INTELLIGENCE & DETERMINISTIC ANALYTICS TEST SUITE
 * 
 * Verifies:
 * 1. Deterministic concentration & Herfindahl-Hirschman Index (HHI)
 * 2. Weight reconciliation and top-N concentration invariants
 * 3. Covariance matrix and correlation matrix computation
 * 4. Factor-based beta and risk contribution calculations
 * 5. Peak value and drawdown tracking (with UNAVAILABLE fallback)
 * 6. Strict cross-currency segregation (USD vs INR isolation)
 * 7. PortfolioEvidenceAdapter transformation to EvidenceItem contracts
 * 8. Epistemic status enforcement (all calculated metrics marked CALCULATED)
 * 9. PortfolioIntelligenceService intent classification and deterministic grounding
 * 10. Causality guardrail and uncertainty notices
 */

import {
  HoldingPosition,
  Stock,
  PortfolioMetrics,
  PortfolioCalculationOptions
} from '../src/types';
import {
  calculateHerfindahlHirschmanIndex,
  calculateCovarianceMatrix,
  calculateFactorRiskContributions,
  calculateDrawdown,
  computePortfolioMetrics,
  DEFAULT_HOLDING_POSITIONS,
  derivePortfolio
} from '../src/state/portfolioEngine';
import { CANONICAL_SECURITIES_MAP } from '../src/data/mockData';
import { portfolioEvidenceAdapter } from '../server/services/evidence/adapters/portfolioEvidenceAdapter';
import { portfolioIntelligenceService } from '../server/services/portfolio/portfolioIntelligenceService';

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

async function runPhase9Tests() {
  console.log('======================================================================');
  console.log(' RUNNING PHASE 9 PORTFOLIO INTELLIGENCE TEST SUITE');
  console.log('======================================================================\n');

  // ==========================================
  // TEST 1: HERFINDAHL-HIRSCHMAN INDEX (HHI)
  // ==========================================
  console.log('--- TEST 1: Deterministic Concentration & HHI Math ---');

  // 1A. Single asset portfolio (100% in one stock) -> HHI = 10,000, HHI norm = 1.0
  const singleAsset = calculateHerfindahlHirschmanIndex([100]);
  assert(singleAsset.hhi === 10000, `Single asset HHI should be 10000, got ${singleAsset.hhi}`);
  assert(singleAsset.hhiNormalized === 1.0, `Single asset normalized HHI should be 1.0, got ${singleAsset.hhiNormalized}`);

  // 1B. Perfectly diversified equal-weighted portfolio (10 assets @ 10% each) -> HHI = 1,000
  const tenEqualAssets = calculateHerfindahlHirschmanIndex([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  assert(tenEqualAssets.hhi === 1000, `10 equal assets HHI should be 1000, got ${tenEqualAssets.hhi}`);
  assert(tenEqualAssets.hhiNormalized === 0.1, `10 equal assets normalized HHI should be 0.1, got ${tenEqualAssets.hhiNormalized}`);

  // 1C. 4 equal assets @ 25% each -> HHI = 2,500
  const fourEqualAssets = calculateHerfindahlHirschmanIndex([25, 25, 25, 25]);
  assert(fourEqualAssets.hhi === 2500, `4 equal assets HHI should be 2500, got ${fourEqualAssets.hhi}`);

  // 1D. Empty array handling -> HHI = 0
  const emptyHhi = calculateHerfindahlHirschmanIndex([]);
  assert(emptyHhi.hhi === 0 && emptyHhi.hhiNormalized === 0, 'Empty weights yield HHI = 0');

  // ==========================================
  // TEST 2: COVARIANCE & CORRELATION MATRIX
  // ==========================================
  console.log('\n--- TEST 2: Covariance & Correlation Matrix Computations ---');

  // Two assets across 4 periods
  // Asset 1 returns: [0.01, 0.02, -0.01, 0.04]
  // Asset 2 returns: [0.02, 0.03, -0.02, 0.05] (strongly positively correlated)
  const returnsMatrix = [
    [0.01, 0.02, -0.01, 0.04],
    [0.02, 0.03, -0.02, 0.05]
  ];

  const covResult = calculateCovarianceMatrix(returnsMatrix);
  assert(covResult.covarianceMatrix.length === 2, 'Covariance matrix dimensions are 2x2');
  assert(covResult.correlationMatrix.length === 2, 'Correlation matrix dimensions are 2x2');

  // Symmetry: Cov(1,2) == Cov(2,1)
  assert(
    Math.abs(covResult.covarianceMatrix[0][1] - covResult.covarianceMatrix[1][0]) < 1e-9,
    'Covariance matrix is symmetric (Cov[0,1] == Cov[1,0])'
  );

  // Correlation diagonal should be 1.0
  assert(
    Math.abs(covResult.correlationMatrix[0][0] - 1.0) < 1e-6 &&
    Math.abs(covResult.correlationMatrix[1][1] - 1.0) < 1e-6,
    'Correlation matrix diagonals equal 1.0'
  );

  // High correlation check
  assert(
    covResult.correlationMatrix[0][1] > 0.95,
    `Correlation between correlated assets is >0.95 (got ${covResult.correlationMatrix[0][1].toFixed(4)})`
  );

  // Minimum observation check (should throw if <2 observations)
  let threwExpected = false;
  try {
    calculateCovarianceMatrix([[0.05], [0.02]]);
  } catch (err) {
    threwExpected = true;
  }
  assert(threwExpected, 'Covariance calculation throws error when fewer than 2 periods provided');

  // ==========================================
  // TEST 3: FACTOR BETA & RISK CONTRIBUTIONS
  // ==========================================
  console.log('\n--- TEST 3: Factor Beta & Risk Contributions ---');

  const weights = [0.4, 0.4, 0.2]; // Sum = 1.0
  const betas = [1.5, 1.0, 0.0];   // Asset 3 is cash (beta = 0.0)
  const riskResult = calculateFactorRiskContributions(weights, betas);

  // Expected portfolio beta: 0.4 * 1.5 + 0.4 * 1.0 + 0.2 * 0.0 = 0.6 + 0.4 + 0.0 = 1.0
  assert(riskResult.portfolioBeta === 1.0, `Weighted beta sum should equal 1.0, got ${riskResult.portfolioBeta}`);

  // Sum of percentage risk contributions must reconcile to 100%
  const sumRiskPct = riskResult.percentageRiskContribution.reduce((a, b) => a + b, 0);
  assert(
    Math.abs(sumRiskPct - 100.0) < 0.01,
    `Risk contributions sum to 100% (got ${sumRiskPct.toFixed(2)}%)`
  );

  // Cash asset (beta 0) has 0% risk contribution
  assert(
    riskResult.percentageRiskContribution[2] === 0,
    'Zero-beta cash equivalent contributes 0% to systematic factor risk'
  );

  // ==========================================
  // TEST 4: PEAK VALUE & DRAWDOWN
  // ==========================================
  console.log('\n--- TEST 4: Drawdown & Peak Value Tracking ---');

  // Series with known peak 100 -> drop to 80 (-20%) -> recover to 90 (-10% from peak)
  const navSeries = [90, 95, 100, 80, 85, 90];
  const ddResult = calculateDrawdown(navSeries);

  assert(ddResult.status === 'CALCULATED', 'Drawdown status is CALCULATED when NAV series present');
  assert(ddResult.peak === 100, `Peak portfolio value is 100, got ${ddResult.peak}`);
  assert(ddResult.maxDrawdownPct === -20, `Max drawdown is -20%, got ${ddResult.maxDrawdownPct}%`);
  assert(ddResult.currentDrawdownPct === -10, `Current drawdown is -10%, got ${ddResult.currentDrawdownPct}%`);

  // Insufficient series -> UNAVAILABLE status
  const emptyDd = calculateDrawdown([]);
  assert(emptyDd.status === 'UNAVAILABLE', 'Drawdown status is UNAVAILABLE when series missing');
  assert(emptyDd.peak === null && emptyDd.maxDrawdownPct === null, 'Drawdown values are null when UNAVAILABLE');

  // ==========================================
  // TEST 5: FULL PORTFOLIO METRICS DERIVATION
  // ==========================================
  console.log('\n--- TEST 5: Full PortfolioMetrics Reconciled Derivation ---');

  const testPositions: HoldingPosition[] = [
    { ticker: 'NVDA', shares: 100, avgCost: 100, name: 'NVIDIA Corporation', sector: 'Technology' },
    { ticker: 'MSFT', shares: 50, avgCost: 300, name: 'Microsoft Corporation', sector: 'Technology' },
    { ticker: 'JPM', shares: 100, avgCost: 150, name: 'JPMorgan Chase', sector: 'Financial Services' },
    { ticker: 'USD-CASH', shares: 1, avgCost: 10000, name: 'Cash', sector: 'Fixed Income & Cash', isCashEquivalent: true }
  ];

  const metrics = computePortfolioMetrics(testPositions, CANONICAL_SECURITIES_MAP, { baseCurrency: 'USD' });

  assert(metrics.portfolioId.length > 0, 'PortfolioMetrics has valid portfolioId');
  assert(metrics.baseCurrency === 'USD', 'Base currency is USD');
  assert(metrics.weightsReconciled === true, 'Weights reconciliation flag is true');
  assert(Math.abs(metrics.sumWeights - 100.0) < 0.01, `Sum of weights is 100% (got ${metrics.sumWeights}%)`);
  assert(metrics.positions.length === 4, `4 positions evaluated (got ${metrics.positions.length})`);

  // Concentration checks
  assert(metrics.concentration.status === 'CALCULATED', 'Concentration status is CALCULATED');
  assert(metrics.concentration.top1WeightPct > 0, 'Top 1 weight is greater than 0');
  assert(metrics.concentration.top5WeightPct >= metrics.concentration.top1WeightPct, 'Top 5 weight >= Top 1 weight');
  assert(metrics.concentration.herfindahlHirschmanIndex > 0, 'HHI is calculated and > 0');

  // Performance analytics checks
  assert(metrics.performance.dailyPnL.status === 'CALCULATED', 'Daily P&L is CALCULATED');
  assert(metrics.performance.unrealizedPnL.status === 'CALCULATED', 'Unrealized P&L is CALCULATED');
  assert(metrics.performance.return1W.status === 'UNAVAILABLE', '1-week return is UNAVAILABLE without historical bars');

  // Risk analytics checks
  assert(metrics.risk.portfolioBeta.status === 'CALCULATED', 'Portfolio Beta is CALCULATED');
  assert(metrics.risk.portfolioBeta.value !== null && metrics.risk.portfolioBeta.value > 0, 'Portfolio beta has non-null positive value');

  // ==========================================
  // TEST 6: CROSS-CURRENCY SEGREGATION (USD vs INR)
  // ==========================================
  console.log('\n--- TEST 6: Strict Cross-Currency Segregation ---');

  const multiCurrencyPositions: HoldingPosition[] = [
    { ticker: 'NVDA', shares: 100, avgCost: 100, currency: 'USD', market: 'US' },
    { ticker: 'RELIANCE', shares: 100, avgCost: 2900, currency: 'INR', market: 'INDIA' },
    { ticker: 'TCS', shares: 50, avgCost: 3800, currency: 'INR', market: 'INDIA' }
  ];

  const segregatedMetrics = computePortfolioMetrics(multiCurrencyPositions, CANONICAL_SECURITIES_MAP, { baseCurrency: 'USD' });
  assert(segregatedMetrics.isCrossCurrencySegregated === true, 'Foreign INR positions are flagged as segregated');
  assert(segregatedMetrics.segregatedBuckets !== undefined, 'Segregated buckets container exists');
  assert(segregatedMetrics.segregatedBuckets!['INR'] !== undefined, 'INR bucket exists in segregated buckets');
  assert(segregatedMetrics.segregatedBuckets!['INR'].positions.length === 2, 'INR bucket contains exactly 2 Indian positions');
  assert(segregatedMetrics.positions.length === 1, 'Base USD portfolio contains only the USD position (NVDA)');

  // Ensure INR values are not arbitrarily blended into USD NAV
  const usdValue = segregatedMetrics.totalValue;
  const nvdaPrice = CANONICAL_SECURITIES_MAP['NVDA'] ? CANONICAL_SECURITIES_MAP['NVDA'].price : 100;
  assert(
    Math.abs(usdValue - 100 * nvdaPrice) < 1.0,
    `USD NAV ($${usdValue}) reflects only USD assets without synthetic INR mixing`
  );

  // ==========================================
  // TEST 7: PORTFOLIO EVIDENCE ADAPTER
  // ==========================================
  console.log('\n--- TEST 7: Portfolio Evidence Adapter & Epistemic Status ---');

  const evidenceItems = portfolioEvidenceAdapter.transformPortfolioMetrics(metrics);
  assert(evidenceItems.length > 0, `Generated ${evidenceItems.length} EvidenceItem objects from PortfolioMetrics`);

  // All generated items must have epistemicStatus === 'CALCULATED'
  const allCalculated = evidenceItems.every(item => item.epistemicStatus === 'CALCULATED');
  assert(allCalculated, 'All generated portfolio evidence items are classified as CALCULATED');

  // Verify specific evidence concept keys or IDs exist
  const conceptKeys = evidenceItems.map(item => item.conceptKey || item.evidenceId);
  assert(conceptKeys.some(k => k.includes(':weights') || k.includes('weight')), 'Contains weights evidence item');
  assert(conceptKeys.some(k => k.includes(':concentration') || k.includes('concentration')), 'Contains concentration evidence item');
  assert(conceptKeys.some(k => k.includes(':risk_beta') || k.includes('risk') || k.includes('beta')), 'Contains risk beta evidence item');
  assert(conceptKeys.some(k => k.includes(':sectors') || k.includes('sector')), 'Contains sector exposure evidence item');

  // Verify provenance and source type
  const allPortfolioSource = evidenceItems.every(item => item.sourceType === 'PORTFOLIO');
  assert(allPortfolioSource, 'All items have sourceType === PORTFOLIO');

  // ==========================================
  // TEST 8: PORTFOLIO INTELLIGENCE SERVICE INTENTS
  // ==========================================
  console.log('\n--- TEST 8: Portfolio Intelligence Service Intent Classification ---');

  const intentAttribution = portfolioIntelligenceService.classifyIntent("What drove today's P&L?");
  assert(intentAttribution === 'PERFORMANCE', `Classified as PERFORMANCE, got ${intentAttribution}`);

  const intentRisk = portfolioIntelligenceService.classifyIntent("Which stock contributes the most to risk?");
  assert(intentRisk === 'RISK', `Classified as RISK, got ${intentRisk}`);

  const intentConcentration = portfolioIntelligenceService.classifyIntent("How concentrated is my portfolio HHI?");
  assert(intentConcentration === 'CONCENTRATION', `Classified as CONCENTRATION, got ${intentConcentration}`);

  const intentSector = portfolioIntelligenceService.classifyIntent("What is my tech and healthcare industry allocation?");
  assert(intentSector === 'SECTOR', `Classified as SECTOR, got ${intentSector}`);

  const intentCurrency = portfolioIntelligenceService.classifyIntent("Explain my foreign currency exposure in rupees and USD");
  assert(intentCurrency === 'CURRENCY', `Classified as CURRENCY, got ${intentCurrency}`);

  // ==========================================
  // TEST 9: GROUNDED PORTFOLIO ANALYSIS EXECUTION
  // ==========================================
  console.log('\n--- TEST 9: Grounded Portfolio Analysis Execution ---');

  const analysis = await portfolioIntelligenceService.analyzePortfolioQuestion({
    query: "Why did my portfolio move today?",
    asOfDate: new Date().toISOString()
  });

  assert(analysis.intent === 'PERFORMANCE', `Query intent correctly resolved to PERFORMANCE, got ${analysis.intent}`);
  assert(analysis.deterministicFacts.nav > 0, 'Deterministic facts include non-zero NAV');
  assert(analysis.explanation.headline.length > 0, 'Explanation contains non-empty headline');
  assert(analysis.explanation.facts.length > 0, 'Explanation contains verifiable facts list');
  assert(analysis.causalityDisclaimer.length > 0, 'Contains required causality disclaimer');
  assert(
    analysis.causalityDisclaimer.includes('single-cause') || analysis.causalityDisclaimer.includes('participant actions'),
    'Causality disclaimer guards against single-cause market claims'
  );

  // ==========================================
  // TEST SUMMARY
  // ==========================================
  console.log('\n======================================================================');
  console.log(` PHASE 9 TEST SUMMARY: ${passedCount}/${testCount} TESTS PASSED`);
  console.log('======================================================================\n');
}

runPhase9Tests().catch(err => {
  console.error('Fatal error during Phase 9 tests:', err);
  process.exit(1);
});
