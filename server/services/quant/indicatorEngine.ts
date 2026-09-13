/**
 * Deterministic Quantitative Indicator Engine (Phase 11)
 * 
 * Provides purely mathematical, auditable, and transparent calculations of
 * financial technical and momentum indicators.
 * 
 * Key Principles:
 * 1. 100% Deterministic — Zero external libraries, zero AI dependency.
 * 2. Zero Look-Ahead Bias — Evaluation at time t strictly operates on data available at or before t.
 * 3. Explicit Missing Data Handling — Never substitutes zeros for missing values; returns typed UNAVAILABLE / INSUFFICIENT_DATA.
 * 4. Epistemic Status Integrity — Real market data yields CALCULATED indicators; simulated market data propagates SIMULATED.
 */

import {
  HistoricalPriceBar,
  CalculatedIndicator,
  IndicatorType,
  EpistemicStatus,
  MarketRegion
} from '../../../src/types';

export interface IndicatorContext {
  securityId: string;
  symbol: string;
  market: MarketRegion;
  exchange: string;
  provider: string;
  underlyingEpistemicStatus: EpistemicStatus;
}

export class IndicatorEngine {
  public static readonly VERSION = 'v1.0.0';

  /**
   * Determine epistemic status of calculated indicator
   * REAL market data -> CALCULATED
   * SIMULATED market data -> SIMULATED
   * UNAVAILABLE -> UNAVAILABLE
   */
  public static deriveEpistemicStatus(underlyingStatus: EpistemicStatus): EpistemicStatus {
    if (underlyingStatus === 'REAL') return 'CALCULATED';
    if (underlyingStatus === 'SIMULATED') return 'SIMULATED';
    return 'UNAVAILABLE';
  }

