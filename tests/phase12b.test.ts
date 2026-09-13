/**
 * Phase 12B — Backtest Analytics, Reporting & Verification Test Suite
 *
 * Verifies:
 * 1. Performance Analytics (Total Return, CAGR, Short-period guard, Volatility, Sharpe, Sortino)
 * 2. Drawdown Analytics (Underwater series, Max Drawdown %, Peak/Trough dates, Duration, Recovery)
 * 3. Trade Analytics (Win/Loss rate, Payoff ratio, Profit Factor, Expectancy, Consecutive streaks, Holding period)
 * 4. Portfolio Turnover & Exposure (Turnover rate, Annualized turnover, Gross/Net exposure series, Concentration & HHI)
 * 5. Benchmark Comparison (Status CALCULATED vs UNAVAILABLE, Excess Return, Beta, Correlation, Tracking Error, Information Ratio)
 * 6. Attribution & Limitations (P&L Attribution, Epistemic Disclosures, Zero Look-Ahead provenance)
 * 7. End-to-End Engine & Report Integration (BacktestEngine produces fully populated BacktestReport)
 */

import { backtestAnalyticsEngine } from '../server/services/backtest/backtestAnalyticsEngine';
import { backtestEngine } from '../server/services/backtest/backtestEngine';
import {
  EquityPoint,
  BacktestTrade,
  HistoricalPriceBar,
  BacktestConfiguration,
  SimulatedPosition
} from '../src/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ Test ${totalTests}: ${message}`);
  } else {
    console.error(`  ✗ Test ${totalTests} FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertClose(actual: number, expected: number, tolerance = 0.05, message: string) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual}, diff ${diff.toFixed(4)})`);
}

console.log('==================================================');
console.log('STARTING PHASE 12B: BACKTEST ANALYTICS & VERIFICATION');
console.log('==================================================\n');

// ----------------------------------------------------
// SECTION 1: Performance Analytics
// ----------------------------------------------------
console.log('--- SECTION 1: Performance Analytics ---');

// Build a 252-day synthetic equity curve starting at 100,000 and ending at approx 120,000 (upward drift)
const equityCurve1Year: EquityPoint[] = [];
const startMs = new Date('2023-01-01').getTime();
const dayMs = 24 * 60 * 60 * 1000;
let currentEq = 100000;

for (let i = 0; i < 252; i++) {
  const d = new Date(startMs + i * dayMs).toISOString().split('T')[0];
  const dailyFactor = 1 + (0.00075 + Math.sin(i / 10) * 0.005);
  currentEq *= dailyFactor;
  equityCurve1Year.push({
    timestamp: d,
    date: d,
    equity: currentEq,
    totalEquity: currentEq,
    cash: 20000,
    positionsValue: currentEq - 20000,
    drawdownPct: 0
  });
}

const perf1Year = backtestAnalyticsEngine.calculatePerformanceAnalytics(equityCurve1Year, 100000);

assert(perf1Year.totalReturn > 0, 'Total return in dollar terms is positive');
assert(perf1Year.totalReturnPct > 10, 'Total return % exceeds 10%');
assert(perf1Year.cagr !== null && perf1Year.cagr !== undefined, 'CAGR is computed for full 1-year window');
assert(perf1Year.annualizedVol > 0, 'Annualized volatility is strictly positive');
assert(perf1Year.sharpeRatio !== null && perf1Year.sharpeRatio! > 0, 'Sharpe ratio is positive for upward drift');
assert(perf1Year.sortinoRatio !== null && perf1Year.sortinoRatio! > 0, 'Sortino ratio is positive');

// Short period protection: < 30 days should NOT report CAGR
const shortCurve: EquityPoint[] = [];
for (let i = 0; i < 15; i++) {
  const d = new Date(startMs + i * dayMs).toISOString().split('T')[0];
  shortCurve.push({
    timestamp: d,
    date: d,
    equity: 100000 + i * 500,
    totalEquity: 100000 + i * 500,
    cash: 50000,
    positionsValue: 50000 + i * 500,
    drawdownPct: 0
  });
}
const shortPerf = backtestAnalyticsEngine.calculatePerformanceAnalytics(shortCurve, 100000);
assert(shortPerf.cagr === null, 'CAGR is null for periods < 30 days to avoid misleading extrapolation');

