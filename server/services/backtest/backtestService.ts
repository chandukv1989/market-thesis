/**
 * Phase 12A - Backtest Service
 * 
 * High-level service facade for deterministic backtesting operations.
 * Manages deterministic caching, parameter validation, and result retention.
 */

import { BacktestConfiguration, BacktestResult, HistoricalPriceBar } from '../../../src/types';
import { backtestEngine, BacktestEngine } from './backtestEngine';

export class BacktestService {
  private static instance: BacktestService;
  private engine: BacktestEngine;
  private resultsCache: Map<string, BacktestResult> = new Map();

  private constructor() {
    this.engine = BacktestEngine.getInstance();
  }

  public static getInstance(): BacktestService {
    if (!BacktestService.instance) {
      BacktestService.instance = new BacktestService();
    }
    return BacktestService.instance;
  }

  /**
   * Run backtest with deterministic cache check.
   */
  public async runBacktest(
    config: BacktestConfiguration,
    providedBars?: HistoricalPriceBar[],
    benchmarkBars?: HistoricalPriceBar[]
  ): Promise<BacktestResult> {
    const cacheKey = this.generateCacheKey(config);

    // If no custom provided bars and already cached, return deterministic result
    if (!providedBars && !benchmarkBars && this.resultsCache.has(cacheKey)) {
      const cached = this.resultsCache.get(cacheKey)!;
      return cached;
    }

    const result = await this.engine.runBacktest(config, providedBars, benchmarkBars);

    if (result.status === 'COMPLETED' && !providedBars && !benchmarkBars) {
      this.resultsCache.set(cacheKey, result);
    }
    // Also index by backtestId
    if (result.backtestId) {
      this.resultsCache.set(result.backtestId, result);
    }

    return result;
  }

  /**
   * Retrieve a backtest result by ID.
   */
  public getBacktest(id: string): BacktestResult | null {
    return this.resultsCache.get(id) || null;
  }

  /**
   * Retrieve all completed backtest results.
   */
  public getAllBacktests(): BacktestResult[] {
    const unique = new Map<string, BacktestResult>();
    for (const res of this.resultsCache.values()) {
      if (res.backtestId) {
        unique.set(res.backtestId, res);
      }
    }
    return Array.from(unique.values());
  }

  /**
   * Validate configuration prior to execution.
   */
  public async validateConfig(config: BacktestConfiguration): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.strategyId) {
      errors.push('strategyId is required.');
    }
    if (!config.startDate || !config.endDate) {
      errors.push('startDate and endDate are required.');
    } else if (new Date(config.startDate).getTime() >= new Date(config.endDate).getTime()) {
      errors.push(`startDate (${config.startDate}) must precede endDate (${config.endDate}).`);
    }
    if (typeof config.initialCapital !== 'number' || config.initialCapital <= 0) {
      errors.push('initialCapital must be a positive number.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clear in-memory cache.
   */
  public clearCache(): void {
    this.resultsCache.clear();
  }

  private generateCacheKey(config: BacktestConfiguration): string {
    const syms = (config.symbols || config.securityIds || ['default']).join(',');
    return [
      config.strategyId,
      config.strategyVersion || 'v1.0.0',
      syms,
      config.startDate,
      config.endDate,
      config.initialCapital,
      config.currency || config.baseCurrency || 'USD',
      config.slippageBps || config.slippage?.rate || 5,
      config.commissionPerTrade || config.transactionCost?.rate || 0,
      config.executionTiming || 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN',
      config.isSimulatedBaseline ? 'sim' : 'real'
    ].join(':');
  }
}

export const backtestService = BacktestService.getInstance();
