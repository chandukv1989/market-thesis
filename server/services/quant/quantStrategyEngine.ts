/**
 * QuantStrategyEngine (Phase 11)
 * 
 * Core orchestrator for quantitative strategy execution, technical indicator
 * computation, rule matrix evaluation, position sizing, and risk constraint auditing.
 * 
 * Invariants:
 * 1. 100% Deterministic — Zero LLM/Gemini involvement in mathematical calculations.
 * 2. Point-in-Time Integrity — Strict prohibition of look-ahead bias (bars <= asOfDate).
 * 3. Provider Independence — Works identically across US (Twelve Data), India (FYERS), and simulated data.
 * 4. Strict Guardrails — isAnalyticalOnly: true, executionProhibited: true.
 */

import {
  QuantStrategy,
  HistoricalPriceBar,
  StrategyEvaluationOptions,
  StrategyEvaluationResult,
  CalculatedIndicator,
  AnalyticalSignal,
  SignalDirection,
  SignalType,
  EpistemicStatus,
  MarketRegion,
  RuleEvaluationResult,
  PointInTimeProvenance
} from '../../../src/types';
import { HistoricalDataValidator } from './dataValidator';
import { IndicatorEngine } from './indicatorEngine';
import { StrategyRuleEvaluator } from './strategyRuleEvaluator';
import { PositionSizingEngine } from './positionSizingEngine';
import { RiskConstraintEngine } from './riskConstraintEngine';
import { BUILTIN_STRATEGIES, getStructuredRulesForStrategy } from './builtinStrategies';
import { financialDataService } from '../financialDataService';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';

export class QuantStrategyEngine {
  private static instance: QuantStrategyEngine;
  private customStrategies: Map<string, QuantStrategy> = new Map();
  // Deterministic in-memory indicator cache: key -> CalculatedIndicator
  private indicatorCache: Map<string, { indicator: CalculatedIndicator; expiresAt: number }> = new Map();

  private constructor() {}

  public static getInstance(): QuantStrategyEngine {
    if (!QuantStrategyEngine.instance) {
      QuantStrategyEngine.instance = new QuantStrategyEngine();
    }
    return QuantStrategyEngine.instance;
  }

  // ==========================================
  // STRATEGY REGISTRY & VALIDATION
  // ==========================================
  public getBuiltinStrategies(): QuantStrategy[] {
    return BUILTIN_STRATEGIES;
  }

  public getStrategy(strategyId: string): QuantStrategy | null {
    if (this.customStrategies.has(strategyId)) {
      return this.customStrategies.get(strategyId)!;
    }
    const builtin = BUILTIN_STRATEGIES.find(s => s.strategyId === strategyId);
    return builtin || null;
  }

  public registerCustomStrategy(strategy: QuantStrategy): { valid: boolean; errors: string[] } {
    const validation = this.validateStrategy(strategy);
    if (!validation.valid) {
      return validation;
    }
    this.customStrategies.set(strategy.strategyId, {
      ...strategy,
      version: strategy.version || 'v1.0.0'
    });
    return { valid: true, errors: [] };
  }