// ----------------------------------------------------
// SECTION 2: Drawdown & Underwater Analytics
// ----------------------------------------------------
console.log('\n--- SECTION 2: Drawdown & Underwater Analytics ---');

// Controlled curve with a known 20% drawdown
const drawdownCurve: EquityPoint[] = [
  { timestamp: '2023-01-01', date: '2023-01-01', equity: 100000, totalEquity: 100000, cash: 100000, positionsValue: 0, drawdownPct: 0 },
  { timestamp: '2023-01-02', date: '2023-01-02', equity: 120000, totalEquity: 120000, cash: 20000, positionsValue: 100000, drawdownPct: 0 }, // Peak
  { timestamp: '2023-01-03', date: '2023-01-03', equity: 108000, totalEquity: 108000, cash: 20000, positionsValue: 88000, drawdownPct: 0 },  // -10% from peak
  { timestamp: '2023-01-04', date: '2023-01-04', equity: 96000, totalEquity: 96000, cash: 20000, positionsValue: 76000, drawdownPct: 0 },   // -20% from peak (Trough: 96,000 / 120,000 = -20%)
  { timestamp: '2023-01-05', date: '2023-01-05', equity: 110000, totalEquity: 110000, cash: 20000, positionsValue: 90000, drawdownPct: 0 },  // Recovery phase
  { timestamp: '2023-01-06', date: '2023-01-06', equity: 125000, totalEquity: 125000, cash: 20000, positionsValue: 105000, drawdownPct: 0 }  // New peak (recovered)
];

const ddPerf = backtestAnalyticsEngine.calculatePerformanceAnalytics(drawdownCurve, 100000);
assert(ddPerf.drawdownSeries.length === 6, 'Drawdown series matches equity curve length');
assert(ddPerf.drawdownSeries[1].runningPeak === 120000, 'Running peak recorded at 120,000 on day 2');
assert(ddPerf.drawdownSeries[1].drawdownPct === 0, 'Drawdown is 0 at peak');
assertClose(ddPerf.drawdownSeries[3].drawdownPct, 20.0, 0.01, 'Max drawdown on day 4 is exactly 20.0%');

assertClose(ddPerf.maxDrawdownPct, 20.0, 0.01, 'Max drawdown % equals 20.0%');
assert(ddPerf.maxDrawdown === 24000, 'Max drawdown dollar loss is $24,000 (120k - 96k)');
assert(ddPerf.maxDrawdownDetails.peakDate === '2023-01-02', 'Peak date correctly identified as 2023-01-02');
assert(ddPerf.maxDrawdownDetails.troughDate === '2023-01-04', 'Trough date correctly identified as 2023-01-04');
assert(ddPerf.maxDrawdownDetails.recoveryDate === '2023-01-06', 'Recovery date correctly identified as 2023-01-06');
assert(ddPerf.maxDrawdownDetails.durationDays !== undefined && ddPerf.maxDrawdownDetails.durationDays > 0, 'Drawdown duration in days is tracked');

// ----------------------------------------------------
// SECTION 3: Trade Analytics & Payoff
// ----------------------------------------------------
console.log('\n--- SECTION 3: Trade Analytics & Payoff ---');

const sampleTrades: BacktestTrade[] = [
  // Win 1: +$500
  {
    id: 't-1',
    symbol: 'AAPL',
    ticker: 'AAPL',
    side: 'BUY',
    action: 'BUY',
    quantity: 10,
    shares: 10,
    price: 150,
    executionPrice: 150.05,
    date: '2023-01-02',
    timestamp: '2023-01-02',
    realizedPnL: 500,
    transactionCost: 1,
    slippage: 0.5,
    holdingPeriodBars: 5
  },
  // Win 2: +$300
  {
    id: 't-2',
    symbol: 'AAPL',
    ticker: 'AAPL',
    side: 'BUY',
    action: 'BUY',
    quantity: 10,
    shares: 10,
    price: 160,
    executionPrice: 160.05,
    date: '2023-01-10',
    timestamp: '2023-01-10',
    realizedPnL: 300,
    transactionCost: 1,
    slippage: 0.5,
    holdingPeriodBars: 3
  },
  // Loss 1: -$400
  {
    id: 't-3',
    symbol: 'MSFT',
    ticker: 'MSFT',
    side: 'SELL',
    action: 'SELL',
    quantity: 10,
    shares: 10,
    price: 240,
    executionPrice: 239.9,
    date: '2023-01-18',
    timestamp: '2023-01-18',
    realizedPnL: -400,
    transactionCost: 1,
    slippage: 1.0,
    holdingPeriodBars: 4
  },
  // Open / unclosed trade (no realizedPnL)
  {
    id: 't-4',
    symbol: 'NVDA',
    ticker: 'NVDA',
    side: 'BUY',
    action: 'BUY',
    quantity: 5,
    shares: 5,
    price: 400,
    executionPrice: 400.2,
    date: '2023-01-25',
    timestamp: '2023-01-25',
    transactionCost: 1,
    slippage: 1.0
  }
];

