import { QuantStrategy, StrategyEvaluationOptions, StrategyEvaluationResult } from '../types';

export interface StrategyListResponse {
  strategies: QuantStrategy[];
  count: number;
  isAnalyticalOnly: boolean;
  executionProhibited: boolean;
}

export interface StrategyValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const quantStrategyClient = {
  /**
   * Fetch all registered quantitative strategies (built-in and custom)
   */
  async getStrategies(): Promise<StrategyListResponse> {
    const response = await fetch('/api/strategies');
    if (!response.ok) {
      throw new Error(`Failed to fetch strategies: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch details of a specific strategy by ID
   */
  async getStrategy(id: string): Promise<QuantStrategy> {
    const response = await fetch(`/api/strategies/${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch strategy ${id}: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Evaluate a quantitative strategy deterministically against point-in-time price history
   */
  async evaluateStrategy(options: StrategyEvaluationOptions): Promise<StrategyEvaluationResult> {
    const response = await fetch('/api/strategies/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Evaluation failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Validate a quantitative strategy definition against schema and constraints
   */
  async validateStrategy(strategy: Partial<QuantStrategy>): Promise<StrategyValidationResponse> {
    const response = await fetch('/api/strategies/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Validation failed: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Register a custom quantitative strategy
   */
  async registerCustomStrategy(strategy: QuantStrategy): Promise<{ message: string; strategyId: string }> {
    const response = await fetch('/api/strategies/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategy)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Custom strategy registration failed: ${response.statusText}`);
    }
    return response.json();
  }
};
