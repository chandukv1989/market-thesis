/**
 * PHASE 12A — REAL BACKTESTING ENGINE CORE TEST SUITE
 * 
 * Comprehensive verification suite testing:
 * 1. Historical data validator (chronology, duplicates, positive prices, OHLC, volume)
 * 2. Simulated execution engine (slippage worsening, transaction costs US vs India, long-only)
 * 3. Portfolio accounting & mark-to-market reconciliation
 * 4. Chronological event loop & look-ahead bias prohibition
 * 5. Execution timing: SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN
 * 6. Multi-currency protection (blocking mixed USD/INR without explicit FX)
 * 7. Epistemic integrity (CALCULATED vs SIMULATED, never REAL)
 * 8. Deterministic repeatability (identical outputs for identical inputs)
 * 9. Guardrails: isAnalyticalOnly and executionProhibited enforcement
 */

import { HistoricalDataValidator } from '../server/services/backtest/dataValidation';
import { SimulatedExecutionEngine } from '../server/services/backtest/simulatedExecutionEngine';
import { PortfolioSimulator } from '../server/services/backtest/portfolioSimulator';
import { BacktestEngine } from '../server/services/backtest/backtestEngine';
import { BacktestService } from '../server/services/backtest/backtestService';
import {
  HistoricalPriceBar,
  BacktestConfiguration,
  SimulatedPosition
} from '../src/types';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}`);
    throw new Error(`Test failure: ${message}`);
  }
}

// Helper: Generate clean historical daily bars
function generateCleanBars(
  count: number,
  startPrice: number = 150,
  startDateStr: string = '2023-01-01',
  trend: number = 0.001
): HistoricalPriceBar[] {
  const bars: HistoricalPriceBar[] = [];
  let price = startPrice;
  const current = new Date(startDateStr);

  for (let i = 0; i < count; i++) {
    const dStr = current.toISOString().split('T')[0];
    const open = Number(price.toFixed(2));
    const delta = (Math.sin(i * 0.2) * 0.015 + trend) * open;
    const close = Number((open + delta).toFixed(2));
    const high = Number((Math.max(open, close) * 1.01).toFixed(2));
    const low = Number((Math.min(open, close) * 0.99).toFixed(2));
    const volume = 1000000 + (i % 5) * 100000;

    bars.push({
      timestamp: `${dStr}T16:00:00.000Z`,
      open,
      high,
      low,
      close,
      volume,
      currency: 'USD',
      securityId: 'sec-aapl',
      market: 'US',
      exchange: 'NASDAQ',
      provider: 'TwelveData',
      epistemicStatus: 'REAL',
      corporateActionsAdjusted: true
    });

    price = close;
    current.setDate(current.getDate() + 1);
  }

  return bars;
}

async function runPhase12aTests() {
  console.log('\n==================================================');
  console.log('STARTING PHASE 12A: REAL BACKTESTING ENGINE TESTS');
  console.log('==================================================\n');

  // ==========================================
  // SECTION 1: DATA VALIDATION TESTS
  // ==========================================
  console.log('--- SECTION 1: Historical Data Validation ---');

  const cleanBars = generateCleanBars(60);
  const cleanValidation = HistoricalDataValidator.validate(cleanBars, 20);
  assert(cleanValidation.isValid === true, 'Clean series passes validation');
  assert(cleanValidation.quality === 'COMPLETE', 'Clean series quality is COMPLETE');
  assert(cleanValidation.totalBars === 60, 'Total bars correctly counted');

  // Chronological violation
  const outOfOrderBars = [...cleanBars];
  outOfOrderBars[10] = { ...cleanBars[10], timestamp: '2022-01-01T00:00:00.000Z' };
  const outOfOrderValidation = HistoricalDataValidator.validate(outOfOrderBars, 20);
  assert(outOfOrderValidation.isValid === false, 'Out-of-order timestamp triggers validation failure');
  assert(outOfOrderValidation.issues.some(i => i.type === 'OUT_OF_ORDER'), 'Identifies OUT_OF_ORDER issue');

  // Duplicate timestamp
  const duplicateBars = [...cleanBars];
  duplicateBars[5] = { ...cleanBars[4] };
  const duplicateValidation = HistoricalDataValidator.validate(duplicateBars, 20);
  assert(duplicateValidation.isValid === false, 'Duplicate timestamp triggers validation failure');
  assert(duplicateValidation.issues.some(i => i.type === 'DUPLICATE_TIMESTAMP'), 'Identifies DUPLICATE_TIMESTAMP issue');

  // Negative / Zero price
  const negativePriceBars = [...cleanBars];
  negativePriceBars[3] = { ...cleanBars[3], close: -10 };
  const negValidation = HistoricalDataValidator.validate(negativePriceBars, 20);
  assert(negValidation.isValid === false, 'Negative price triggers validation failure');
  assert(negValidation.issues.some(i => i.type === 'NEGATIVE_PRICE'), 'Identifies NEGATIVE_PRICE issue');

  // High < Open or Low > Close (Invalid OHLC)
  const invalidOhlcBars = [...cleanBars];
  invalidOhlcBars[4] = { ...cleanBars[4], high: cleanBars[4].open - 5 };
  const ohlcValidation = HistoricalDataValidator.validate(invalidOhlcBars, 20);
  assert(ohlcValidation.isValid === false, 'High < Open triggers validation failure');
  assert(ohlcValidation.issues.some(i => i.type === 'INVALID_OHLC'), 'Identifies INVALID_OHLC issue');

  // Negative volume
  const negVolBars = [...cleanBars];
  negVolBars[2] = { ...cleanBars[2], volume: -500 };
  const volValidation = HistoricalDataValidator.validate(negVolBars, 20);
  assert(volValidation.isValid === false, 'Negative volume triggers validation failure');
  assert(volValidation.issues.some(i => i.type === 'NEGATIVE_VOLUME'), 'Identifies NEGATIVE_VOLUME issue');

  // Insufficient history
  const shortBars = generateCleanBars(10);
  const shortValidation = HistoricalDataValidator.validate(shortBars, 30);
  assert(shortValidation.isValid === false, 'Insufficient history for strategy warm-up rejected');
  assert(shortValidation.quality === 'INSUFFICIENT', 'Quality marked INSUFFICIENT');

  // ==========================================
  // SECTION 2: SIMULATED EXECUTION ENGINE
  // ==========================================
  console.log('\n--- SECTION 2: Simulated Execution Engine ---');

  // Slippage always worsens BUY (higher price)
  const buySlippage = SimulatedExecutionEngine.getSlippageRate({ type: 'BPS', rate: 10 });
  assert(buySlippage === 0.001, '10 bps slippage rate is 0.001 (0.1%)');

  const dummyConfig: BacktestConfiguration = {
    backtestId: 'test-config',
    strategyId: 'strat-ma-crossover',
    startDate: '2023-01-01',
    endDate: '2023-03-01',
    initialCapital: 100000,
    currency: 'USD',
    slippageBps: 10, // 0.1%
    commissionPerTrade: 1.0,
    executionTiming: 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN'
  };

  const buyOrder: any = {
    orderId: 'o-1',
    signalId: 's-1',
    securityId: 'sec-aapl',
    symbol: 'AAPL',
    side: 'BUY',
    targetWeightPct: 20, // $20,000 target
    requestedPrice: 100.0,
    signalTimestamp: '2023-01-01T16:00:00.000Z',
    executionTimestamp: '2023-01-02T09:30:00.000Z'
  };

  const buyFill = SimulatedExecutionEngine.executeOrder(
    buyOrder,
    100.0, // market price at open
    100000,
    100000,
    undefined,
    dummyConfig
  );

  assert(buyFill !== null, 'Buy order successfully executed');
  assert(buyFill!.executionPrice > 100.0, `BUY execution price (${buyFill!.executionPrice}) is strictly higher than market price (100.0) due to slippage`);
  assert(buyFill!.executionPrice === 100.1, `BUY price with 10 bps slippage is exactly 100.10`);
  assert(buyFill!.transactionCost === 1.0, 'Transaction cost matches $1.00 config');
  assert(buyFill!.slippageCost > 0, 'Slippage cost is positive');

  // Slippage always worsens SELL (lower price)
  const sellOrder: any = {
    orderId: 'o-2',
    signalId: 's-2',
    securityId: 'sec-aapl',
    symbol: 'AAPL',
    side: 'SELL',
    targetWeightPct: 0,
    requestedPrice: 110.0,
    signalTimestamp: '2023-01-05T16:00:00.000Z',
    executionTimestamp: '2023-01-06T09:30:00.000Z'
  };

  const existingPosition: SimulatedPosition = {
    securityId: 'sec-aapl',
    symbol: 'AAPL',
    quantity: buyFill!.quantity,
    averageEntryPrice: buyFill!.executionPrice,
    currentPrice: 110.0,
    marketValue: buyFill!.quantity * 110.0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    weight: 0.2,
    weightPct: 20,
    currency: 'USD'
  };

  const sellFill = SimulatedExecutionEngine.executeOrder(
    sellOrder,
    110.0,
    80000,
    102000,
    existingPosition,
    dummyConfig
  );

  assert(sellFill !== null, 'Sell order successfully executed');
  assert(sellFill!.executionPrice < 110.0, `SELL execution price (${sellFill!.executionPrice}) is strictly lower than market price (110.0) due to slippage`);
  assert(sellFill!.executionPrice === 109.89, `SELL price with 10 bps slippage is 109.89`);
  assert(sellFill!.realizedPnL !== undefined && sellFill!.realizedPnL > 0, 'Realized PnL is computed on profitable long exit');

  // Long-only constraint: cannot sell without holding
  const nakedSell = SimulatedExecutionEngine.executeOrder(
    sellOrder,
    110.0,
    100000,
    100000,
    undefined, // No position
    dummyConfig
  );
  assert(nakedSell === null, 'Naked sell is prohibited (Long-only invariant)');

  // Transaction cost model for India (INR)
  const indiaCost = SimulatedExecutionEngine.calculateTransactionCost(250000, 'INR');
  assert(indiaCost >= 20, 'India transaction cost respects ₹20 minimum');
  assert(indiaCost === 250, 'India transaction cost 0.1% of ₹250,000 = ₹250');

  // ==========================================
  // SECTION 3: PORTFOLIO ACCOUNTING & RECONCILIATION
  // ==========================================
  console.log('\n--- SECTION 3: Portfolio Simulator & Accounting Invariants ---');

  const portfolio = new PortfolioSimulator(100000, 'USD');
  assert(portfolio.getCash() === 100000, 'Initial cash is 100,000');
  assert(portfolio.getTotalEquity() === 100000, 'Initial total equity is 100,000');

  // Apply Buy Fill
  portfolio.applyFill(buyFill!);
  const expectedCashAfterBuy = Number((100000 - (buyFill!.grossValue + buyFill!.transactionCost)).toFixed(4));
  assert(portfolio.getCash() === expectedCashAfterBuy, `Cash correctly debited on buy: ${portfolio.getCash()}`);

  const posAfterBuy = portfolio.getPosition('sec-aapl');
  assert(posAfterBuy !== undefined, 'Position created for AAPL');
  assert(posAfterBuy!.quantity === buyFill!.quantity, 'Position quantity matches fill quantity');
  assert(posAfterBuy!.averageEntryPrice === buyFill!.executionPrice, 'Position entry price matches fill price');

  // Multi-lot buy: verify weighted average price
  const secondBuyFill = {
    ...buyFill!,
    tradeId: 'fill-2',
    quantity: 100,
    executionPrice: 120.0,
    grossValue: 12000,
    transactionCost: 1.0,
    slippageCost: 10
  };
  portfolio.applyFill(secondBuyFill);
  const posAfterSecondBuy = portfolio.getPosition('sec-aapl')!;
  const expectedTotalQty = buyFill!.quantity + 100;
  const expectedCostBasis = (buyFill!.quantity * buyFill!.executionPrice) + (100 * 120.0);
  const expectedAvgPrice = Number((expectedCostBasis / expectedTotalQty).toFixed(4));
  assert(posAfterSecondBuy.quantity === expectedTotalQty, 'Multi-lot buy accumulates quantity');
  assert(Math.abs(posAfterSecondBuy.averageEntryPrice - expectedAvgPrice) < 0.01, 'Multi-lot buy computes correct weighted average entry price');

  // Mark to market
  const priceMap = new Map<string, number>([['sec-aapl', 125.0]]);
  const equityPoint = portfolio.markToMarket('2023-01-03T16:00:00.000Z', priceMap);
  assert(equityPoint.positionsValue > 0, 'Positions value updated to market price');
  assert(equityPoint.totalEquity === Number((portfolio.getCash() + equityPoint.positionsValue).toFixed(2)), 'Total equity === Cash + Positions Value');

  // Apply Sell Fill (partial or full)
  const fullSellFill = {
    ...sellFill!,
    tradeId: 'fill-sell-1',
    quantity: expectedTotalQty,
    executionPrice: 125.0,
    grossValue: expectedTotalQty * 125.0,
    transactionCost: 2.0,
    slippageCost: 15,
    realizedPnL: expectedTotalQty * (125.0 - posAfterSecondBuy.averageEntryPrice)
  };
  portfolio.applyFill(fullSellFill);
  assert(portfolio.getPosition('sec-aapl') === undefined, 'Position cleared after 100% liquidation');
  assert(Math.abs(portfolio.getTotalRealizedPnL() - fullSellFill.realizedPnL) < 0.01, 'Realized PnL accumulated in portfolio');

  // Accounting reconciliation
  const reconciliation = portfolio.reconcileAccounting();
  assert(reconciliation.reconciled === true, `Accounting equation reconciles: Ending (${reconciliation.endingEquity}) === Expected (${reconciliation.expectedEquity})`);
  assert(reconciliation.difference < 0.05, `Discrepancy is within float epsilon: ${reconciliation.difference}`);

  // ==========================================
  // SECTION 4: FULL BACKTEST EVENT LOOP & INVARIANTS
  // ==========================================
  console.log('\n--- SECTION 4: Deterministic Backtest Engine Event Loop ---');

  const backtestEngine = BacktestEngine.getInstance();

  const fullBars = generateCleanBars(120, 150, '2023-01-01', 0.001);

  const bktConfig: BacktestConfiguration = {
    backtestId: 'bkt-phase12a-test',
    strategyId: 'strat-ma-crossover',
    symbols: ['AAPL'],
    startDate: '2023-02-15',
    endDate: '2023-04-15',
    initialCapital: 100000,
    currency: 'USD',
    slippageBps: 5,
    commissionPerTrade: 1.0,
    executionTiming: 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN'
  };

  const result = await backtestEngine.runBacktest(bktConfig, fullBars);

  assert(result.status === 'COMPLETED', `Backtest completed with status: ${result.status}`);
  assert(result.equityCurve.length > 0, `Equity curve populated (${result.equityCurve.length} points)`);
  assert(result.initialCapital === 100000, 'Initial capital is 100,000');
  assert(result.finalEquity > 0, `Final equity is positive: ${result.finalEquity}`);
  assert(result.epistemicStatus === 'CALCULATED', 'Real data source results in CALCULATED epistemic status (Never REAL)');
  assert(result.isAnalyticalOnly === true, 'isAnalyticalOnly guardrail is true');
  assert(result.executionProhibited === true, 'executionProhibited guardrail is true');

  // Check trade execution model
  if (result.trades.length > 0) {
    const firstTrade = result.trades[0];
    assert(firstTrade.executionModel === 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN', 'Trade records execution model');
    assert(firstTrade.signalTimestamp !== undefined, 'Trade records signal timestamp');
    assert(firstTrade.timestamp !== firstTrade.signalTimestamp, 'Trade timestamp (T+1 Open) is distinct from signal timestamp (T Close)');
    assert(firstTrade.strategyId === 'strat-ma-crossover', 'Trade records strategyId');
    assert(firstTrade.grossValue > 0, 'Trade gross value is positive');
    assert(firstTrade.slippage > 0, 'Trade slippage is positive');
  }

  // ==========================================
  // SECTION 5: CURRENCY SAFETY & INVARIANTS
  // ==========================================
  console.log('\n--- SECTION 5: Currency Isolation Guardrails ---');

  const mixedConfig: BacktestConfiguration = {
    backtestId: 'bkt-mixed',
    strategyId: 'strat-ma-crossover',
    symbols: ['AAPL', 'RELIANCE'], // Mixed US + India
    startDate: '2023-02-15',
    endDate: '2023-04-15',
    initialCapital: 100000,
    currency: 'USD'
  };

  const mixedResult = await backtestEngine.runBacktest(mixedConfig, fullBars);
  assert(mixedResult.status === 'BLOCKED', 'Mixed US + India backtest without FX rate is strictly BLOCKED');
  const mixedWarnings: string[] = Array.isArray(mixedResult.warnings)
    ? mixedResult.warnings
    : (typeof mixedResult.warnings === 'string' ? [mixedResult.warnings] : []);
  assert(mixedWarnings.some(w => typeof w === 'string' && w.includes('MIXED_CURRENCY_BLOCKED')), 'Warning identifies MIXED_CURRENCY_BLOCKED violation');

  // ==========================================
  // SECTION 6: DETERMINISTIC REPEATABILITY
  // ==========================================
  console.log('\n--- SECTION 6: Deterministic Repeatability ---');

  const runA = await backtestEngine.runBacktest(bktConfig, fullBars);
  const runB = await backtestEngine.runBacktest(bktConfig, fullBars);

  assert(runA.finalEquity === runB.finalEquity, `Repeatable ending equity: ${runA.finalEquity} === ${runB.finalEquity}`);
  assert(runA.totalReturnPct === runB.totalReturnPct, `Repeatable total return: ${runA.totalReturnPct}% === ${runB.totalReturnPct}%`);
  assert(runA.trades.length === runB.trades.length, `Repeatable trade count: ${runA.trades.length} === ${runB.trades.length}`);
  assert(runA.sharpeRatio === runB.sharpeRatio, `Repeatable Sharpe ratio: ${runA.sharpeRatio} === ${runB.sharpeRatio}`);
  assert(runA.equityCurve.length === runB.equityCurve.length, 'Repeatable equity curve length');

  // ==========================================
  // SECTION 7: BACKTEST SERVICE & CACHE
  // ==========================================
  console.log('\n--- SECTION 7: Backtest Service Facade & Validation ---');

  const service = BacktestService.getInstance();
  const validCheck = await service.validateConfig(bktConfig);
  assert(validCheck.isValid === true, 'Configuration validation passes');

  const invalidConfig: BacktestConfiguration = {
    backtestId: 'bkt-bad',
    strategyId: 'strat-rsi',
    currency: 'USD',
    startDate: '2023-05-01',
    endDate: '2023-01-01', // End before start
    initialCapital: -5000 // Negative capital
  };
  const invalidCheck = await service.validateConfig(invalidConfig);
  assert(invalidCheck.isValid === false, 'Invalid configuration is rejected');
  assert(invalidCheck.errors.length >= 2, 'Reports both date range and initial capital errors');

  console.log('\n==================================================');
  console.log(`ALL PHASE 12A TESTS PASSED! (${passedCount}/${testCount})`);
  console.log('==================================================\n');
}

runPhase12aTests().catch(err => {
  console.error('Fatal error in Phase 12A tests:', err);
  process.exit(1);
});