const tradeAnalyticsResult = backtestAnalyticsEngine.calculateTradeAnalytics(sampleTrades, 100000, [], 30);
const tradeStats = tradeAnalyticsResult.statistics;
const turnoverMetrics = tradeAnalyticsResult.turnover;

assert(tradeStats.totalTrades === 4, 'Total trades count is 4');
assert(tradeStats.closedTrades === 3, 'Closed trades count with realized PnL is 3');
assert(tradeStats.winningTrades === 2, 'Winning trades count is 2');
assert(tradeStats.losingTrades === 1, 'Losing trades count is 1');
assertClose(tradeStats.winRate, 66.67, 0.1, 'Win rate is 66.67%');
assertClose(tradeStats.lossRate, 33.33, 0.1, 'Loss rate is 33.33%');
assert(tradeStats.grossProfits === 800, 'Gross profit is $800 (500 + 300)');
assert(tradeStats.grossLosses === 400, 'Gross loss is $400');
assertClose(tradeStats.profitFactor!, 2.0, 0.01, 'Profit factor is exactly 2.0 (800 / 400)');
assertClose(tradeStats.averageWinningTrade, 400.0, 0.01, 'Average win is $400');
assertClose(tradeStats.averageLosingTrade, 400.0, 0.01, 'Average loss is $400');
assertClose(tradeStats.winLossRatio!, 1.0, 0.01, 'Win/Loss payoff ratio is 1.0');

// Profit factor null invariant test:
const allWinners: BacktestTrade[] = [
  {
    id: 'w-1',
    symbol: 'AAPL',
    ticker: 'AAPL',
    side: 'BUY',
    action: 'BUY',
    quantity: 10,
    shares: 10,
    price: 150,
    date: '2023-01-01',
    timestamp: '2023-01-01',
    realizedPnL: 250
  }
];
const winTradeResult = backtestAnalyticsEngine.calculateTradeAnalytics(allWinners, 100000, [], 10);
assert(winTradeResult.statistics.profitFactor === null, 'Profit factor is strictly null (not 0 or infinity) when gross losses === 0');

// ----------------------------------------------------
// SECTION 4: Turnover & Exposure
// ----------------------------------------------------
console.log('\n--- SECTION 4: Turnover & Exposure ---');

assert(turnoverMetrics.totalNotionalTraded > 0, 'Total notional traded is strictly positive');
assert(turnoverMetrics.grossTurnover > 0, 'Gross turnover ratio is positive');
assert(turnoverMetrics.annualizedTurnover > turnoverMetrics.grossTurnover, 'Annualized turnover scales higher for 30-day period');

const mockPositions: SimulatedPosition[] = [
  { symbol: 'AAPL', quantity: 100, entryPrice: 150, currentPrice: 160, marketValue: 16000, unrealizedPnL: 1000, unrealizedPnLPct: 6.67, currency: 'USD' },
  { symbol: 'MSFT', quantity: 50, entryPrice: 240, currentPrice: 250, marketValue: 12500, unrealizedPnL: 500, unrealizedPnLPct: 4.17, currency: 'USD' },
  { symbol: 'NVDA', quantity: 20, entryPrice: 400, currentPrice: 420, marketValue: 8400, unrealizedPnL: 400, unrealizedPnLPct: 5.0, currency: 'USD' }
];

const concMetrics = backtestAnalyticsEngine.calculateConcentrationMetrics(mockPositions, 100000);
assert(concMetrics.largestPositionSymbol === 'AAPL', 'Largest position symbol is AAPL');
assertClose(concMetrics.largestPositionWeight, 16.0, 0.1, 'AAPL position weight is 16% of 100k');
assertClose(concMetrics.top3Concentration, 36.9, 0.5, 'Top 3 concentration equals sum of AAPL+MSFT+NVDA weights (36.9%)');
assert(concMetrics.herfindahlIndex > 0, 'Herfindahl Index is positive');