  public validateStrategy(strategy: Partial<QuantStrategy>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!strategy.strategyId || typeof strategy.strategyId !== 'string') {
      errors.push('strategyId is required and must be a string.');
    }
    if (!strategy.name || typeof strategy.name !== 'string') {
      errors.push('name is required and must be a string.');
    }
    if (!strategy.indicators || !Array.isArray(strategy.indicators) || strategy.indicators.length === 0) {
      errors.push('At least one indicator definition is required.');
    }
    if (!strategy.entryRules || !Array.isArray(strategy.entryRules) || strategy.entryRules.length === 0) {
      errors.push('At least one entry rule is required.');
    }
    if (!strategy.positionSizing || !strategy.positionSizing.method) {
      errors.push('positionSizing configuration with a valid method is required.');
    }
    if (!strategy.riskConstraints) {
      errors.push('riskConstraints configuration is required.');
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================
  // CORE STRATEGY EVALUATION PIPELINE
  // ==========================================
  public async evaluateStrategy(options: StrategyEvaluationOptions): Promise<StrategyEvaluationResult> {
    const evaluatedAt = new Date().toISOString();

    // 1. Resolve Strategy
    let strategy: QuantStrategy | null = options.strategy || null;
    if (!strategy && options.strategyId) {
      strategy = this.getStrategy(options.strategyId);
    }
    if (!strategy) {
      // Fallback to MA Crossover default if nothing specified
      strategy = BUILTIN_STRATEGIES[0];
    }

    const mergedParams = {
      ...(strategy.parameters || {}),
      ...(options.parameters || {})
    };

    // 2. Resolve Security
    const symbolStr = (options.symbol || 'AAPL').toUpperCase().trim();
    const canonical = resolveSecurity(symbolStr);
    const securityId = options.securityId || canonical?.id || `sec-${symbolStr.toLowerCase()}`;
    const market: MarketRegion = options.market || canonical?.market || 'US';
    const exchange = options.exchange || canonical?.exchange || (market === 'INDIA' ? 'NSE' : 'NASDAQ');
    const currency = options.currency || canonical?.currency || (market === 'INDIA' ? 'INR' : 'USD');

    // 3. Obtain Historical Price Bars
    let rawBars: HistoricalPriceBar[] = [];
    let provider = 'Historical Data Provider';
    let underlyingEpistemicStatus: EpistemicStatus = 'REAL';

    if (options.bars && Array.isArray(options.bars) && options.bars.length > 0) {
      rawBars = options.bars;
      provider = rawBars[0].provider || 'Caller Provided Test Fixture';
      underlyingEpistemicStatus = rawBars[0].epistemicStatus || 'REAL';
    } else {
      // Fetch via financialDataService
      try {
        const histResp = await financialDataService.getHistoricalPrices({
          symbol: symbolStr,
          securityId,
          market,
          exchange,
          currency,
          interval: '1d',
          period: '1Y'
        });
        rawBars = histResp.bars || [];
        provider = histResp.provider || (market === 'INDIA' ? 'FYERS' : 'Twelve Data');
        underlyingEpistemicStatus = histResp.epistemicStatus || (histResp.isSimulated ? 'SIMULATED' : 'REAL');
      } catch (err) {
        rawBars = [];
        provider = market === 'INDIA' ? 'FYERS' : 'Twelve Data';
        underlyingEpistemicStatus = 'UNAVAILABLE';
      }
    }

    // 4. Point-In-Time Windowing (Zero Look-Ahead Bias)
    let bars = rawBars;
    const asOfDate = options.asOfDate || (bars.length > 0 ? bars[bars.length - 1].timestamp : evaluatedAt);

    if (options.asOfDate) {
      const asOfEpoch = new Date(options.asOfDate).getTime();
      bars = rawBars.filter(b => new Date(b.timestamp).getTime() <= asOfEpoch);
    }

    // 5. Historical Data Validation
    const validation = HistoricalDataValidator.validate(bars, { minBarsRequired: 20 });
    const warnings: string[] = [...validation.warnings];

    // Handle invalid or empty bars
    if (!validation.isValid || bars.length === 0) {
      const defaultProvenance: PointInTimeProvenance = {
        dataTimestamp: asOfDate,
        availableAt: asOfDate,
        retrievedAt: evaluatedAt,
        provider,
        source: `${provider} Historical OHLCV`,
        epistemicStatus: 'UNAVAILABLE'
      };

      return {
        strategyId: strategy.strategyId,
        strategyName: strategy.name,
        strategyVersion: strategy.version || 'v1.0.0',
        securityId,
        symbol: symbolStr,
        market,
        exchange,
        currency,
        evaluatedAt,
        asOfDate,
        dataQuality: validation.quality,
        dataValidation: validation,
        indicators: {},
        ruleEvaluations: [],
        signal: {
          id: `sig-${Date.now()}-none`,
          securityId,
          symbol: symbolStr,
          market,
          exchange,
          currency,
          timestamp: evaluatedAt,
          signalType: 'HOLD',
          direction: 'HOLD',
          strength: 0,
          reason: `Strategy evaluation suspended: Data is ${validation.quality} (${validation.errors.join('; ')}).`,
          strategyId: strategy.strategyId,
          strategyName: strategy.name,
          provenance: defaultProvenance,
          isAnalyticalOnly: true,
          executionProhibited: true
        },
        positionSizing: {
          method: strategy.positionSizing.method,
          rawWeightPct: 0,
          boundedWeightPct: 0,
          targetWeightPct: 0,
          isConstrained: false,
          explanation: 'No position allocation due to invalid/insufficient data.'
        },
        riskConstraints: [],
        targetPosition: {
          securityId,
          symbol: symbolStr,
          direction: 'HOLD',
          requestedWeightPct: 0,
          constrainedWeightPct: 0,
          isConstrained: false,
          currency
        },
        epistemicStatus: 'UNAVAILABLE',
        provider,
        provenance: defaultProvenance,
        warnings: [...warnings, ...validation.errors],
        auditTrail: {
          timestamp: evaluatedAt,
          reason: 'Insufficient or invalid data for evaluation',
          indicatorSnapshots: {},
          ruleOutcomes: []
        },
        isAnalyticalOnly: true,
        executionProhibited: true
      };
    }

    const currentBar = bars[bars.length - 1];
    const previousBar = bars.length > 1 ? bars[bars.length - 2] : undefined;

    // Epistemic Status derivation:
    // If underlying data is REAL -> CALCULATED
    // If underlying data is SIMULATED -> SIMULATED
    const calculatedEpistemicStatus: EpistemicStatus =
      underlyingEpistemicStatus === 'REAL' ? 'CALCULATED' : 'SIMULATED';

    const indicatorContext = {
      securityId,
      symbol: symbolStr,
      market,
      exchange,
      provider,
      underlyingEpistemicStatus
    };

    // 6. Calculate Technical Indicators
    const indicators: Record<string, CalculatedIndicator> = {};
    this.computeIndicatorsForStrategy(strategy, bars, mergedParams, indicatorContext, indicators);

    // 7. Evaluate Strategy Rules
    const structuredRules = getStructuredRulesForStrategy(strategy.strategyId);
    const evalState = { currentBar, previousBar, indicators };

    // Entry rules
    const entryOutcome = StrategyRuleEvaluator.evaluateRuleGroup(
      structuredRules.entryRules,
      'AND',
      evalState
    );

    // Exit rules
    const exitOutcome = StrategyRuleEvaluator.evaluateRuleGroup(
      structuredRules.exitRules,
      'AND',
      evalState
    );

    const ruleEvaluations: RuleEvaluationResult[] = [
      ...entryOutcome.evaluations,
      ...exitOutcome.evaluations
    ];

    // 8. Determine Analytical Signal
    let direction: SignalDirection = 'HOLD';
    let signalType: SignalType = 'HOLD';
    let signalStrength = 0.0;
    let signalReason = 'No entry or exit rules triggered; state is neutral.';

    if (entryOutcome.passed) {
      direction = 'BUY';
      signalType = 'ENTRY';
      signalStrength = this.calculateSignalStrength(strategy.strategyId, indicators, true);
      signalReason = `Entry conditions satisfied for ${strategy.name}: ${entryOutcome.evaluations.map(e => e.explanation).join('; ')}`;
    } else if (exitOutcome.passed) {
      direction = 'SELL';
      signalType = 'EXIT';
      signalStrength = this.calculateSignalStrength(strategy.strategyId, indicators, false);
      signalReason = `Exit conditions satisfied for ${strategy.name}: ${exitOutcome.evaluations.map(e => e.explanation).join('; ')}`;
    }

    const provenance: PointInTimeProvenance = {
      dataTimestamp: currentBar.timestamp,
      availableAt: currentBar.timestamp,
      retrievedAt: evaluatedAt,
      provider,
      source: `${provider} Historical OHLCV (${bars.length} bars)`,
      epistemicStatus: calculatedEpistemicStatus
    };

    // 9. Compute Position Sizing
    const volIndicator = Object.values(indicators).find(i => i.type === 'VOLATILITY');
    const sizingResult = PositionSizingEngine.calculateSizing(strategy.positionSizing, {
      portfolioValue: options.portfolioContext?.totalPortfolioValue,
      currentPrice: currentBar.close,
      volatilityIndicator: volIndicator
    });

    const prospectiveWeight = direction === 'BUY' ? sizingResult.boundedWeightPct : 0;

    // 10. Audit Risk Constraints
    const riskAudit = RiskConstraintEngine.evaluateConstraints(
      strategy.riskConstraints,
      prospectiveWeight,
      securityId,
      {
        totalPortfolioValue: options.portfolioContext?.totalPortfolioValue,
        currentHoldings: options.portfolioContext?.currentHoldings,
        cashReservePct: options.portfolioContext?.cashReservePct,
        targetSector: canonical?.sector,
        targetMarket: market
      }
    );

    const constrainedTargetWeight = direction === 'BUY' ? riskAudit.constrainedWeightPct : 0;

    // 11. Assemble Target Position
    const targetPosition = {
      securityId,
      symbol: symbolStr,
      direction,
      requestedWeightPct: prospectiveWeight,
      constrainedWeightPct: constrainedTargetWeight,
      isConstrained: riskAudit.isConstrained || sizingResult.isConstrained,
      currency
    };

    // 12. Build Audit Trail
    const indicatorSnapshots: Record<string, { current: number | null; previous: number | null }> = {};
    for (const [key, ind] of Object.entries(indicators)) {
      indicatorSnapshots[key] = {
        current: ind.value,
        previous: ind.previousValue ?? null
      };
    }

    const auditTrail = {
      timestamp: evaluatedAt,
      reason: signalReason,
      indicatorSnapshots,
      ruleOutcomes: ruleEvaluations.map(r => ({
        ruleId: r.ruleId,
        passed: r.passed,
        explanation: r.explanation
      }))
    };

    const signal: AnalyticalSignal = {
      id: `sig-${Date.now()}-${symbolStr.toLowerCase()}`,
      securityId,
      symbol: symbolStr,
      market,
      exchange,
      currency,
      timestamp: evaluatedAt,
      signalType,
      direction,
      strength: signalStrength,
      targetWeight: constrainedTargetWeight,
      priceAtSignal: currentBar.close,
      reason: signalReason,
      strategyId: strategy.strategyId,
      strategyName: strategy.name,
      provenance,
      isAnalyticalOnly: true,
      executionProhibited: true
    };

    return {
      strategyId: strategy.strategyId,
      strategyName: strategy.name,
      strategyVersion: strategy.version || 'v1.0.0',
      securityId,
      symbol: symbolStr,
      market,
      exchange,
      currency,
      evaluatedAt,
      asOfDate: currentBar.timestamp,
      dataQuality: validation.quality,
      dataValidation: validation,
      indicators,
      ruleEvaluations,
      signal,
      positionSizing: sizingResult,
      riskConstraints: riskAudit.results,
      targetPosition,
      epistemicStatus: calculatedEpistemicStatus,
      provider,
      provenance,
      warnings,
      auditTrail,
      isAnalyticalOnly: true,
      executionProhibited: true
    };
  }

  /**
   * Batch evaluate multiple strategy executions
   */
  public async evaluateStrategies(optionsList: StrategyEvaluationOptions[]): Promise<StrategyEvaluationResult[]> {
    return Promise.all(optionsList.map(opt => this.evaluateStrategy(opt)));
  }

  // ==========================================
  // INTERNAL INDICATOR ROUTING
  // ==========================================
  private computeIndicatorsForStrategy(
    strategy: QuantStrategy,
    bars: HistoricalPriceBar[],
    params: Record<string, number | string | boolean>,
    context: any,
    out: Record<string, CalculatedIndicator>
  ): void {
    const endTimestamp = bars[bars.length - 1]?.timestamp || '';

    // Specialized routing for the 5 built-in strategies or custom indicators
    if (strategy.strategyId === 'strat-ma-crossover') {
      const fastP = Number(params.fastPeriod) || 20;
      const slowP = Number(params.slowPeriod) || 50;
      out[`sma-${fastP}`] = this.getCachedOrCalculate(
        context.securityId, 'SMA', { period: fastP }, endTimestamp,
        () => IndicatorEngine.calculateSMA(bars, fastP, context)
      );
      out[`sma-${slowP}`] = this.getCachedOrCalculate(
        context.securityId, 'SMA', { period: slowP }, endTimestamp,
        () => IndicatorEngine.calculateSMA(bars, slowP, context)
      );
      return;
    }

    if (strategy.strategyId === 'strat-rsi') {
      const p = Number(params.period) || 14;
      out[`rsi-${p}`] = this.getCachedOrCalculate(
        context.securityId, 'RSI', { period: p }, endTimestamp,
        () => IndicatorEngine.calculateRSI(bars, p, context)
      );
      return;
    }

    if (strategy.strategyId === 'strat-momentum') {
      const lookback = Number(params.lookback) || 20;
      out[`momentum-${lookback}`] = this.getCachedOrCalculate(
        context.securityId, 'MOMENTUM', { lookback }, endTimestamp,
        () => IndicatorEngine.calculateMomentum(bars, lookback, context)
      );
      return;
    }

    if (strategy.strategyId === 'strat-breakout') {
      const lookback = Number(params.lookback) || 20;
      out[`highest-high-${lookback}-prior`] = this.getCachedOrCalculate(
        context.securityId, 'HIGHEST_HIGH', { lookback, excludeCurrentBar: true }, endTimestamp,
        () => IndicatorEngine.calculateHighestHigh(bars, lookback, true, context)
      );
      out[`lowest-low-${lookback}-prior`] = this.getCachedOrCalculate(
        context.securityId, 'LOWEST_LOW', { lookback, excludeCurrentBar: true }, endTimestamp,
        () => IndicatorEngine.calculateLowestLow(bars, lookback, true, context)
      );
      return;
    }

    if (strategy.strategyId === 'strat-multi-factor') {
      const momLookback = 20;
      const smaPeriod = 50;
      const rsiPeriod = 14;
      const volLookback = 20;

      const momInd = this.getCachedOrCalculate(
        context.securityId, 'MOMENTUM', { lookback: momLookback }, endTimestamp,
        () => IndicatorEngine.calculateMomentum(bars, momLookback, context)
      );
      const smaInd = this.getCachedOrCalculate(
        context.securityId, 'SMA', { period: smaPeriod }, endTimestamp,
        () => IndicatorEngine.calculateSMA(bars, smaPeriod, context)
      );
      const rsiInd = this.getCachedOrCalculate(
        context.securityId, 'RSI', { period: rsiPeriod }, endTimestamp,
        () => IndicatorEngine.calculateRSI(bars, rsiPeriod, context)
      );
      const volInd = this.getCachedOrCalculate(
        context.securityId, 'VOLATILITY', { lookback: volLookback }, endTimestamp,
        () => IndicatorEngine.calculateVolatility(bars, volLookback, 252, context)
      );

      out['momentum-20'] = momInd;
      out['sma-50'] = smaInd;
      out['rsi-14'] = rsiInd;
      out['volatility-20'] = volInd;

      // Compute Composite Factor Indicator
      const currentBar = bars[bars.length - 1];
      const previousBar = bars.length > 1 ? bars[bars.length - 2] : undefined;

      const momScore = (momInd.value ?? 0) > 0 ? 1 : (momInd.value ?? 0) < 0 ? -1 : 0;
      const trendScore = currentBar.close > (smaInd.value ?? 0) ? 1 : -1;
      const rsiVal = rsiInd.value ?? 50;
      const rsiScore = rsiVal < 45 ? 1 : rsiVal > 65 ? -1 : 0;
      const volVal = volInd.value ?? 30;
      const volScore = volVal < 25 ? 1 : volVal > 40 ? -1 : 0;

      const wMom = Number(params.momentumWeight) || 0.35;
      const wTrend = Number(params.trendWeight) || 0.30;
      const wRsi = Number(params.rsiWeight) || 0.20;
      const wVol = Number(params.volatilityWeight) || 0.15;

      const compositeScore = Number(
        (momScore * wMom + trendScore * wTrend + rsiScore * wRsi + volScore * wVol).toFixed(3)
      );

      let prevCompositeScore: number | null = null;
      if (previousBar && smaInd.previousValue !== null && rsiInd.previousValue !== null) {
        const prevMomScore = (momInd.previousValue ?? 0) > 0 ? 1 : (momInd.previousValue ?? 0) < 0 ? -1 : 0;
        const prevTrendScore = previousBar.close > (smaInd.previousValue ?? 0) ? 1 : -1;
        const prevRsiVal = rsiInd.previousValue ?? 50;
        const prevRsiScore = prevRsiVal < 45 ? 1 : prevRsiVal > 65 ? -1 : 0;
        const prevVolVal = volInd.previousValue ?? 30;
        const prevVolScore = prevVolVal < 25 ? 1 : prevVolVal > 40 ? -1 : 0;
        prevCompositeScore = Number(
          (prevMomScore * wMom + prevTrendScore * wTrend + prevRsiScore * wRsi + prevVolScore * wVol).toFixed(3)
        );
      }

      out['composite-score'] = {
        indicatorId: 'composite-score',
        name: 'Composite Factor Score',
        type: 'CUSTOM',
        parameters: { wMom, wTrend, wRsi, wVol },
        timestamp: currentBar.timestamp,
        value: compositeScore,
        previousValue: prevCompositeScore,
        dataWindow: {
          startTimestamp: bars[0].timestamp,
          endTimestamp: currentBar.timestamp,
          barCount: bars.length,
          requiredBars: 50
        },
        sourceSecurity: {
          securityId: context.securityId,
          symbol: context.symbol,
          market: context.market,
          exchange: context.exchange
        },
        provider: context.provider,
        epistemicStatus: context.underlyingEpistemicStatus === 'REAL' ? 'CALCULATED' : 'SIMULATED',
        calculationMethod: `Weighted linear combination: ${wMom}*Mom + ${wTrend}*Trend + ${wRsi}*RSI + ${wVol}*Vol`,
        version: 'v1.0.0',
        status: 'VALID'
      };
      return;
    }

    // Default indicator computation from strategy indicator definitions
    for (const def of strategy.indicators) {
      const type = def.type.toUpperCase();
      const p = def.parameters || {};
      if (type === 'SMA') {
        const period = Number(p.period) || 20;
        out[def.id] = IndicatorEngine.calculateSMA(bars, period, context);
      } else if (type === 'EMA') {
        const period = Number(p.period) || 20;
        out[def.id] = IndicatorEngine.calculateEMA(bars, period, context);
      } else if (type === 'RSI') {
        const period = Number(p.period) || 14;
        out[def.id] = IndicatorEngine.calculateRSI(bars, period, context);
      } else if (type === 'MOMENTUM' || type === 'ROC') {
        const lookback = Number(p.lookback) || 20;
        out[def.id] = IndicatorEngine.calculateMomentum(bars, lookback, context);
      } else if (type === 'VOLATILITY') {
        const lookback = Number(p.lookback) || 20;
        out[def.id] = IndicatorEngine.calculateVolatility(bars, lookback, 252, context);
      } else if (type === 'HIGHEST_HIGH') {
        const lookback = Number(p.lookback) || 20;
        const excl = Boolean(p.excludeCurrentBar);
        out[def.id] = IndicatorEngine.calculateHighestHigh(bars, lookback, excl, context);
      } else if (type === 'LOWEST_LOW') {
        const lookback = Number(p.lookback) || 20;
        const excl = Boolean(p.excludeCurrentBar);
        out[def.id] = IndicatorEngine.calculateLowestLow(bars, lookback, excl, context);
      } else if (type === 'ATR') {
        const period = Number(p.period) || 14;
        out[def.id] = IndicatorEngine.calculateATR(bars, period, context);
      } else if (type === 'AVERAGE_VOLUME') {
        const period = Number(p.period) || 20;
        out[def.id] = IndicatorEngine.calculateAverageVolume(bars, period, context);
      } else if (type === 'VOLUME_RATIO') {
        const period = Number(p.period) || 20;
        out[def.id] = IndicatorEngine.calculateVolumeRatio(bars, period, context);
      }
    }
  }

  private calculateSignalStrength(
    strategyId: string,
    indicators: Record<string, CalculatedIndicator>,
    isEntry: boolean
  ): number {
    if (strategyId === 'strat-rsi') {
      const rsi = indicators['rsi-14']?.value;
      if (rsi === null || rsi === undefined) return 0.5;
      if (isEntry) {
        // RSI <= 30: Lower RSI = higher strength
        return Math.min(1.0, Number(((30 - rsi + 10) / 40).toFixed(2)));
      } else {
        // RSI >= 70: Higher RSI = higher exit strength
        return Math.min(1.0, Number(((rsi - 70 + 10) / 40).toFixed(2)));
      }
    }

    if (strategyId === 'strat-momentum') {
      const mom = indicators['momentum-20']?.value;
      if (mom === null || mom === undefined) return 0.5;
      const absMom = Math.abs(mom);
      return Math.min(1.0, Number((absMom / 20).toFixed(2)));
    }

    if (strategyId === 'strat-multi-factor') {
      const comp = indicators['composite-score']?.value;
      if (comp === null || comp === undefined) return 0.5;
      return Math.min(1.0, Number(Math.abs(comp).toFixed(2)));
    }

    return 0.75;
  }

  private getCachedOrCalculate(
    securityId: string,
    type: string,
    params: Record<string, any>,
    endTimestamp: string,
    calcFn: () => CalculatedIndicator
  ): CalculatedIndicator {
    const key = `${securityId}-${type}-${JSON.stringify(params)}-${endTimestamp}`;
    const cached = this.indicatorCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.indicator;
    }

    const fresh = calcFn();
    this.indicatorCache.set(key, {
      indicator: fresh,
      expiresAt: Date.now() + 60000 // 1 minute TTL for historical cache
    });
    return fresh;
  }

  public clearCache(): void {
    this.indicatorCache.clear();
  }
}

export const quantStrategyEngine = QuantStrategyEngine.getInstance();
