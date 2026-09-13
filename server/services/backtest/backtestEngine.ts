/**
 * Phase 12A - Deterministic Real Backtesting Engine Core
 * 
 * Strict Chronological Historical Event Loop.
 * 
 * Invariants:
 * 1. 100% Deterministic — Reuses Phase 11 QuantStrategyEngine. Zero LLM / Gemini involvement in math/orders.
 * 2. Point-in-Time Integrity — Strict prohibition of look-ahead bias (bars <= T).
 * 3. Default Execution Model — SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN (Signal at Bar T Close, Trade at Bar T+1 Open).
 * 4. Same-Bar Protection — Never execute using information known only after signal timestamp.
 * 5. Provider Independence — Consumes HistoricalPriceBar[] from MarketDataProvider abstraction (Twelve Data / FYERS).
 * 6. Currency Safety — Strict separation of USD and INR. Mixed backtest blocked without explicit FX.
 * 7. Epistemic Status — CALCULATED (if real market data) or SIMULATED (if baseline data). Never labeled REAL.
 * 8. Analytical Guardrails — isAnalyticalOnly: true, executionProhibited: true.
 */

import {
  HistoricalPriceBar,
  QuantStrategy,
  BacktestConfiguration,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
  SimulatedPosition,
  PointInTimeProvenance,
  EpistemicStatus,
  DataQualityStatus,
  MarketRegion
} from '../../../src/types';
import { QuantStrategyEngine } from '../quant/quantStrategyEngine';
import { marketDataProvider } from '../../providers/marketDataProvider';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';
import { HistoricalDataValidator } from './dataValidation';
import { SimulatedExecutionEngine } from './simulatedExecutionEngine';
import { PortfolioSimulator } from './portfolioSimulator';
import { SimulatedOrder, ExecutionFill } from './backtestTypes';
import { backtestAnalyticsEngine } from './backtestAnalyticsEngine';
import {
  DrawdownPoint,
  TradeStatistics,
  TurnoverMetrics,
  ExposurePoint,
  ConcentrationMetrics,
  BenchmarkComparisonResult,
  SecurityAttribution,
  BacktestLimitations,
  BacktestReport
} from '../../../src/types';

export class BacktestEngine {
  private static instance: BacktestEngine;
  private quantEngine: QuantStrategyEngine;

  private constructor() {
    this.quantEngine = QuantStrategyEngine.getInstance();
  }

  public static getInstance(): BacktestEngine {
    if (!BacktestEngine.instance) {
      BacktestEngine.instance = new BacktestEngine();
    }
    return BacktestEngine.instance;
  }