const exposureSeries = backtestAnalyticsEngine.calculateExposureSeries(equityCurve1Year);
assert(exposureSeries.length === equityCurve1Year.length, 'Exposure series length matches equity curve');
assert(exposureSeries[0].cashPercentage >= 0 && exposureSeries[0].cashPercentage <= 100, 'Cash percentage is bounded [0, 100]');

// ----------------------------------------------------
// SECTION 5: Benchmark Comparison Analytics
// ----------------------------------------------------
console.log('\n--- SECTION 5: Benchmark Comparison Analytics ---');

// Build 252 benchmark bars correlated with the 1-year equity curve
const benchmarkBars: HistoricalPriceBar[] = [];
let bmClose = 400; // SPY-like starting price
for (let i = 0; i < 252; i++) {
  const d = equityCurve1Year[i].timestamp;
  bmClose *= (1 + (0.0005 + Math.sin(i / 10) * 0.004));
  benchmarkBars.push({
    timestamp: d,
    date: d,
    open: bmClose * 0.998,
    high: bmClose * 1.003,
    low: bmClose * 0.996,
    close: bmClose,
    volume: 50000000,
    epistemicStatus: 'REAL',
    isSimulated: false
  });
}

const bmComparison = backtestAnalyticsEngine.calculateBenchmarkComparison(
  equityCurve1Year,
  perf1Year.totalReturnPct,
  benchmarkBars,
  'SPY'
);

assert(bmComparison.status === 'CALCULATED', 'Benchmark status is CALCULATED when bars are provided');
assert(bmComparison.benchmarkSymbol === 'SPY', 'Benchmark symbol is SPY');
assert(bmComparison.benchmarkTotalReturn !== 0, 'Benchmark total return is calculated');
assert(bmComparison.excessReturn !== undefined, 'Excess return (alpha) is computed');
assert(bmComparison.beta !== null && bmComparison.beta! > 0, 'Beta to benchmark is positive');
assert(bmComparison.correlation !== null && bmComparison.correlation! > 0.5, 'Correlation is high given correlated sine wave drift');
assert(bmComparison.trackingError !== null && bmComparison.trackingError! > 0, 'Tracking error is positive');

// Unavailable benchmark test:
const emptyBm = backtestAnalyticsEngine.calculateBenchmarkComparison(equityCurve1Year, perf1Year.totalReturnPct, [], 'SPY');
assert(emptyBm.status === 'UNAVAILABLE', 'Benchmark comparison gracefully reports UNAVAILABLE when bars are missing');
assert(emptyBm.beta === null, 'Beta is null when benchmark is unavailable');
assert(emptyBm.correlation === null, 'Correlation is null when benchmark is unavailable');

// ----------------------------------------------------
// SECTION 6: P&L Attribution & Limitations Surfacing
// ----------------------------------------------------
console.log('\n--- SECTION 6: Attribution & Disclosures ---');

const attribution = backtestAnalyticsEngine.calculateSecurityAttribution(sampleTrades, mockPositions, 100000);
assert(attribution.length >= 3, 'Attribution breaks down all traded and held symbols');
const aaplAttr = attribution.find(a => a.symbol === 'AAPL');
assert(aaplAttr !== undefined, 'AAPL attribution found');
assert(aaplAttr!.realizedPnL === 800, 'AAPL realized PnL equals $800');
assert(aaplAttr!.unrealizedPnL === 1000, 'AAPL unrealized PnL equals $1,000');
assert(aaplAttr!.totalPnL === 1800, 'AAPL total PnL equals $1,800');

// Test generateReport directly
const mockConfig: BacktestConfiguration = {
  id: 'cfg-test-report',
  strategyId: 'strat-ma-crossover',
  symbols: ['AAPL'],
  startDate: '2023-01-01',
  endDate: '2024-01-01',
  initialCapital: 100000,
  currency: 'USD',
  slippageBps: 5,
  commissionPerTrade: 1.0,
  executionTiming: 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN',
  isSimulatedBaseline: false
};

