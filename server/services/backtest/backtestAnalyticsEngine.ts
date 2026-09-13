/**
 * PHASE 12B — QUANTITATIVE BACKTEST ANALYTICS ENGINE
 * 
 * Computes deterministic performance, risk, trade, exposure, and benchmark analytics
 * by consuming Phase 12A core backtest simulation results.
 * 
 * Strict non-causality & determinism:
 * - Gemini must never alter trades, signals, metrics, equity, costs, or execution.
 * - All metrics are computed via pure mathematical functions.
 * - Epistemic status: CALCULATED (if real market data), SIMULATED (if baseline data).
 * - Never label backtest results as REAL.
 */

import {
  EquityPoint,
  BacktestTrade,
  SimulatedPosition,
  HistoricalPriceBar,
  BacktestConfiguration,
  DrawdownPoint,
  TradeStatistics,
  TurnoverMetrics,
  ExposurePoint,
  BacktestConcentrationMetrics,
  BenchmarkComparisonResult,
  SecurityAttribution,
  BacktestLimitations,
  BacktestReport,
  PointInTimeProvenance,
  EpistemicStatus,
  PerformanceAnalytics
} from '../../../src/types';

export type { PerformanceAnalytics };

export class BacktestAnalyticsEngine {
  private static instance: BacktestAnalyticsEngine;

  public static getInstance(): BacktestAnalyticsEngine {
    if (!BacktestAnalyticsEngine.instance) {
      BacktestAnalyticsEngine.instance = new BacktestAnalyticsEngine();
    }
    return BacktestAnalyticsEngine.instance;
  }

  /**
   * Primary entry point: Compute comprehensive performance analytics from equity curve.
   */
  public calculatePerformanceAnalytics(
    equityCurve: EquityPoint[],
    initialCapital: number,
    riskFreeRate: number = 0
  ): PerformanceAnalytics {
    if (!equityCurve || equityCurve.length === 0) {
      return this.getEmptyPerformanceAnalytics(initialCapital);
    }

    const finalPoint = equityCurve[equityCurve.length - 1];
    const finalEquity = finalPoint.totalEquity ?? finalPoint.strategy ?? initialCapital;

    // 1. Total Return
    const totalReturn = Number(((finalEquity / initialCapital) - 1).toFixed(6));
    const totalReturnPct = Number((totalReturn * 100).toFixed(2));

    // 2. Duration & CAGR
    const firstTimestamp = equityCurve[0].timestamp || equityCurve[0].date;
    const lastTimestamp = finalPoint.timestamp || finalPoint.date;
    const startDate = new Date(firstTimestamp);
    const endDate = new Date(lastTimestamp);
    const diffMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    // Do not calculate misleading CAGR for extremely short periods (< 30 days or < 10 bars)
    let cagr: number | null = null;
    if (durationDays >= 30 && equityCurve.length >= 10 && finalEquity > 0) {
      const years = durationDays / 365.25;
      const cagrValue = Math.pow(finalEquity / initialCapital, 1 / years) - 1;
      if (isFinite(cagrValue)) {
        cagr = Number((cagrValue * 100).toFixed(2));
      }
    }

    // 3. Periodic (Daily) Returns
    const periodReturns: number[] = [];
    let positiveDaysCount = 0;
    let negativeDaysCount = 0;
    let bestDayPct = 0;
    let worstDayPct = 0;

    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i - 1].totalEquity ?? equityCurve[i - 1].strategy ?? initialCapital;
      const currEquity = equityCurve[i].totalEquity ?? equityCurve[i].strategy ?? initialCapital;