  // ==========================================
  // 1. SIMPLE MOVING AVERAGE (SMA)
  // ==========================================
  /**
   * SMA(n) = sum(close[t - n + 1 .. t]) / n
   * Requires at least n bars. Uses only data through evaluation bar.
   */
  public static calculateSMA(
    bars: HistoricalPriceBar[],
    period: number,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `sma-${period}`;
    const name = `SMA(${period})`;
    const parameters = { period };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (period <= 0 || !Number.isInteger(period)) {
      return this.createErrorIndicator(id, name, 'SMA', parameters, timestamp, baseContext,
        `Invalid SMA period: ${period}. Period must be a positive integer.`);
    }

    if (barCount < period) {
      return this.createInsufficientIndicator(id, name, 'SMA', parameters, timestamp, barCount, period, baseContext,
        `Insufficient data for SMA(${period}): requires ${period} bars, but only ${barCount} provided.`);
    }

    // Calculate full series for previous value and history
    const history: (number | null)[] = [];
    for (let i = 0; i < barCount; i++) {
      if (i < period - 1) {
        history.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += bars[j].close;
        }
        history.push(Number((sum / period).toFixed(4)));
      }
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'SMA',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars: period
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Arithmetic mean of closing prices over ${period} periods: sum(close) / ${period}`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 2. EXPONENTIAL MOVING AVERAGE (EMA)
  // ==========================================
  /**
   * EMA_t = alpha * close_t + (1 - alpha) * EMA_(t-1)
   * where alpha = 2 / (period + 1)
   * Initialization: The initial seed EMA at bar index (period - 1) is the
   * Simple Moving Average (SMA) of the first period bars: sum(close[0..period-1]) / period.
   * Bars before index (period - 1) return null.
   */
  public static calculateEMA(
    bars: HistoricalPriceBar[],
    period: number,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `ema-${period}`;
    const name = `EMA(${period})`;
    const parameters = { period };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (period <= 0 || !Number.isInteger(period)) {
      return this.createErrorIndicator(id, name, 'EMA', parameters, timestamp, baseContext,
        `Invalid EMA period: ${period}. Must be a positive integer.`);
    }

    if (barCount < period) {
      return this.createInsufficientIndicator(id, name, 'EMA', parameters, timestamp, barCount, period, baseContext,
        `Insufficient data for EMA(${period}): requires ${period} bars, but only ${barCount} provided.`);
    }

    const alpha = 2 / (period + 1);
    const history: (number | null)[] = [];

    // 1. Initial SMA seed at index period - 1
    let sumSeed = 0;
    for (let i = 0; i < period; i++) {
      sumSeed += bars[i].close;
      if (i < period - 1) {
        history.push(null);
      }
    }
    let currentEma = sumSeed / period;
    history.push(Number(currentEma.toFixed(4)));

    // 2. Recursive calculation for remaining bars
    for (let i = period; i < barCount; i++) {
      currentEma = alpha * bars[i].close + (1 - alpha) * currentEma;
      history.push(Number(currentEma.toFixed(4)));
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'EMA',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars: period
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Standard recursive EMA with alpha = 2/(${period}+1), initialized with SMA of first ${period} bars`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 3. RELATIVE STRENGTH INDEX (RSI)
  // ==========================================
  /**
   * Wilder's Smoothed Relative Strength Index (RSI)
   * 1. Change = close[t] - close[t-1]
   * 2. Initial average gain & loss over first 'period' changes (bars 1 to period):
   *    avgGain_0 = sum(gains) / period, avgLoss_0 = sum(losses) / period
   * 3. Subsequent bars t > period:
   *    avgGain_t = (avgGain_(t-1) * (period - 1) + gain_t) / period
   *    avgLoss_t = (avgLoss_(t-1) * (period - 1) + loss_t) / period
   * 4. RS = avgGain / avgLoss
   *    RSI = 100 - (100 / (1 + RS))
   * Requires at least period + 1 bars.
   */
  public static calculateRSI(
    bars: HistoricalPriceBar[],
    period: number = 14,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `rsi-${period}`;
    const name = `RSI(${period})`;
    const parameters = { period };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (period <= 0 || !Number.isInteger(period)) {
      return this.createErrorIndicator(id, name, 'RSI', parameters, timestamp, baseContext,
        `Invalid RSI period: ${period}. Must be a positive integer.`);
    }

    const requiredBars = period + 1;
    if (barCount < requiredBars) {
      return this.createInsufficientIndicator(id, name, 'RSI', parameters, timestamp, barCount, requiredBars, baseContext,
        `Insufficient data for RSI(${period}): requires ${requiredBars} bars (for ${period} changes), but only ${barCount} provided.`);
    }

    const history: (number | null)[] = new Array(period).fill(null);

    // Initial sum of gains and losses for first 'period' price changes
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
      const diff = bars[i].close - bars[i - 1].close;
      if (diff > 0) gainSum += diff;
      else if (diff < 0) lossSum += Math.abs(diff);
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    const computeRsi = (gain: number, loss: number): number => {
      if (loss === 0) return 100;
      if (gain === 0) return 0;
      const rs = gain / loss;
      return Number((100 - (100 / (1 + rs))).toFixed(2));
    };

    history.push(computeRsi(avgGain, avgLoss));

    // Wilder's smoothing for subsequent bars
    for (let i = period + 1; i < barCount; i++) {
      const diff = bars[i].close - bars[i - 1].close;
      const currentGain = diff > 0 ? diff : 0;
      const currentLoss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      history.push(computeRsi(avgGain, avgLoss));
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'RSI',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Wilder's smoothed RSI(${period}): 100 - (100 / (1 + AvgGain/AvgLoss))`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 4. RATE OF CHANGE (ROC) / MOMENTUM
  // ==========================================
  /**
   * ROC_n = ((close_t / close_(t - n)) - 1) * 100  (expressed as percentage %)
   * Requires at least lookback + 1 bars.
   */
  public static calculateMomentum(
    bars: HistoricalPriceBar[],
    lookback: number = 20,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `momentum-${lookback}`;
    const name = `Momentum(${lookback})`;
    const parameters = { lookback };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (lookback <= 0 || !Number.isInteger(lookback)) {
      return this.createErrorIndicator(id, name, 'MOMENTUM', parameters, timestamp, baseContext,
        `Invalid momentum lookback: ${lookback}. Must be a positive integer.`);
    }

    const requiredBars = lookback + 1;
    if (barCount < requiredBars) {
      return this.createInsufficientIndicator(id, name, 'MOMENTUM', parameters, timestamp, barCount, requiredBars, baseContext,
        `Insufficient data for Momentum(${lookback}): requires ${requiredBars} bars, but only ${barCount} provided.`);
    }

    const history: (number | null)[] = [];
    for (let i = 0; i < barCount; i++) {
      if (i < lookback) {
        history.push(null);
      } else {
        const basePrice = bars[i - lookback].close;
        const currentPrice = bars[i].close;
        const rocPct = ((currentPrice / basePrice) - 1) * 100;
        history.push(Number(rocPct.toFixed(2)));
      }
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'MOMENTUM',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Percentage Rate of Change over ${lookback} periods: ((close_t / close_(t-${lookback})) - 1) * 100`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 5. HISTORICAL VOLATILITY (ANNUALIZED)
  // ==========================================
  /**
   * Log Return: r_t = ln(close_t / close_(t-1))
   * Sample Variance over lookback n:
   *   s^2 = sum((r_t - mean)^2) / (n - 1)
   * Annualized Volatility = sqrt(s^2) * sqrt(annualizationFactor) * 100 (%)
   * Default annualizationFactor = 252 (trading days per year).
   */
  public static calculateVolatility(
    bars: HistoricalPriceBar[],
    lookback: number = 20,
    annualizationFactor: number = 252,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `volatility-${lookback}`;
    const name = `Volatility(${lookback})`;
    const parameters = { lookback, annualizationFactor };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (lookback < 2) {
      return this.createErrorIndicator(id, name, 'VOLATILITY', parameters, timestamp, baseContext,
        `Invalid lookback: ${lookback}. Volatility calculation requires lookback >= 2.`);
    }

    const requiredBars = lookback + 1;
    if (barCount < requiredBars) {
      return this.createInsufficientIndicator(id, name, 'VOLATILITY', parameters, timestamp, barCount, requiredBars, baseContext,
        `Insufficient data for Volatility(${lookback}): requires ${requiredBars} bars (for ${lookback} returns), but only ${barCount} provided.`);
    }

    const history: (number | null)[] = [];
    for (let i = 0; i < barCount; i++) {
      if (i < lookback) {
        history.push(null);
      } else {
        // Collect returns from i - lookback + 1 to i
        const returns: number[] = [];
        for (let j = i - lookback + 1; j <= i; j++) {
          returns.push(Math.log(bars[j].close / bars[j - 1].close));
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1);
        const annualVolPct = Math.sqrt(variance) * Math.sqrt(annualizationFactor) * 100;
        history.push(Number(annualVolPct.toFixed(2)));
      }
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'VOLATILITY',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Sample standard deviation of log returns over ${lookback} periods, annualized with sqrt(${annualizationFactor})`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 6. HIGHEST HIGH & LOWEST LOW (PRICE RANGES)
  // ==========================================
  /**
   * Calculates highest high over lookback periods.
   * If excludeCurrentBar is true (crucial for breakout reference to prevent look-ahead bias),
   * evaluates the window [t - lookback .. t - 1].
   */
  public static calculateHighestHigh(
    bars: HistoricalPriceBar[],
    lookback: number = 20,
    excludeCurrentBar: boolean = false,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `highest-high-${lookback}${excludeCurrentBar ? '-prior' : ''}`;
    const name = `HighestHigh(${lookback}${excludeCurrentBar ? ',prior' : ''})`;
    const parameters = { lookback, excludeCurrentBar };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    const requiredBars = excludeCurrentBar ? lookback + 1 : lookback;
    if (barCount < requiredBars) {
      return this.createInsufficientIndicator(id, name, 'HIGHEST_HIGH', parameters, timestamp, barCount, requiredBars, baseContext,
        `Insufficient data for ${name}: requires ${requiredBars} bars, but only ${barCount} provided.`);
    }

    const history: (number | null)[] = [];
    for (let i = 0; i < barCount; i++) {
      const endIndex = excludeCurrentBar ? i - 1 : i;
      const startIndex = endIndex - lookback + 1;

      if (startIndex < 0 || endIndex < 0) {
        history.push(null);
      } else {
        let maxHigh = -Infinity;
        for (let j = startIndex; j <= endIndex; j++) {
          if (bars[j].high > maxHigh) maxHigh = bars[j].high;
        }
        history.push(Number(maxHigh.toFixed(2)));
      }
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'HIGHEST_HIGH',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Maximum intraday high over ${lookback} periods${excludeCurrentBar ? ' (strictly excluding current bar to prevent look-ahead bias)' : ''}`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  /**
   * Calculates lowest low over lookback periods.
   * If excludeCurrentBar is true, evaluates window [t - lookback .. t - 1].
   */
  public static calculateLowestLow(
    bars: HistoricalPriceBar[],
    lookback: number = 20,
    excludeCurrentBar: boolean = false,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `lowest-low-${lookback}${excludeCurrentBar ? '-prior' : ''}`;
    const name = `LowestLow(${lookback}${excludeCurrentBar ? ',prior' : ''})`;
    const parameters = { lookback, excludeCurrentBar };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    const requiredBars = excludeCurrentBar ? lookback + 1 : lookback;
    if (barCount < requiredBars) {
      return this.createInsufficientIndicator(id, name, 'LOWEST_LOW', parameters, timestamp, barCount, requiredBars, baseContext,
        `Insufficient data for ${name}: requires ${requiredBars} bars, but only ${barCount} provided.`);
    }

    const history: (number | null)[] = [];
    for (let i = 0; i < barCount; i++) {
      const endIndex = excludeCurrentBar ? i - 1 : i;
      const startIndex = endIndex - lookback + 1;

      if (startIndex < 0 || endIndex < 0) {
        history.push(null);
      } else {
        let minLow = Infinity;
        for (let j = startIndex; j <= endIndex; j++) {
          if (bars[j].low < minLow) minLow = bars[j].low;
        }
        history.push(Number(minLow.toFixed(2)));
      }
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'LOWEST_LOW',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Minimum intraday low over ${lookback} periods${excludeCurrentBar ? ' (strictly excluding current bar to prevent look-ahead bias)' : ''}`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 7. AVERAGE TRUE RANGE (ATR)
  // ==========================================
  /**
   * ATR(n)
   * True Range TR_t = max(high_t - low_t, abs(high_t - close_(t-1)), abs(low_t - close_(t-1)))
   * Initial ATR at bar n: SMA of first n True Ranges (bars 1..n)
   * Subsequent bars: ATR_t = (ATR_(t-1) * (n - 1) + TR_t) / n (Wilder smoothing)
   */
  public static calculateATR(
    bars: HistoricalPriceBar[],
    period: number = 14,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `atr-${period}`;
    const name = `ATR(${period})`;
    const parameters = { period };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (period <= 0 || !Number.isInteger(period)) {
      return this.createErrorIndicator(id, name, 'ATR', parameters, timestamp, baseContext,
        `Invalid ATR period: ${period}. Must be a positive integer.`);
    }

    const requiredBars = period + 1;
    if (barCount < requiredBars) {
      return this.createInsufficientIndicator(id, name, 'ATR', parameters, timestamp, barCount, requiredBars, baseContext,
        `Insufficient data for ATR(${period}): requires ${requiredBars} bars, but only ${barCount} provided.`);
    }

    // Compute True Range array for each bar
    const trueRanges: number[] = [bars[0].high - bars[0].low];
    for (let i = 1; i < barCount; i++) {
      const hl = bars[i].high - bars[i].low;
      const hc = Math.abs(bars[i].high - bars[i - 1].close);
      const lc = Math.abs(bars[i].low - bars[i - 1].close);
      trueRanges.push(Math.max(hl, hc, lc));
    }

    const history: (number | null)[] = new Array(period).fill(null);

    // Initial SMA of TR
    let trSum = 0;
    for (let i = 1; i <= period; i++) {
      trSum += trueRanges[i];
    }
    let currentAtr = trSum / period;
    history.push(Number(currentAtr.toFixed(4)));

    // Wilder's smoothing for subsequent bars
    for (let i = period + 1; i < barCount; i++) {
      currentAtr = (currentAtr * (period - 1) + trueRanges[i]) / period;
      history.push(Number(currentAtr.toFixed(4)));
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'ATR',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Wilder's Average True Range over ${period} periods: max(H-L, |H-C_prev|, |L-C_prev|)`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // 8. VOLUME INDICATORS
  // ==========================================
  /**
   * Average Volume(n) = sum(volume over n) / n
   */
  public static calculateAverageVolume(
    bars: HistoricalPriceBar[],
    period: number = 20,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `avg-volume-${period}`;
    const name = `AverageVolume(${period})`;
    const parameters = { period };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (barCount < period) {
      return this.createInsufficientIndicator(id, name, 'AVERAGE_VOLUME', parameters, timestamp, barCount, period, baseContext,
        `Insufficient data for AverageVolume(${period}): requires ${period} bars, but only ${barCount} provided.`);
    }

    const history: (number | null)[] = [];
    for (let i = 0; i < barCount; i++) {
      if (i < period - 1) {
        history.push(null);
      } else {
        let sum = 0;
        let valid = true;
        for (let j = i - period + 1; j <= i; j++) {
          const vol = bars[j].volume;
          if (vol === undefined || vol === null || isNaN(vol)) {
            valid = false;
            break;
          }
          sum += vol;
        }
        history.push(valid ? Math.round(sum / period) : null);
      }
    }

    const value = history[barCount - 1] ?? null;
    const previousValue = history[barCount - 2] ?? null;

    return {
      indicatorId: id,
      name,
      type: 'AVERAGE_VOLUME',
      parameters,
      timestamp,
      value,
      previousValue,
      history,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars: period
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Arithmetic mean of trading volume over ${period} periods`,
      version: this.VERSION,
      status: value !== null ? 'VALID' : 'UNAVAILABLE'
    };
  }

  /**
   * Volume Ratio = currentVolume / AverageVolume(n)
   */
  public static calculateVolumeRatio(
    bars: HistoricalPriceBar[],
    period: number = 20,
    context?: Partial<IndicatorContext>
  ): CalculatedIndicator {
    const id = `volume-ratio-${period}`;
    const name = `VolumeRatio(${period})`;
    const parameters = { period };
    const barCount = bars.length;
    const lastBar = bars[barCount - 1];
    const timestamp = lastBar?.timestamp || new Date().toISOString();

    const baseContext = this.resolveContext(bars, context);
    const epistemicStatus = this.deriveEpistemicStatus(baseContext.underlyingEpistemicStatus);

    if (barCount < period) {
      return this.createInsufficientIndicator(id, name, 'VOLUME_RATIO', parameters, timestamp, barCount, period, baseContext,
        `Insufficient data for VolumeRatio(${period}): requires ${period} bars, but only ${barCount} provided.`);
    }

    const avgVolResult = this.calculateAverageVolume(bars, period, context);
    const avgVol = avgVolResult.value;
    const currentVol = lastBar?.volume;

    if (avgVol === null || avgVol === 0 || currentVol === undefined || currentVol === null || isNaN(currentVol)) {
      return {
        indicatorId: id,
        name,
        type: 'VOLUME_RATIO',
        parameters,
        timestamp,
        value: null,
        previousValue: null,
        dataWindow: {
          startTimestamp: bars[0].timestamp,
          endTimestamp: lastBar?.timestamp || timestamp,
          barCount,
          requiredBars: period
        },
        sourceSecurity: {
          securityId: baseContext.securityId,
          symbol: baseContext.symbol,
          market: baseContext.market,
          exchange: baseContext.exchange
        },
        provider: baseContext.provider,
        epistemicStatus: 'UNAVAILABLE',
        calculationMethod: `Current volume divided by ${period}-period average volume`,
        version: this.VERSION,
        status: 'UNAVAILABLE',
        reason: 'Volume data missing or average volume is zero'
      };
    }

    const ratio = Number((currentVol / avgVol).toFixed(2));
    const prevBar = bars[barCount - 2];
    const prevAvg = avgVolResult.previousValue;
    let previousValue: number | null = null;
    if (prevBar && prevAvg && prevAvg > 0 && prevBar.volume) {
      previousValue = Number((prevBar.volume / prevAvg).toFixed(2));
    }

    return {
      indicatorId: id,
      name,
      type: 'VOLUME_RATIO',
      parameters,
      timestamp,
      value: ratio,
      previousValue,
      dataWindow: {
        startTimestamp: bars[0].timestamp,
        endTimestamp: lastBar.timestamp,
        barCount,
        requiredBars: period
      },
      sourceSecurity: {
        securityId: baseContext.securityId,
        symbol: baseContext.symbol,
        market: baseContext.market,
        exchange: baseContext.exchange
      },
      provider: baseContext.provider,
      epistemicStatus,
      calculationMethod: `Current volume divided by ${period}-period average volume`,
      version: this.VERSION,
      status: 'VALID'
    };
  }

  // ==========================================
  // HELPER FACTORIES
  // ==========================================
  private static resolveContext(
    bars: HistoricalPriceBar[],
    override?: Partial<IndicatorContext>
  ): IndicatorContext {
    const sample = bars[0];
    return {
      securityId: override?.securityId || sample?.securityId || 'unknown-security',
      symbol: override?.symbol || 'UNKNOWN',
      market: override?.market || sample?.market || 'US',
      exchange: override?.exchange || sample?.exchange || 'UNKNOWN',
      provider: override?.provider || sample?.provider || 'Market Data Engine',
      underlyingEpistemicStatus: override?.underlyingEpistemicStatus || sample?.epistemicStatus || 'REAL'
    };
  }

  private static createInsufficientIndicator(
    indicatorId: string,
    name: string,
    type: IndicatorType,
    parameters: Record<string, number | string | boolean>,
    timestamp: string,
    barCount: number,
    requiredBars: number,
    context: IndicatorContext,
    reason: string
  ): CalculatedIndicator {
    return {
      indicatorId,
      name,
      type,
      parameters,
      timestamp,
      value: null,
      previousValue: null,
      history: [],
      dataWindow: {
        startTimestamp: timestamp,
        endTimestamp: timestamp,
        barCount,
        requiredBars
      },
      sourceSecurity: {
        securityId: context.securityId,
        symbol: context.symbol,
        market: context.market,
        exchange: context.exchange
      },
      provider: context.provider,
      epistemicStatus: 'UNAVAILABLE',
      calculationMethod: 'Deterministic calculation suspended due to insufficient sample observations',
      version: this.VERSION,
      status: 'INSUFFICIENT_DATA',
      reason
    };
  }

  private static createErrorIndicator(
    indicatorId: string,
    name: string,
    type: IndicatorType,
    parameters: Record<string, number | string | boolean>,
    timestamp: string,
    context: IndicatorContext,
    reason: string
  ): CalculatedIndicator {
    return {
      indicatorId,
      name,
      type,
      parameters,
      timestamp,
      value: null,
      previousValue: null,
      history: [],
      dataWindow: {
        startTimestamp: timestamp,
        endTimestamp: timestamp,
        barCount: 0,
        requiredBars: 0
      },
      sourceSecurity: {
        securityId: context.securityId,
        symbol: context.symbol,
        market: context.market,
        exchange: context.exchange
      },
      provider: context.provider,
      epistemicStatus: 'UNAVAILABLE',
      calculationMethod: 'Invalid parameters provided',
      version: this.VERSION,
      status: 'INVALID_DATA',
      reason
    };
  }
}