const report = backtestAnalyticsEngine.generateReport(
  'Moving Average Crossover',
  'strat-ma-crossover',
  'bkt-test-123',
  mockConfig,
  perf1Year,
  { statistics: tradeStats, turnover: turnoverMetrics },
  exposureSeries,
  bmComparison,
  {
    provider: 'Twelve Data',
    asOfDate: '2024-01-01',
    dataFrequency: '1d',
    splitAdjusted: true,
    dividendAdjusted: true,
    lookAheadBiasChecked: true,
    provenanceTag: 'CALCULATION'
  },
  'REAL',
  'CALCULATED',
  [],
  252,
  0
);

assert(report.executiveSummary.backtestId === 'bkt-test-123', 'Report has valid backtestId');
assert(report.executiveSummary.totalReturnPct === perf1Year.totalReturnPct, 'Report total return matches perf1Year');
assert(report.limitations.survivorshipBiasRisk === 'SURVIVORSHIP_BIAS_POSSIBLE', 'Report survivorship bias is explicitly surfaced');
assert(report.limitations.delistingDataStatus === 'DELISTING_DATA_UNAVAILABLE', 'Report delisting bias is explicitly surfaced');
assert(report.limitations.lookAheadBiasProtection === 'STRICT_POINT_IN_TIME', 'Report look ahead protection is strict point in time');
assert(
  report.limitations.epistemicDisclaimer.includes('analytical simulations'),
  'Report disclaimers enforce strict mandate: analytical simulations'
);

// ----------------------------------------------------
// SECTION 7: End-to-End Engine & Report Integration
// ----------------------------------------------------
console.log('\n--- SECTION 7: End-to-End Simulation & Report Generation ---');

async function testEndToEndSimulation() {
  const config: BacktestConfiguration = {
    id: 'cfg-e2e-test',
    strategyId: 'strat-ma-crossover',
    symbols: ['AAPL'],
    startDate: '2023-01-01',
    endDate: '2023-04-01',
    initialCapital: 100000,
    currency: 'USD',
    slippageBps: 5,
    commissionPerTrade: 1.0,
    executionTiming: 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN',
    isSimulatedBaseline: true, // Deterministic sine baseline
    benchmarkSymbol: 'SPY'
  };

  const result = await backtestEngine.runBacktest(config);

  assert(result.status === 'COMPLETED', 'End-to-end backtest status is COMPLETED');
  assert(result.epistemicStatus === 'SIMULATED', 'Baseline simulation epistemic status is SIMULATED');
  assert(result.equityCurve.length > 0, 'Equity curve is populated');
  assert(result.report !== undefined, 'BacktestReport is fully generated');
  assert(result.perfAnalytics !== undefined, 'Performance analytics object is present on BacktestResult');
  assert(result.tradeStatistics !== undefined, 'Trade statistics object is present on BacktestResult');
  assert(result.turnover !== undefined, 'Turnover metrics object is present on BacktestResult');
  assert(result.exposureSeries !== undefined && result.exposureSeries.length > 0, 'Exposure series is populated');
  assert(result.benchmarkResults !== undefined, 'Benchmark results object is present on BacktestResult');
  assert(result.attribution !== undefined && result.attribution.length > 0, 'Attribution object is present on BacktestResult');
  assert(result.limitations !== undefined, 'Limitations object is present on BacktestResult');

  // Verify that report matches top-level metrics
  assert(result.report?.executiveSummary.totalReturnPct === result.totalReturnPct, 'Report total return % matches top-level result');
  assert(result.report?.executiveSummary.maxDrawdownPct === result.maxDrawdown, 'Report max drawdown matches top-level result');

  // Verify portfolio accounting reconciliation
  const expectedEquity = result.initialCapital +
    (result.totalRealizedPnL || 0) +
    (result.totalUnrealizedPnL || 0) -
    (result.totalTransactionCosts || 0);

  const diff = Math.abs(result.finalEquity - expectedEquity);
  assert(diff < 0.1, `Portfolio accounting reconciles on end-to-end run (diff: ${diff.toFixed(4)})`);
}

testEndToEndSimulation()
  .then(() => {
    console.log('\n==================================================');
    console.log(`ALL PHASE 12B TESTS PASSED! (${passedTests}/${totalTests})`);
    console.log('==================================================');
  })
  .catch((err) => {
    console.error('\nTest execution failed with error:', err);
    process.exit(1);
  });