  /**
   * Run a deterministic backtest simulation.
   */
  public async runBacktest(
    config: BacktestConfiguration,
    providedBars?: HistoricalPriceBar[],
    benchmarkBars?: HistoricalPriceBar[]
  ): Promise<BacktestResult> {
    const backtestId = config.backtestId || `bkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    // ==========================================
    // 1. CONFIGURATION SANITY AUDIT
    // ==========================================
    const warnings: string[] = [];

    if (!config.strategyId) {
      return this.createBlockedResult(backtestId, config, 'MISSING_STRATEGY', 'Strategy ID must be explicitly specified.');
    }

    const strategy = this.quantEngine.getStrategy(config.strategyId);
    if (!strategy) {
      return this.createBlockedResult(backtestId, config, 'UNKNOWN_STRATEGY', `Strategy with ID '${config.strategyId}' not found in registry.`);
    }

    if (typeof config.initialCapital !== 'number' || config.initialCapital <= 0 || isNaN(config.initialCapital)) {
      return this.createBlockedResult(backtestId, config, 'INVALID_CAPITAL', `Initial capital must be a positive number. Received: ${config.initialCapital}`);
    }

    if (!config.startDate || !config.endDate) {
      return this.createBlockedResult(backtestId, config, 'INVALID_DATE_RANGE', 'Start date and end date must be specified.');
    }

    const startMs = new Date(config.startDate).getTime();
    const endMs = new Date(config.endDate).getTime();
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
      return this.createBlockedResult(backtestId, config, 'INVALID_DATE_RANGE', `Start date (${config.startDate}) must be strictly prior to end date (${config.endDate}).`);
    }

    // ==========================================
    // 2. UNIVERSE & CURRENCY SAFETY CHECK
    // ==========================================
    const symbols = (config.symbols && config.symbols.length > 0)
      ? config.symbols
      : (config.securityIds && config.securityIds.length > 0)
        ? config.securityIds
        : (strategy.universe.markets.includes('INDIA') ? ['RELIANCE'] : ['AAPL']);

    // Check market regions & currencies
    const resolvedSecurities = symbols.map(s => resolveSecurity(s) || {
      id: s.toLowerCase(),
      symbol: s.toUpperCase(),
      market: (config.currency === 'INR' ? 'INDIA' : 'US') as MarketRegion,
      exchange: config.currency === 'INR' ? 'NSE' : 'NASDAQ',
      currency: config.currency || 'USD'
    });

    const hasUS = resolvedSecurities.some(sec => sec.market === 'US');
    const hasIndia = resolvedSecurities.some(sec => sec.market === 'INDIA');

    if (hasUS && hasIndia) {
      return this.createBlockedResult(
        backtestId,
        config,
        'MIXED_CURRENCY_BLOCKED',
        'Mixed US (USD) and India (INR) backtest requires an explicit valid FX conversion rate. Automatic multi-currency ledger mixing without FX data is strictly blocked.'
      );
    }

    const primarySecurity = resolvedSecurities[0];
    const currency = config.currency || config.baseCurrency || primarySecurity.currency || 'USD';
    const executionTiming = config.executionTiming || 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN';

    // ==========================================
    // 3. HISTORICAL DATA INGESTION
    // ==========================================
    let rawBars: HistoricalPriceBar[] = [];
    let isDataSourceSimulated = false;
    let providerName = 'MarketDataProvider';

    if (providedBars && providedBars.length > 0) {
      rawBars = [...providedBars];
      isDataSourceSimulated = providedBars.some(b => b.isSimulated === true);
      providerName = providedBars[0]?.provenance?.provider || 'ProvidedBars';
    } else if (config.isSimulatedBaseline) {
      warnings.push('Operating on simulated baseline data per explicit isSimulatedBaseline configuration.');
      rawBars = this.generateDeterministicFallbackBars(primarySecurity.symbol, config.startDate, config.endDate, primarySecurity.market);
      isDataSourceSimulated = true;
      providerName = 'SimulatedBaselineProvider';
    } else {
      // Ingest through MarketDataProvider abstraction
      const historyResponse = await marketDataProvider.getHistoricalPrices({
        symbol: primarySecurity.symbol,
        securityId: primarySecurity.id,
        market: primarySecurity.market,
        exchange: primarySecurity.exchange,
        currency,
        interval: '1d',
        period: '5Y'
      });

      if (historyResponse.status === 'unavailable' || !historyResponse.bars || historyResponse.bars.length === 0) {
        return this.createBlockedResult(
          backtestId,
          config,
          'DATA_UNAVAILABLE',
          `Real historical market data is UNAVAILABLE for ${primarySecurity.symbol} via ${historyResponse.provider}. Provider requires valid credentials (TWELVE_DATA_API_KEY or FYERS_ACCESS_TOKEN). To run simulation on baseline data, explicitly set isSimulatedBaseline: true.`
        );
      } else {
        rawBars = historyResponse.bars;
        isDataSourceSimulated = historyResponse.isSimulated === true || historyResponse.epistemicStatus === 'SIMULATED';
        providerName = historyResponse.provider;
      }
    }

    // ==========================================
    // 4. HISTORICAL DATA INTEGRITY VALIDATION
    // ==========================================
    // Determine warm-up requirement from strategy indicators
    let minWarmUpBars = 20;
    for (const ind of strategy.indicators) {
      const p = (ind.parameters?.period as number) || (ind.parameters?.slowPeriod as number) || (ind.parameters?.fastPeriod as number) || ind.lookbackPeriods;
      if (typeof p === 'number' && p > minWarmUpBars) {
        minWarmUpBars = p;
      }
    }
    // Add safety buffer for indicators like EMA/MACD
    minWarmUpBars = Math.max(30, minWarmUpBars + 5);

    const validationResult = HistoricalDataValidator.validate(rawBars, minWarmUpBars, config.corporateActionAdjustment);
    if (!validationResult.isValid) {
      const issueMsgs = validationResult.issues.map(i => `[${i.type}] ${i.message}`).join('; ');
      return this.createBlockedResult(
        backtestId,
        config,
        'DATA_VALIDATION_FAILED',
        `Historical data integrity check failed (${validationResult.quality}): ${issueMsgs}`
      );
    }

    // Filter simulation bars by date range while preserving preceding bars for indicator warm-up
    const sortedBars = [...rawBars].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Find first bar within or after startDate
    let simStartIndex = -1;
    for (let i = 0; i < sortedBars.length; i++) {
      const barDate = sortedBars[i].timestamp.split('T')[0];
      if (barDate >= config.startDate) {
        simStartIndex = i;
        break;
      }
    }

    if (simStartIndex === -1) {
      return this.createBlockedResult(
        backtestId,
        config,
        'NO_BARS_IN_RANGE',
        `No historical bars found on or after start date ${config.startDate}. Available data starts at ${sortedBars[0]?.timestamp}.`
      );
    }

    if (simStartIndex < minWarmUpBars) {
      warnings.push(`Warning: Only ${simStartIndex} bars available prior to ${config.startDate} for indicator warm-up (recommended: ${minWarmUpBars}). Initial indicator values may be partial.`);
    }

    // ==========================================
    // 5. CHRONOLOGICAL EVENT LOOP & SIMULATION
    // ==========================================
    const portfolio = new PortfolioSimulator(config.initialCapital, currency);
    const trades: BacktestTrade[] = [];
    let pendingOrder: SimulatedOrder | null = null;

    // Simulation runs through bars <= endDate
    for (let i = simStartIndex; i < sortedBars.length; i++) {
      const currentBar = sortedBars[i];
      const barDate = currentBar.timestamp.split('T')[0];
      if (barDate > config.endDate) {
        break;
      }

      // ----------------------------------------------------
      // Step A: EXECUTE PENDING ORDER AT BAR OPEN (T+1 Open)
      // ----------------------------------------------------
      if (pendingOrder) {
        // Execute trade at currentBar.open with slippage and transaction costs
        const fill = SimulatedExecutionEngine.executeOrder(
          pendingOrder,
          currentBar.open,
          portfolio.getCash(),
          portfolio.getTotalEquity(),
          portfolio.getPosition(pendingOrder.securityId),
          config
        );

        if (fill) {
          portfolio.applyFill(fill);

          const backtestTrade: BacktestTrade = {
            id: fill.tradeId,
            tradeId: fill.tradeId,
            backtestId,
            securityId: fill.securityId,
            symbol: fill.symbol,
            ticker: fill.symbol,
            date: currentBar.timestamp.split('T')[0],
            timestamp: currentBar.timestamp,
            signalTimestamp: fill.signalTimestamp,
            action: fill.side,
            side: fill.side,
            shares: fill.quantity,
            quantity: fill.quantity,
            price: fill.executionPrice,
            requestedPrice: fill.requestedPrice,
            executionPrice: fill.executionPrice,
            grossValue: fill.grossValue,
            slippage: fill.slippageCost,
            transactionCost: fill.transactionCost,
            netValue: fill.netValue,
            signalId: fill.signalId,
            strategyId: strategy.strategyId,
            strategyVersion: strategy.version || 'v1.0.0',
            executionModel: fill.executionModel,
            provenance: fill.provenance,
            realizedPnL: fill.realizedPnL,
            returnPct: fill.realizedPnL && fill.grossValue > 0 ? (fill.realizedPnL / fill.grossValue) * 100 : undefined,
            rationale: fill.rationale
          };

          trades.push(backtestTrade);
        }
        pendingOrder = null;
      }

      // ----------------------------------------------------
      // Step B: EVALUATE STRATEGY AT BAR CLOSE (Point-in-Time)
      // ----------------------------------------------------
      // Strict look-ahead protection: feed ONLY bars <= currentBar (index 0 to i)
      const historicalSlice = sortedBars.slice(0, i + 1);

      const evalResult = await this.quantEngine.evaluateStrategy({
        strategyId: strategy.strategyId,
        strategy,
        symbol: primarySecurity.symbol,
        securityId: primarySecurity.id,
        market: primarySecurity.market,
        exchange: primarySecurity.exchange,
        currency,
        bars: historicalSlice,
        asOfDate: currentBar.timestamp,
        portfolioContext: {
          totalPortfolioValue: portfolio.getTotalEquity(),
          currentHoldings: portfolio.getAllPositions().map(p => ({
            securityId: p.securityId,
            symbol: p.symbol,
            weightPct: p.weightPct || 0,
            market: primarySecurity.market
          })),
          cashReservePct: (portfolio.getCash() / portfolio.getTotalEquity()) * 100
        }
      });

      const signal = evalResult.signal;
      const targetPosition = evalResult.targetPosition;
      const constrainedWeight = targetPosition ? targetPosition.constrainedWeightPct : 0;
      const currentHolding = portfolio.getPosition(primarySecurity.id);
      const currentQty = currentHolding ? currentHolding.quantity : 0;

      // ----------------------------------------------------
      // Step C: ORDER GENERATION BASED ON DETERMINISTIC SIGNAL
      // ----------------------------------------------------
      if (signal.direction === 'BUY' && currentQty === 0 && constrainedWeight > 0) {
        const order: SimulatedOrder = {
          orderId: `ord-${backtestId}-${i}`,
          signalId: signal.id,
          securityId: primarySecurity.id,
          symbol: primarySecurity.symbol,
          side: 'BUY',
          targetWeightPct: constrainedWeight,
          requestedPrice: currentBar.close,
          signalTimestamp: currentBar.timestamp,
          executionTimestamp: currentBar.timestamp, // Will be updated to T+1 open
          strategyId: strategy.strategyId,
          strategyVersion: strategy.version || 'v1.0.0',
          rationale: signal.reason,
          provenance: evalResult.provenance
        };

        if (executionTiming === 'SAME_BAR_CLOSE') {
          // Execute immediately at current close
          const fill = SimulatedExecutionEngine.executeOrder(
            order,
            currentBar.close,
            portfolio.getCash(),
            portfolio.getTotalEquity(),
            currentHolding,
            config
          );
          if (fill) {
            portfolio.applyFill(fill);
            trades.push(this.mapFillToTrade(fill, backtestId, strategy));
          }
        } else {
          // Default: Stage for next bar open (SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN)
          pendingOrder = order;
        }
      } else if (signal.direction === 'SELL' && currentQty > 0) {
        const order: SimulatedOrder = {
          orderId: `ord-${backtestId}-${i}`,
          signalId: signal.id,
          securityId: primarySecurity.id,
          symbol: primarySecurity.symbol,
          side: 'SELL',
          targetWeightPct: 0, // Complete liquidation
          requestedPrice: currentBar.close,
          signalTimestamp: currentBar.timestamp,
          executionTimestamp: currentBar.timestamp,
          strategyId: strategy.strategyId,
          strategyVersion: strategy.version || 'v1.0.0',
          rationale: signal.reason,
          provenance: evalResult.provenance
        };

        if (executionTiming === 'SAME_BAR_CLOSE') {
          const fill = SimulatedExecutionEngine.executeOrder(
            order,
            currentBar.close,
            portfolio.getCash(),
            portfolio.getTotalEquity(),
            currentHolding,
            config
          );
          if (fill) {
            portfolio.applyFill(fill);
            trades.push(this.mapFillToTrade(fill, backtestId, strategy));
          }
        } else {
          pendingOrder = order;
        }
      }

      // ----------------------------------------------------
      // Step D: MARK TO MARKET & RECORD EQUITY POINT
      // ----------------------------------------------------
      const priceMap = new Map<string, number>([[primarySecurity.id, currentBar.close]]);
      portfolio.markToMarket(currentBar.timestamp, priceMap);
    }

    // Step E: Pending order at end of simulation data
    if (pendingOrder) {
      warnings.push(`Pending signal ${pendingOrder.signalId} at final simulation bar was not executed because no subsequent market open bar exists (PENDING_AT_END).`);
    }

    // ==========================================
    // 6. ACCOUNTING RECONCILIATION & METRICS
    // ==========================================
    const reconciliation = portfolio.reconcileAccounting();
    if (!reconciliation.reconciled) {
      warnings.push(`Accounting reconciliation discrepancy: Ending equity (${reconciliation.endingEquity}) differs from expected (${reconciliation.expectedEquity}) by ${reconciliation.difference}.`);
    }

    const equityCurve = portfolio.getEquityCurve();
    const finalEquity = portfolio.getTotalEquity();
    const totalReturn = Number(((finalEquity / config.initialCapital) - 1).toFixed(6));
    const totalReturnPct = Number((totalReturn * 100).toFixed(2));

    // Performance metrics calculation via Phase 12B Analytics Engine
    const perfAnalytics = backtestAnalyticsEngine.calculatePerformanceAnalytics(
      equityCurve,
      config.initialCapital,
      0 // default risk-free rate per Phase 12B specification
    );

    const durationDays = perfAnalytics.maxDrawdownDetails.durationDays || Math.max(1, equityCurve.length);
    const tradeAnalytics = backtestAnalyticsEngine.calculateTradeAnalytics(
      trades,
      config.initialCapital,
      portfolio.getAllPositions(),
      durationDays
    );

    const exposureSeries = backtestAnalyticsEngine.calculateExposureSeries(
      equityCurve,
      portfolio.getAllPositions()
    );

    const concentrationMetrics = backtestAnalyticsEngine.calculateConcentrationMetrics(
      portfolio.getAllPositions(),
      finalEquity
    );

    const attribution = backtestAnalyticsEngine.calculateSecurityAttribution(
      trades,
      portfolio.getAllPositions()
    );

    // Benchmark comparison calculation
    const benchmarkSymbol = config.benchmarkSymbol || (currency === 'INR' ? 'NIFTY50' : 'SPY');
    let resolvedBenchmarkBars = benchmarkBars;

    if (!resolvedBenchmarkBars && !config.isSimulatedBaseline) {
      try {
        const bmResponse = await marketDataProvider.getHistoricalPrices({
          symbol: benchmarkSymbol,
          securityId: benchmarkSymbol.toLowerCase(),
          market: (currency === 'INR' ? 'INDIA' : 'US') as MarketRegion,
          exchange: currency === 'INR' ? 'NSE' : 'NYSE',
          currency,
          interval: '1d',
          period: '5Y'
        });
        if (bmResponse.status === 'available' && bmResponse.bars && bmResponse.bars.length > 0) {
          resolvedBenchmarkBars = bmResponse.bars;
        }
      } catch {
        // Safe fallback: benchmark status will be UNAVAILABLE
      }
    }

    const benchmarkResults = backtestAnalyticsEngine.calculateBenchmarkComparison(
      equityCurve,
      totalReturnPct,
      resolvedBenchmarkBars,
      benchmarkSymbol,
      perfAnalytics.cagr
    );

    const epistemicStatus: EpistemicStatus = isDataSourceSimulated ? 'SIMULATED' : 'CALCULATED';

    const provenance: PointInTimeProvenance = {
      dataTimestamp: now,
      availableAt: now,
      retrievedAt: now,
      provider: providerName,
      source: `BacktestEngine (v1.0.0) -> ${providerName}`,
      sourceType: 'CALCULATED_METRIC',
      epistemicStatus,
      pointInTimeStrict: true,
      hasLookAheadBias: false,
      isSimulated: isDataSourceSimulated,
      notes: `Deterministic historical walk-forward simulation across ${equityCurve.length} trading bars. Look-ahead bias prohibited.`
    };

    const report = backtestAnalyticsEngine.generateReport(
      strategy.name,
      strategy.strategyId,
      backtestId,
      config,
      perfAnalytics,
      tradeAnalytics,
      exposureSeries,
      benchmarkResults,
      provenance,
      isDataSourceSimulated ? 'SIMULATED' : 'REAL',
      epistemicStatus,
      warnings,
      sortedBars.length,
      0
    );

    return {
      id: backtestId,
      backtestId,
      strategyId: strategy.strategyId,
      strategyTitle: strategy.name,
      strategyVersion: strategy.version || 'v1.0.0',
      configuration: config,
      status: 'COMPLETED',
      dataStatus: isDataSourceSimulated ? 'SIMULATED' : 'REAL',
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      finalEquity,
      totalReturn,
      totalReturnPct,
      cagr: perfAnalytics.cagr ?? 0,
      sharpeRatio: perfAnalytics.sharpeRatio ?? 0,
      sortinoRatio: perfAnalytics.sortinoRatio ?? 0,
      maxDrawdown: perfAnalytics.maxDrawdownPct,
      annualizedVol: perfAnalytics.annualizedVol,
      winRate: tradeAnalytics.statistics.winRate,
      profitFactor: tradeAnalytics.statistics.profitFactor ?? undefined,
      totalTrades: trades.length,
      tradesCount: trades.length,
      benchmarkTotalReturn: benchmarkResults.benchmarkTotalReturn,
      equityCurve,
      trades,
      tradeLog: trades,
      positions: portfolio.getAllPositions(),
      perfAnalytics,
      drawdownSeries: perfAnalytics.drawdownSeries,
      maxDrawdownDetails: perfAnalytics.maxDrawdownDetails,
      tradeStatistics: tradeAnalytics.statistics,
      turnover: tradeAnalytics.turnover,
      exposureSeries,
      concentrationMetrics,
      benchmarkResults,
      attribution,
      limitations: report.limitations,
      report,
      warnings: warnings.length > 0 ? warnings : {
        overfittingRisk: 'Standard quantitative walk-forward evaluation',
        lookAheadBias: 'Strict point-in-time enforcement (Zero look-ahead bias)',
        survivorshipBias: 'Evaluated against single canonical security history',
        transactionCostImpact: `Total transaction costs accounted: ${currency} ${portfolio.getTotalTransactionCosts()}`
      },
      dataQuality: validationResult.quality,
      provenance,
      epistemicStatus,
      totalRealizedPnL: portfolio.getTotalRealizedPnL(),
      totalUnrealizedPnL: portfolio.getTotalUnrealizedPnL(),
      totalTransactionCosts: portfolio.getTotalTransactionCosts(),
      totalSlippageCost: portfolio.getTotalSlippageCost(),
      isAnalyticalOnly: true,
      executionProhibited: true
    };
  }

  /**
   * Helper to map execution fill to BacktestTrade.
   */
  private mapFillToTrade(fill: ExecutionFill, backtestId: string, strategy: QuantStrategy): BacktestTrade {
    return {
      id: fill.tradeId,
      tradeId: fill.tradeId,
      backtestId,
      securityId: fill.securityId,
      symbol: fill.symbol,
      ticker: fill.symbol,
      date: fill.timestamp.split('T')[0],
      timestamp: fill.timestamp,
      signalTimestamp: fill.signalTimestamp,
      action: fill.side,
      side: fill.side,
      shares: fill.quantity,
      quantity: fill.quantity,
      price: fill.executionPrice,
      requestedPrice: fill.requestedPrice,
      executionPrice: fill.executionPrice,
      grossValue: fill.grossValue,
      slippage: fill.slippageCost,
      transactionCost: fill.transactionCost,
      netValue: fill.netValue,
      signalId: fill.signalId,
      strategyId: strategy.strategyId,
      strategyVersion: strategy.version || 'v1.0.0',
      executionModel: fill.executionModel,
      provenance: fill.provenance,
      realizedPnL: fill.realizedPnL,
      returnPct: fill.realizedPnL && fill.grossValue > 0 ? (fill.realizedPnL / fill.grossValue) * 100 : undefined,
      rationale: fill.rationale
    };
  }

  /**
   * Compute standard financial performance analytics from the equity curve and trade ledger.
   */
  private calculateMetrics(
    equityCurve: EquityPoint[],
    trades: BacktestTrade[],
    initialCapital: number
  ): {
    cagr: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    annualizedVol: number;
    winRate: number;
    profitFactor: number;
  } {
    if (equityCurve.length < 2) {
      return {
        cagr: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        annualizedVol: 0,
        winRate: 0,
        profitFactor: 0
      };
    }

    const finalEquity = equityCurve[equityCurve.length - 1].totalEquity;
    const totalReturn = (finalEquity - initialCapital) / initialCapital;

    // Daily returns
    const dailyReturns: number[] = [];
    let maxDrawdown = 0;

    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].totalEquity;
      const curr = equityCurve[i].totalEquity;
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev);
      }
      if (equityCurve[i].drawdown < maxDrawdown) {
        maxDrawdown = equityCurve[i].drawdown;
      }
    }

    // Annualization factor (252 trading days)
    const years = Math.max(0.1, dailyReturns.length / 252);
    const cagr = Number(((Math.pow(Math.max(0.01, finalEquity / initialCapital), 1 / years) - 1) * 100).toFixed(2));

    const meanDaily = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const variance = dailyReturns.length > 1
      ? dailyReturns.reduce((a, b) => a + Math.pow(b - meanDaily, 2), 0) / (dailyReturns.length - 1)
      : 0;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = Number((dailyVol * Math.sqrt(252) * 100).toFixed(2));

    // Sharpe ratio (assuming 2% risk-free rate)
    const rfDaily = 0.02 / 252;
    const sharpeRatio = dailyVol > 0
      ? Number(((meanDaily - rfDaily) / dailyVol * Math.sqrt(252)).toFixed(2))
      : 0;

    // Downside variance for Sortino
    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = downsideReturns.length > 1
      ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / (downsideReturns.length - 1)
      : 0;
    const downsideVol = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideVol > 0
      ? Number(((meanDaily - rfDaily) / downsideVol * Math.sqrt(252)).toFixed(2))
      : 0;

    // Trade stats
    const sellTrades = trades.filter(t => t.side === 'SELL');
    const winningTrades = sellTrades.filter(t => (t.realizedPnL || 0) > 0);
    const losingTrades = sellTrades.filter(t => (t.realizedPnL || 0) < 0);
    const winRate = sellTrades.length > 0 ? Number(((winningTrades.length / sellTrades.length) * 100).toFixed(2)) : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;

    return {
      cagr: isNaN(cagr) ? 0 : cagr,
      sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
      sortinoRatio: isNaN(sortinoRatio) ? 0 : sortinoRatio,
      maxDrawdown: Number(Math.abs(maxDrawdown).toFixed(2)),
      annualizedVol: isNaN(annualizedVol) ? 0 : annualizedVol,
      winRate,
      profitFactor
    };
  }

  /**
   * Helper to construct a BLOCKED or FAILED backtest result.
   */
  private createBlockedResult(
    backtestId: string,
    config: BacktestConfiguration,
    reasonCode: string,
    message: string
  ): BacktestResult {
    const now = new Date().toISOString();
    return {
      id: backtestId,
      backtestId,
      strategyId: config.strategyId,
      strategyTitle: config.strategyId,
      configuration: config,
      status: 'BLOCKED',
      dataStatus: 'UNAVAILABLE',
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital || 0,
      finalEquity: config.initialCapital || 0,
      totalReturn: 0,
      totalReturnPct: 0,
      cagr: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      annualizedVol: 0,
      winRate: 0,
      tradesCount: 0,
      benchmarkTotalReturn: 0,
      equityCurve: [],
      trades: [],
      tradeLog: [],
      positions: [],
      warnings: [`[${reasonCode}] ${message}`],
      dataQuality: 'INVALID',
      provenance: {
        dataTimestamp: now,
        availableAt: now,
        retrievedAt: now,
        provider: 'BacktestEngine',
        source: 'BacktestEngine (Validation Audit)',
        sourceType: 'SYSTEM_INTERNAL',
        epistemicStatus: 'UNAVAILABLE',
        pointInTimeStrict: true,
        hasLookAheadBias: false,
        isSimulated: true,
        notes: message
      },
      epistemicStatus: 'UNAVAILABLE',
      totalRealizedPnL: 0,
      totalUnrealizedPnL: 0,
      totalTransactionCosts: 0,
      totalSlippageCost: 0,
      isAnalyticalOnly: true,
      executionProhibited: true
    };
  }

  /**
   * Generate deterministic baseline bars if simulated data is explicitly requested.
   */
  private generateDeterministicFallbackBars(
    symbol: string,
    startDate: string,
    endDate: string,
    market: MarketRegion
  ): HistoricalPriceBar[] {
    const bars: HistoricalPriceBar[] = [];
    const basePrice = market === 'INDIA' ? 2500 : 180;
    let price = basePrice;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Provide 60 days before startDate for warm-up
    const warmUpStart = new Date(start.getTime() - 90 * 86400000);

    const cur = new Date(warmUpStart);
    let step = 0;

    while (cur <= end) {
      const dayOfWeek = cur.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
        step++;
        // Deterministic pseudo-random sine + trend variation
        const drift = 0.0004;
        const cycle = Math.sin(step * 0.1) * 0.015;
        const changePct = drift + cycle;
        const open = price;
        const close = Number((open * (1 + changePct)).toFixed(2));
        const high = Number((Math.max(open, close) * 1.008).toFixed(2));
        const low = Number((Math.min(open, close) * 0.992).toFixed(2));
        const volume = 1000000 + Math.floor(Math.abs(Math.sin(step)) * 500000);

        bars.push({
          timestamp: cur.toISOString(),
          open,
          high,
          low,
          close,
          volume,
          currency: market === 'INDIA' ? 'INR' : 'USD',
          securityId: symbol.toLowerCase(),
          market,
          exchange: market === 'INDIA' ? 'NSE' : 'NASDAQ',
          provider: 'SimulatedBaselineProvider',
          isSimulated: true,
          epistemicStatus: 'SIMULATED',
          corporateActionsAdjusted: true,
          provenance: {
            dataTimestamp: cur.toISOString(),
            availableAt: cur.toISOString(),
            retrievedAt: cur.toISOString(),
            provider: 'SimulatedBaselineProvider',
            source: 'SimulatedBaselineProvider (Deterministic Sine Walk)',
            sourceType: 'SIMULATED_BASELINE',
            epistemicStatus: 'SIMULATED',
            pointInTimeStrict: true,
            hasLookAheadBias: false,
            isSimulated: true,
            notes: 'Synthetic price bars for baseline verification'
          }
        });

        price = close;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return bars;
  }
}

export const backtestEngine = BacktestEngine.getInstance();