      if (prevEquity > 0) {
        const r = (currEquity - prevEquity) / prevEquity;
        periodReturns.push(r);

        const rPct = r * 100;
        if (rPct > bestDayPct) bestDayPct = rPct;
        if (rPct < worstDayPct) worstDayPct = rPct;
        if (r > 0) positiveDaysCount++;
        else if (r < 0) negativeDaysCount++;
      }
    }

    bestDayPct = Number(bestDayPct.toFixed(2));
    worstDayPct = Number(worstDayPct.toFixed(2));

    // 4. Annualized Volatility
    let annualizedVol = 0;
    let meanDailyReturn = 0;

    if (periodReturns.length >= 2) {
      const sum = periodReturns.reduce((acc, val) => acc + val, 0);
      meanDailyReturn = sum / periodReturns.length;

      const variance = periodReturns.reduce((acc, val) => acc + Math.pow(val - meanDailyReturn, 2), 0) / (periodReturns.length - 1);
      const dailyStdDev = Math.sqrt(variance);
      annualizedVol = Number((dailyStdDev * Math.sqrt(252) * 100).toFixed(2));
    }

    // 5. Drawdown Series & Maximum Drawdown
    let runningPeak = initialCapital;
    let maxDrawdown = 0; // in currency units
    let maxDrawdownPct = 0; // percentage
    let peakDate: string | undefined;
    let troughDate: string | undefined;
    let currentPeakDate = firstTimestamp;

    const drawdownSeries: DrawdownPoint[] = [];

    for (const pt of equityCurve) {
      const eq = pt.totalEquity ?? pt.strategy ?? initialCapital;
      const ts = pt.timestamp || pt.date;

      if (eq > runningPeak) {
        runningPeak = eq;
        currentPeakDate = ts;
      }

      const dd = runningPeak - eq;
      const ddPct = runningPeak > 0 ? (dd / runningPeak) * 100 : 0;

      if (ddPct > maxDrawdownPct) {
        maxDrawdownPct = ddPct;
        maxDrawdown = dd;
        peakDate = currentPeakDate;
        troughDate = ts;
      }

      drawdownSeries.push({
        timestamp: ts,
        equity: Number(eq.toFixed(2)),
        runningPeak: Number(runningPeak.toFixed(2)),
        drawdown: Number(dd.toFixed(2)),
        drawdownPct: Number(ddPct.toFixed(2))
      });
    }

    maxDrawdown = Number(maxDrawdown.toFixed(2));
    maxDrawdownPct = Number(maxDrawdownPct.toFixed(2));

    // Find recovery timestamp if applicable
    let recoveryDate: string | undefined;
    if (troughDate && peakDate) {
      const troughIdx = equityCurve.findIndex(p => (p.timestamp || p.date) === troughDate);
      const peakIdx = equityCurve.findIndex(p => (p.timestamp || p.date) === peakDate);
      const peakVal = equityCurve[peakIdx]?.totalEquity ?? initialCapital;

      for (let i = troughIdx + 1; i < equityCurve.length; i++) {
        const eq = equityCurve[i].totalEquity ?? equityCurve[i].strategy ?? 0;
        if (eq >= peakVal) {
          recoveryDate = equityCurve[i].timestamp || equityCurve[i].date;
          break;
        }
      }
    }

    // 6. Sharpe Ratio
    // rf is annual risk-free rate (e.g. 0.04 or 0). Default: 0
    let sharpeRatio: number | null = null;
    if (periodReturns.length >= 5 && annualizedVol > 0) {
      const annualStrategyReturn = cagr !== null ? cagr / 100 : (meanDailyReturn * 252);
      const sharpe = (annualStrategyReturn - riskFreeRate) / (annualizedVol / 100);
      if (isFinite(sharpe)) {
        sharpeRatio = Number(sharpe.toFixed(2));
      }
    }

    // 7. Sortino Ratio (Downside Deviation below target risk-free rate)
    let sortinoRatio: number | null = null;
    let downsideDeviation = 0;

    if (periodReturns.length >= 5) {
      const dailyRf = riskFreeRate / 252;
      const negativeDiffs = periodReturns.map(r => Math.min(0, r - dailyRf));
      const sumSqDownside = negativeDiffs.reduce((acc, diff) => acc + Math.pow(diff, 2), 0);
      const meanSqDownside = sumSqDownside / periodReturns.length;
      const dailyDownsideDev = Math.sqrt(meanSqDownside);
      downsideDeviation = Number((dailyDownsideDev * Math.sqrt(252) * 100).toFixed(2));

      if (downsideDeviation > 0) {
        const annualStrategyReturn = cagr !== null ? cagr / 100 : (meanDailyReturn * 252);
        const sortino = (annualStrategyReturn - riskFreeRate) / (downsideDeviation / 100);
        if (isFinite(sortino)) {
          sortinoRatio = Number(sortino.toFixed(2));
        }
      }
    }

    return {
      totalReturn,
      totalReturnPct,
      cagr,
      annualizedVol,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownPct,
      maxDrawdownDetails: {
        maxDrawdown,
        maxDrawdownPct,
        peakDate,
        troughDate,
        recoveryDate,
        durationDays
      },
      drawdownSeries,
      periodReturns,
      dailyReturnsCount: periodReturns.length,
      bestDayPct,
      worstDayPct,
      positiveDaysCount,
      negativeDaysCount,
      downsideDeviation
    };
  }

  /**
   * Compute trade statistics from actual Phase 12A executed trades.
   */
  public calculateTradeAnalytics(
    trades: BacktestTrade[],
    initialCapital: number,
    positions: SimulatedPosition[] = [],
    durationDays: number = 365
  ): { statistics: TradeStatistics; turnover: TurnoverMetrics } {
    const validPositions = Array.isArray(positions) ? positions : [];
    const validDurationDays = typeof positions === 'number' ? positions : (typeof durationDays === 'number' ? durationDays : 365);
    const totalTrades = trades.length;
    let totalNotionalTraded = 0;

    // Filter trades that have realizedPnL
    const closedTradesList = trades.filter(t => t.realizedPnL !== undefined && t.realizedPnL !== null);
    const closedTrades = closedTradesList.length;

    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;
    let grossProfits = 0;
    let grossLosses = 0;
    let largestWin = 0;
    let largestLoss = 0;
    let totalHoldingBars = 0;

    for (const t of trades) {
      totalNotionalTraded += t.grossValue || (t.shares * t.price) || 0;
    }

    for (const ct of closedTradesList) {
      const pnl = ct.realizedPnL || 0;
      if (pnl > 0.0001) {
        winningTrades++;
        grossProfits += pnl;
        if (pnl > largestWin) largestWin = pnl;
      } else if (pnl < -0.0001) {
        losingTrades++;
        const absLoss = Math.abs(pnl);
        grossLosses += absLoss;
        if (absLoss > largestLoss) largestLoss = absLoss;
      } else {
        breakEvenTrades++;
      }

      // Estimate holding period from signal/date timestamps if available
      if (ct.signalTimestamp && ct.timestamp) {
        const ms = new Date(ct.timestamp).getTime() - new Date(ct.signalTimestamp).getTime();
        const days = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
        totalHoldingBars += days;
      } else {
        totalHoldingBars += 5; // default reasonable estimation
      }
    }

    const winRate = closedTrades > 0 ? Number(((winningTrades / closedTrades) * 100).toFixed(2)) : 0;
    const lossRate = closedTrades > 0 ? Number(((losingTrades / closedTrades) * 100).toFixed(2)) : 0;

    // Profit factor: gross profits / gross losses.
    // If gross losses === 0: return null (do NOT silently return 0)
    let profitFactor: number | null = null;
    if (closedTrades > 0) {
      if (grossLosses > 0) {
        profitFactor = Number((grossProfits / grossLosses).toFixed(2));
      } else if (grossProfits > 0) {
        profitFactor = null; // explicit infinite / no loss state
      }
    }

    const averageWinningTrade = winningTrades > 0 ? Number((grossProfits / winningTrades).toFixed(2)) : 0;
    const averageLosingTrade = losingTrades > 0 ? Number((grossLosses / losingTrades).toFixed(2)) : 0;
    const winLossRatio = averageLosingTrade > 0 ? Number((averageWinningTrade / averageLosingTrade).toFixed(2)) : null;

    const averageHoldingPeriodDays = closedTrades > 0 ? Number((totalHoldingBars / closedTrades).toFixed(1)) : 0;
    const averageHoldingPeriodBars = Math.round(averageHoldingPeriodDays);

    // Turnover calculations
    const grossTurnover = initialCapital > 0 ? Number((totalNotionalTraded / initialCapital).toFixed(2)) : 0;
    const annualizedTurnover = validDurationDays > 0 ? Number((grossTurnover * (365.25 / validDurationDays)).toFixed(2)) : grossTurnover;
    const averageTradeSize = totalTrades > 0 ? Number((totalNotionalTraded / totalTrades).toFixed(2)) : 0;

    const openPositionsCount = validPositions.filter(p => p.quantity > 0).length;

    const statistics: TradeStatistics = {
      totalTrades,
      closedTrades,
      openPositions: openPositionsCount,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winRate,
      lossRate,
      profitFactor,
      averageWinningTrade,
      averageLosingTrade,
      winLossRatio,
      largestWin: Number(largestWin.toFixed(2)),
      largestLoss: Number(largestLoss.toFixed(2)),
      averageHoldingPeriodBars,
      averageHoldingPeriodDays,
      grossProfits: Number(grossProfits.toFixed(2)),
      grossLosses: Number(grossLosses.toFixed(2))
    };

    const turnover: TurnoverMetrics = {
      grossTurnover,
      annualizedTurnover,
      totalNotionalTraded: Number(totalNotionalTraded.toFixed(2)),
      averageTradeSize
    };

    return { statistics, turnover };
  }

  /**
   * Compute portfolio exposure series over time.
   */
  public calculateExposureSeries(
    equityCurve: EquityPoint[],
    positions: SimulatedPosition[] = []
  ): ExposurePoint[] {
    const series: ExposurePoint[] = [];

    for (const pt of equityCurve) {
      const eq = pt.totalEquity ?? pt.strategy ?? 100000;
      const cash = pt.cash ?? (eq - (pt.positionsValue || 0));
      const posVal = pt.positionsValue ?? Math.max(0, eq - cash);

      const grossExposure = eq > 0 ? Number((posVal / eq).toFixed(4)) : 0;
      const netExposure = grossExposure; // long-only constraint
      const cashPercentage = eq > 0 ? Number(((cash / eq) * 100).toFixed(2)) : 100;
      const investedPercentage = eq > 0 ? Number(((posVal / eq) * 100).toFixed(2)) : 0;

      // Active largest position
      let largestPositionPct = 0;
      let largestPositionSymbol = 'CASH';

      for (const p of positions) {
        if (p.marketValue > 0) {
          const pct = eq > 0 ? (p.marketValue / eq) * 100 : 0;
          if (pct > largestPositionPct) {
            largestPositionPct = pct;
            largestPositionSymbol = p.symbol;
          }
        }
      }

      series.push({
        timestamp: pt.timestamp || pt.date,
        grossExposure,
        netExposure,
        cashPercentage,
        investedPercentage,
        largestPositionPct: Number(largestPositionPct.toFixed(2)),
        largestPositionSymbol,
        positionsCount: positions.length
      });
    }

    return series;
  }

  /**
   * Compute portfolio concentration metrics.
   */
  public calculateConcentrationMetrics(
    positions: SimulatedPosition[],
    totalEquity: number
  ): BacktestConcentrationMetrics {
    if (!positions || positions.length === 0 || totalEquity <= 0) {
      return {
        largestPositionWeight: 0,
        largestPositionSymbol: 'NONE',
        top3Concentration: 0,
        top5Concentration: 0,
        herfindahlIndex: 0,
        sectorConcentration: [],
        marketConcentration: [],
        maxSinglePositionPct: 0,
        top5ConcentrationPct: 0
      };
    }

    const weights = positions
      .filter(p => p.quantity > 0)
      .map(p => ({
        symbol: p.symbol,
        weightPct: Number(((p.marketValue / totalEquity) * 100).toFixed(2)),
        currency: p.currency
      }))
      .sort((a, b) => b.weightPct - a.weightPct);

    const largestPosition = weights[0] || { symbol: 'NONE', weightPct: 0 };

    const top3 = weights.slice(0, 3).reduce((acc, w) => acc + w.weightPct, 0);
    const top5 = weights.slice(0, 5).reduce((acc, w) => acc + w.weightPct, 0);

    // Herfindahl-Hirschman Index (sum of squared fractional weights)
    const hhi = weights.reduce((acc, w) => acc + Math.pow(w.weightPct / 100, 2), 0);

    const marketMap = new Map<string, number>();
    for (const p of positions) {
      const mkt = p.currency === 'INR' ? 'INDIA' : 'US';
      const prev = marketMap.get(mkt) || 0;
      marketMap.set(mkt, prev + ((p.marketValue / totalEquity) * 100));
    }

    const marketConcentration = Array.from(marketMap.entries()).map(([market, weightPct]) => ({
      market: market as any,
      weightPct: Number(weightPct.toFixed(2))
    }));

    return {
      largestPositionWeight: largestPosition.weightPct,
      largestPositionSymbol: largestPosition.symbol,
      top3Concentration: Number(top3.toFixed(2)),
      top5Concentration: Number(top5.toFixed(2)),
      herfindahlIndex: Number(hhi.toFixed(4)),
      sectorConcentration: [{ sector: 'Equities', weightPct: Number(weights.reduce((a, b) => a + b.weightPct, 0).toFixed(2)) }],
      marketConcentration,
      maxSinglePositionPct: largestPosition.weightPct,
      top5ConcentrationPct: Number(top5.toFixed(2))
    };
  }

  /**
   * Compute security P&L attribution.
   */
  public calculateSecurityAttribution(
    trades: BacktestTrade[],
    positions: SimulatedPosition[] = [],
    portfolioEquity: number = 100000
  ): SecurityAttribution[] {
    const map = new Map<string, {
      securityId: string;
      symbol: string;
      realizedPnL: number;
      unrealizedPnL: number;
      totalTrades: number;
      currency: string;
    }>();

    for (const t of trades) {
      const secId = t.securityId || t.ticker.toLowerCase();
      const sym = t.symbol || t.ticker;
      const existing = map.get(secId) || {
        securityId: secId,
        symbol: sym,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalTrades: 0,
        currency: 'USD'
      };

      existing.totalTrades++;
      if (t.realizedPnL !== undefined) {
        existing.realizedPnL += t.realizedPnL;
      }
      map.set(secId, existing);
    }

    for (const p of positions) {
      const secId = p.securityId || p.symbol.toLowerCase();
      const existing = map.get(secId) || {
        securityId: secId,
        symbol: p.symbol,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalTrades: 0,
        currency: p.currency || 'USD'
      };

      existing.unrealizedPnL = p.unrealizedPnL;
      existing.currency = p.currency || existing.currency;
      map.set(secId, existing);
    }

    const totalPortfolioPnL = Array.from(map.values()).reduce(
      (acc, item) => acc + (item.realizedPnL + item.unrealizedPnL),
      0
    );

    return Array.from(map.values()).map(item => {
      const totalPnL = Number((item.realizedPnL + item.unrealizedPnL).toFixed(2));
      const pnlContributionPct = totalPortfolioPnL !== 0
        ? Number(((totalPnL / Math.abs(totalPortfolioPnL)) * 100).toFixed(2))
        : 0;

      return {
        securityId: item.securityId,
        symbol: item.symbol,
        realizedPnL: Number(item.realizedPnL.toFixed(2)),
        unrealizedPnL: Number(item.unrealizedPnL.toFixed(2)),
        totalPnL,
        pnlContributionPct,
        totalTrades: item.totalTrades,
        currency: item.currency
      };
    });
  }

  /**
   * Benchmark comparison analytics.
   * If real historical benchmark bars are unavailable, returns UNAVAILABLE.
   */
  public calculateBenchmarkComparison(
    strategyEquityCurve: EquityPoint[],
    strategyTotalReturnPct: number,
    benchmarkBars?: HistoricalPriceBar[],
    benchmarkSymbol: string = 'SPY',
    strategyCagr: number | null = null
  ): BenchmarkComparisonResult {
    if (!benchmarkBars || benchmarkBars.length === 0) {
      return {
        benchmarkSymbol,
        status: 'UNAVAILABLE',
        benchmarkTotalReturn: 0,
        strategyTotalReturn: strategyTotalReturnPct,
        excessReturn: 0,
        annualizedBenchmarkReturn: null,
        annualizedExcessReturn: null,
        beta: null,
        correlation: null,
        trackingError: null,
        informationRatio: null,
        notes: `Real historical benchmark bars for ${benchmarkSymbol} are unavailable. Returns not fabricated.`
      };
    }

    const sortedBars = [...benchmarkBars].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstClose = sortedBars[0].close;
    const lastClose = sortedBars[sortedBars.length - 1].close;

    if (firstClose <= 0) {
      return {
        benchmarkSymbol,
        status: 'UNAVAILABLE',
        benchmarkTotalReturn: 0,
        strategyTotalReturn: strategyTotalReturnPct,
        excessReturn: 0,
        annualizedBenchmarkReturn: null,
        annualizedExcessReturn: null,
        beta: null,
        correlation: null,
        trackingError: null,
        informationRatio: null,
        notes: 'Invalid benchmark initial price'
      };
    }

    const benchmarkTotalReturn = Number((((lastClose / firstClose) - 1) * 100).toFixed(2));
    const excessReturn = Number((strategyTotalReturnPct - benchmarkTotalReturn).toFixed(2));

    // Annualized benchmark return
    const diffMs = new Date(sortedBars[sortedBars.length - 1].timestamp).getTime() - new Date(sortedBars[0].timestamp).getTime();
    const durationDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    let annualizedBenchmarkReturn: number | null = null;
    let annualizedExcessReturn: number | null = null;

    if (durationDays >= 30 && sortedBars.length >= 10 && lastClose > 0) {
      const years = durationDays / 365.25;
      const annVal = (Math.pow(lastClose / firstClose, 1 / years) - 1) * 100;
      if (isFinite(annVal)) {
        annualizedBenchmarkReturn = Number(annVal.toFixed(2));
        if (strategyCagr !== null) {
          annualizedExcessReturn = Number((strategyCagr - annualizedBenchmarkReturn).toFixed(2));
        }
      }
    }

    // Benchmark daily returns
    const benchmarkReturns: number[] = [];
    for (let i = 1; i < sortedBars.length; i++) {
      const prev = sortedBars[i - 1].close;
      const curr = sortedBars[i].close;
      if (prev > 0) benchmarkReturns.push((curr - prev) / prev);
    }

    // Strategy daily returns
    const stratReturns: number[] = [];
    for (let i = 1; i < strategyEquityCurve.length; i++) {
      const prev = strategyEquityCurve[i - 1].totalEquity || 100000;
      const curr = strategyEquityCurve[i].totalEquity || 100000;
      if (prev > 0) stratReturns.push((curr - prev) / prev);
    }

    // Correlation and Beta if observations align
    let correlation: number | null = null;
    let beta: number | null = null;
    let trackingError: number | null = null;
    let informationRatio: number | null = null;

    const minLen = Math.min(stratReturns.length, benchmarkReturns.length);
    if (minLen >= 10) {
      const sSlice = stratReturns.slice(0, minLen);
      const bSlice = benchmarkReturns.slice(0, minLen);

      const meanS = sSlice.reduce((a, b) => a + b, 0) / minLen;
      const meanB = bSlice.reduce((a, b) => a + b, 0) / minLen;

      let cov = 0;
      let varB = 0;
      let varS = 0;
      const diffReturns: number[] = [];

      for (let i = 0; i < minLen; i++) {
        const diffS = sSlice[i] - meanS;
        const diffB = bSlice[i] - meanB;
        cov += diffS * diffB;
        varB += diffB * diffB;
        varS += diffS * diffS;
        diffReturns.push(sSlice[i] - bSlice[i]);
      }

      if (varB > 0 && varS > 0) {
        const corr = cov / Math.sqrt(varS * varB);
        if (isFinite(corr)) correlation = Number(corr.toFixed(2));

        const b = cov / varB;
        if (isFinite(b)) beta = Number(b.toFixed(2));
      }

      // Tracking Error: annualized std dev of excess returns
      const meanDiff = diffReturns.reduce((a, b) => a + b, 0) / minLen;
      const varDiff = diffReturns.reduce((a, b) => a + Math.pow(b - meanDiff, 2), 0) / (minLen - 1);
      const te = Math.sqrt(varDiff) * Math.sqrt(252) * 100;
      if (isFinite(te) && te > 0) {
        trackingError = Number(te.toFixed(2));
        if (annualizedExcessReturn !== null) {
          const ir = annualizedExcessReturn / te;
          if (isFinite(ir)) informationRatio = Number(ir.toFixed(2));
        }
      }
    }

    const isSim = sortedBars.some(b => b.isSimulated);
    const epistemicStatus: EpistemicStatus = isSim ? 'SIMULATED' : 'CALCULATED';

    return {
      benchmarkSymbol,
      status: 'CALCULATED',
      benchmarkTotalReturn,
      strategyTotalReturn: strategyTotalReturnPct,
      excessReturn,
      annualizedBenchmarkReturn,
      annualizedExcessReturn,
      beta,
      correlation,
      trackingError,
      informationRatio,
      epistemicStatus
    };
  }

  /**
   * Compile a comprehensive BacktestReport.
   */
  public generateReport(
    strategyTitle: string,
    strategyId: string,
    backtestId: string,
    config: BacktestConfiguration,
    performance: PerformanceAnalytics,
    trading: { statistics: TradeStatistics; turnover: TurnoverMetrics },
    exposure: ExposurePoint[],
    benchmark: BenchmarkComparisonResult | null,
    provenance: PointInTimeProvenance,
    dataStatus: 'REAL' | 'SIMULATED' | 'UNAVAILABLE',
    epistemicStatus: EpistemicStatus,
    warnings: string[],
    totalBars: number,
    missingBars: number
  ): BacktestReport {
    const investedPcts = exposure.map(e => e.investedPercentage);
    const cashPcts = exposure.map(e => e.cashPercentage);

    const averageInvestedPct = investedPcts.length > 0
      ? Number((investedPcts.reduce((a, b) => a + b, 0) / investedPcts.length).toFixed(2))
      : 0;
    const maxInvestedPct = investedPcts.length > 0 ? Math.max(...investedPcts) : 0;

    const averageCashPct = cashPcts.length > 0
      ? Number((cashPcts.reduce((a, b) => a + b, 0) / cashPcts.length).toFixed(2))
      : 100;
    const maxCashPct = cashPcts.length > 0 ? Math.max(...cashPcts) : 100;

    const peakPositionsCount = exposure.length > 0
      ? Math.max(...exposure.map(e => e.positionsCount))
      : 0;

    const limitations: BacktestLimitations = {
      survivorshipBiasRisk: 'SURVIVORSHIP_BIAS_POSSIBLE',
      delistingDataStatus: 'DELISTING_DATA_UNAVAILABLE',
      corporateActionsAdjustment: config.corporateActionAdjustment || 'ADJUSTED',
      lookAheadBiasProtection: 'STRICT_POINT_IN_TIME',
      executionModelDescription: config.executionTiming === 'SAME_BAR_CLOSE'
        ? 'Executed at Bar T Close price (MOC assumption)'
        : 'Executed at Bar T+1 Open price with adverse slippage widening',
      epistemicDisclaimer: 'Historical backtest results are strictly analytical simulations and do not guarantee future performance. Market liquidity, exchange outages, and regime shifts are not fully modeled.'
    };

    const finalEquity = performance.drawdownSeries.length > 0
      ? performance.drawdownSeries[performance.drawdownSeries.length - 1].equity
      : config.initialCapital;

    return {
      executiveSummary: {
        strategyName: strategyTitle,
        strategyId,
        backtestId,
        period: `${config.startDate} to ${config.endDate}`,
        totalReturnPct: performance.totalReturnPct,
        cagr: performance.cagr,
        sharpeRatio: performance.sharpeRatio,
        maxDrawdownPct: performance.maxDrawdownPct,
        winRate: trading.statistics.winRate,
        profitFactor: trading.statistics.profitFactor,
        finalEquity,
        initialCapital: config.initialCapital
      },
      performance: {
        totalReturn: performance.totalReturn,
        totalReturnPct: performance.totalReturnPct,
        cagr: performance.cagr,
        periodReturnsCount: performance.periodReturns.length,
        bestDayPct: performance.bestDayPct,
        worstDayPct: performance.worstDayPct,
        positiveDaysCount: performance.positiveDaysCount,
        negativeDaysCount: performance.negativeDaysCount
      },
      risk: {
        annualizedVolatility: performance.annualizedVol,
        sharpeRatio: performance.sharpeRatio,
        sortinoRatio: performance.sortinoRatio,
        maxDrawdown: performance.maxDrawdown,
        maxDrawdownDetails: performance.maxDrawdownDetails,
        downsideDeviation: performance.downsideDeviation
      },
      trading: {
        ...trading.statistics,
        ...trading.turnover
      },
      exposure: {
        averageInvestedPct,
        maxInvestedPct,
        averageCashPct,
        maxCashPct,
        peakPositionsCount
      },
      benchmark,
      dataQuality: {
        provider: provenance.provider,
        market: (config.currency === 'INR' ? 'INDIA' : 'US'),
        exchange: (config.currency === 'INR' ? 'NSE' : 'NASDAQ'),
        currency: config.currency,
        startDate: config.startDate,
        endDate: config.endDate,
        totalBars,
        missingBars,
        corporateActionsAdjusted: config.corporateActionAdjustment !== 'UNADJUSTED',
        dataStatus,
        epistemicStatus
      },
      provenance,
      warnings,
      limitations
    };
  }

  private getEmptyPerformanceAnalytics(initialCapital: number): PerformanceAnalytics {
    return {
      totalReturn: 0,
      totalReturnPct: 0,
      cagr: null,
      annualizedVol: 0,
      sharpeRatio: null,
      sortinoRatio: null,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      maxDrawdownDetails: {
        maxDrawdown: 0,
        maxDrawdownPct: 0
      },
      drawdownSeries: [],
      periodReturns: [],
      dailyReturnsCount: 0,
      bestDayPct: 0,
      worstDayPct: 0,
      positiveDaysCount: 0,
      negativeDaysCount: 0,
      downsideDeviation: 0
    };
  }
}

export const backtestAnalyticsEngine = BacktestAnalyticsEngine.getInstance();
