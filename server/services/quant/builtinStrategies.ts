/**
 * Built-In Quantitative Strategies (Phase 11)
 * 
 * Five deterministic, mathematically specified reference strategies with explicit
 * versioning, parameter defaults, and strict analytical guardrails.
 * 
 * 1. Moving Average Crossover (Fast SMA 20 / Slow SMA 50)
 * 2. RSI Mean Reversion (RSI 14, 30 Oversold / 70 Overbought)
 * 3. Momentum Rate of Change (20-period lookback, +/- 5% threshold)
 * 4. Donchian Channel Breakout (20-period lookback, strictly excluding current bar)
 * 5. Multi-Factor Composite Strategy (Momentum + Trend + RSI + Volatility)
 */

import {
  QuantStrategy,
  StructuredStrategyRule
} from '../../../src/types';

export const BUILTIN_STRATEGIES: QuantStrategy[] = [
  // ----------------------------------------------------
  // 1. Moving Average Crossover (v1.0.0)
  // ----------------------------------------------------
  {
    strategyId: 'strat-ma-crossover',
    name: 'SMA Crossover Strategy',
    version: 'v1.0.0',
    description: 'Classic dual moving average trend-following system using 20-period fast SMA and 50-period slow SMA.',
    universe: {
      markets: ['US', 'INDIA'],
      exchanges: ['NASDAQ', 'NYSE', 'NSE', 'BSE']
    },
    frequency: 'DAILY',
    parameters: {
      fastPeriod: 20,
      slowPeriod: 50
    },
    indicators: [
      {
        id: 'fast-sma',
        name: 'Fast SMA',
        type: 'TECHNICAL',
        parameters: { period: 20 }
      },
      {
        id: 'slow-sma',
        name: 'Slow SMA',
        type: 'TECHNICAL',
        parameters: { period: 50 }
      }
    ],
    entryRules: [
      {
        id: 'rule-ma-entry',
        category: 'ENTRY',
        name: 'Fast SMA Cross Above Slow SMA',
        condition: 'fast-sma CROSS_ABOVE slow-sma',
        action: 'BUY',
        weight: 1.0
      }
    ],
    exitRules: [
      {
        id: 'rule-ma-exit',
        category: 'EXIT',
        name: 'Fast SMA Cross Below Slow SMA',
        condition: 'fast-sma CROSS_BELOW slow-sma',
        action: 'SELL',
        weight: 1.0
      }
    ],
    positionSizing: {
      method: 'FIXED_PERCENT',
      targetPositionPct: 10.0,
      maxPositionWeightPct: 20.0,
      minPositionWeightPct: 2.0
    },
    riskConstraints: {
      maxPositionWeightPct: 20.0,
      maxSectorWeightPct: 35.0,
      maxPortfolioDrawdownPct: 15.0,
      maxMarketWeight: 60.0,
      maxPortfolioExposure: 95.0,
      maxPositionCount: 10
    },
    portfolioConstruction: {
      maxHoldings: 10,
      allowShorting: false,
      weightingScheme: 'FIXED_WEIGHT',
      rebalanceFrequency: 'MONTHLY'
    },
    rebalanceSchedule: 'DAILY_CLOSE',
    isDeterministic: true
  },

  // ----------------------------------------------------
  // 2. Relative Strength Index (RSI) Mean Reversion (v1.0.0)
  // ----------------------------------------------------
  {
    strategyId: 'strat-rsi',
    name: 'RSI Mean Reversion Strategy',
    version: 'v1.0.0',
    description: 'Mean-reversion strategy seeking oversold dip entries and overbought exits using Wilder 14-period RSI.',
    universe: {
      markets: ['US', 'INDIA']
    },
    frequency: 'DAILY',
    parameters: {
      period: 14,
      oversoldThreshold: 30,
      overboughtThreshold: 70
    },
    indicators: [
      {
        id: 'rsi-14',
        name: 'RSI 14',
        type: 'TECHNICAL',
        parameters: { period: 14 }
      }
    ],
    entryRules: [
      {
        id: 'rule-rsi-oversold',
        category: 'ENTRY',
        name: 'RSI Oversold Condition',
        condition: 'rsi-14 <= 30',
        action: 'BUY',
        weight: 1.0
      }
    ],
    exitRules: [
      {
        id: 'rule-rsi-overbought',
        category: 'EXIT',
        name: 'RSI Overbought Condition',
        condition: 'rsi-14 >= 70',
        action: 'SELL',
        weight: 1.0
      }
    ],
    positionSizing: {
      method: 'FIXED_PERCENT',
      targetPositionPct: 7.5,
      maxPositionWeightPct: 15.0,
      minPositionWeightPct: 2.5
    },
    riskConstraints: {
      maxPositionWeightPct: 15.0,
      maxSectorWeightPct: 30.0,
      maxPortfolioDrawdownPct: 15.0,
      maxPortfolioExposure: 90.0,
      maxPositionCount: 12
    },
    portfolioConstruction: {
      maxHoldings: 12,
      allowShorting: false,
      weightingScheme: 'FIXED_WEIGHT',
      rebalanceFrequency: 'MONTHLY'
    },
    rebalanceSchedule: 'DAILY_CLOSE',
    isDeterministic: true
  },

  // ----------------------------------------------------
  // 3. Momentum Rate of Change (v1.0.0)
  // ----------------------------------------------------
  {
    strategyId: 'strat-momentum',
    name: 'Momentum ROC Strategy',
    version: 'v1.0.0',
    description: 'Trend momentum model evaluating percentage price change over a 20-period lookback window.',
    universe: {
      markets: ['US', 'INDIA']
    },
    frequency: 'DAILY',
    parameters: {
      lookback: 20,
      buyThresholdPct: 5.0,
      sellThresholdPct: -5.0
    },
    indicators: [
      {
        id: 'momentum-20',
        name: 'Momentum 20',
        type: 'TECHNICAL',
        parameters: { lookback: 20 }
      }
    ],
    entryRules: [
      {
        id: 'rule-momentum-entry',
        category: 'ENTRY',
        name: 'Positive Velocity Breakout',
        condition: 'momentum-20 > 5.0',
        action: 'BUY',
        weight: 1.0
      }
    ],
    exitRules: [
      {
        id: 'rule-momentum-exit',
        category: 'EXIT',
        name: 'Negative Velocity Exhaustion',
        condition: 'momentum-20 < -5.0',
        action: 'SELL',
        weight: 1.0
      }
    ],
    positionSizing: {
      method: 'VOLATILITY_WEIGHTED',
      targetPositionPct: 8.0,
      maxPositionWeightPct: 15.0,
      minPositionWeightPct: 2.0
    },
    riskConstraints: {
      maxPositionWeightPct: 15.0,
      maxSectorWeightPct: 35.0,
      maxPortfolioDrawdownPct: 15.0,
      maxPortfolioExposure: 95.0,
      maxPositionCount: 10
    },
    portfolioConstruction: {
      maxHoldings: 10,
      allowShorting: false,
      weightingScheme: 'VOLATILITY_PARITY',
      rebalanceFrequency: 'WEEKLY'
    },
    rebalanceSchedule: 'WEEKLY_CLOSE',
    isDeterministic: true
  },

  // ----------------------------------------------------
  // 4. Donchian Channel Breakout (v1.0.0)
  // ----------------------------------------------------
  {
    strategyId: 'strat-breakout',
    name: 'Donchian Breakout Strategy',
    version: 'v1.0.0',
    description: 'Turtle-inspired price channel breakout system. Buys when close exceeds prior 20-day high (excluding current bar) and exits when close drops below prior 20-day low.',
    universe: {
      markets: ['US', 'INDIA']
    },
    frequency: 'DAILY',
    parameters: {
      lookback: 20
    },
    indicators: [
      {
        id: 'highest-high-20',
        name: 'Prior 20-Day High',
        type: 'TECHNICAL',
        parameters: { lookback: 20, excludeCurrentBar: true }
      },
      {
        id: 'lowest-low-20',
        name: 'Prior 20-Day Low',
        type: 'TECHNICAL',
        parameters: { lookback: 20, excludeCurrentBar: true }
      }
    ],
    entryRules: [
      {
        id: 'rule-breakout-high',
        category: 'ENTRY',
        name: 'Channel High Breakout',
        condition: 'close > highest-high-20',
        action: 'BUY',
        weight: 1.0
      }
    ],
    exitRules: [
      {
        id: 'rule-breakout-low',
        category: 'EXIT',
        name: 'Channel Low Breakdown',
        condition: 'close < lowest-low-20',
        action: 'SELL',
        weight: 1.0
      }
    ],
    positionSizing: {
      method: 'FIXED_PERCENT',
      targetPositionPct: 8.0,
      maxPositionWeightPct: 15.0,
      minPositionWeightPct: 3.0
    },
    riskConstraints: {
      maxPositionWeightPct: 15.0,
      maxSectorWeightPct: 30.0,
      maxPortfolioDrawdownPct: 15.0,
      maxPortfolioExposure: 90.0,
      maxPositionCount: 10
    },
    portfolioConstruction: {
      maxHoldings: 10,
      allowShorting: false,
      weightingScheme: 'FIXED_WEIGHT',
      rebalanceFrequency: 'DAILY'
    },
    rebalanceSchedule: 'DAILY_CLOSE',
    isDeterministic: true
  },

  // ----------------------------------------------------
  // 5. Multi-Factor Composite Strategy (v1.0.0)
  // ----------------------------------------------------
  {
    strategyId: 'strat-multi-factor',
    name: 'Multi-Factor Composite Model',
    version: 'v1.0.0',
    description: 'Systematic multi-factor quantitative model combining Momentum (35%), Trend (30%), RSI (20%), and Volatility (15%).',
    universe: {
      markets: ['US', 'INDIA']
    },
    frequency: 'DAILY',
    parameters: {
      momentumWeight: 0.35,
      trendWeight: 0.30,
      rsiWeight: 0.20,
      volatilityWeight: 0.15,
      compositeBuyThreshold: 0.30,
      compositeSellThreshold: -0.30
    },
    indicators: [
      {
        id: 'momentum-20',
        name: 'Momentum 20',
        type: 'TECHNICAL',
        parameters: { lookback: 20 }
      },
      {
        id: 'trend-sma-50',
        name: 'Trend SMA 50',
        type: 'TECHNICAL',
        parameters: { period: 50 }
      },
      {
        id: 'rsi-14',
        name: 'RSI 14',
        type: 'TECHNICAL',
        parameters: { period: 14 }
      },
      {
        id: 'volatility-20',
        name: 'Volatility 20',
        type: 'TECHNICAL',
        parameters: { lookback: 20 }
      }
    ],
    entryRules: [
      {
        id: 'rule-composite-bullish',
        category: 'ENTRY',
        name: 'Composite Factor Score >= 0.30',
        condition: 'composite-score >= 0.30',
        action: 'BUY',
        weight: 1.0
      }
    ],
    exitRules: [
      {
        id: 'rule-composite-bearish',
        category: 'EXIT',
        name: 'Composite Factor Score <= -0.30',
        condition: 'composite-score <= -0.30',
        action: 'SELL',
        weight: 1.0
      }
    ],
    positionSizing: {
      method: 'VOLATILITY_WEIGHTED',
      targetPositionPct: 10.0,
      maxPositionWeightPct: 20.0,
      minPositionWeightPct: 3.0
    },
    riskConstraints: {
      maxPositionWeightPct: 20.0,
      maxSectorWeightPct: 35.0,
      maxPortfolioDrawdownPct: 15.0,
      maxPortfolioExposure: 95.0,
      maxPositionCount: 12
    },
    portfolioConstruction: {
      maxHoldings: 12,
      allowShorting: false,
      weightingScheme: 'FACTOR_WEIGHTED',
      rebalanceFrequency: 'WEEKLY'
    },
    rebalanceSchedule: 'WEEKLY_CLOSE',
    isDeterministic: true
  }
];

/**
 * Standard structured rules helper for each strategy
 */
export function getStructuredRulesForStrategy(strategyId: string): {
  entryRules: StructuredStrategyRule[];
  exitRules: StructuredStrategyRule[];
} {
  switch (strategyId) {
    case 'strat-ma-crossover':
      return {
        entryRules: [
          {
            id: 'rule-ma-entry',
            category: 'ENTRY',
            name: 'Fast SMA Cross Above Slow SMA',
            leftOperand: { type: 'INDICATOR', reference: 'sma-20' },
            operator: 'CROSS_ABOVE',
            rightOperand: { type: 'INDICATOR', reference: 'sma-50' },
            action: 'BUY'
          }
        ],
        exitRules: [
          {
            id: 'rule-ma-exit',
            category: 'EXIT',
            name: 'Fast SMA Cross Below Slow SMA',
            leftOperand: { type: 'INDICATOR', reference: 'sma-20' },
            operator: 'CROSS_BELOW',
            rightOperand: { type: 'INDICATOR', reference: 'sma-50' },
            action: 'SELL'
          }
        ]
      };

    case 'strat-rsi':
      return {
        entryRules: [
          {
            id: 'rule-rsi-oversold',
            category: 'ENTRY',
            name: 'RSI <= 30 (Oversold Dip)',
            leftOperand: { type: 'INDICATOR', reference: 'rsi-14' },
            operator: '<=',
            rightOperand: { type: 'CONSTANT', value: 30 },
            action: 'BUY'
          }
        ],
        exitRules: [
          {
            id: 'rule-rsi-overbought',
            category: 'EXIT',
            name: 'RSI >= 70 (Overbought Peak)',
            leftOperand: { type: 'INDICATOR', reference: 'rsi-14' },
            operator: '>=',
            rightOperand: { type: 'CONSTANT', value: 70 },
            action: 'SELL'
          }
        ]
      };

    case 'strat-momentum':
      return {
        entryRules: [
          {
            id: 'rule-momentum-entry',
            category: 'ENTRY',
            name: 'Momentum > 5.0% (Bullish Acceleration)',
            leftOperand: { type: 'INDICATOR', reference: 'momentum-20' },
            operator: '>',
            rightOperand: { type: 'CONSTANT', value: 5.0 },
            action: 'BUY'
          }
        ],
        exitRules: [
          {
            id: 'rule-momentum-exit',
            category: 'EXIT',
            name: 'Momentum < -5.0% (Bearish Breakdown)',
            leftOperand: { type: 'INDICATOR', reference: 'momentum-20' },
            operator: '<',
            rightOperand: { type: 'CONSTANT', value: -5.0 },
            action: 'SELL'
          }
        ]
      };

    case 'strat-breakout':
      return {
        entryRules: [
          {
            id: 'rule-breakout-high',
            category: 'ENTRY',
            name: 'Close > Prior 20-Day High (Excluding Current Bar)',
            leftOperand: { type: 'PRICE', field: 'close' },
            operator: '>',
            rightOperand: { type: 'INDICATOR', reference: 'highest-high-20-prior' },
            action: 'BUY'
          }
        ],
        exitRules: [
          {
            id: 'rule-breakout-low',
            category: 'EXIT',
            name: 'Close < Prior 20-Day Low (Excluding Current Bar)',
            leftOperand: { type: 'PRICE', field: 'close' },
            operator: '<',
            rightOperand: { type: 'INDICATOR', reference: 'lowest-low-20-prior' },
            action: 'SELL'
          }
        ]
      };

    case 'strat-multi-factor':
      return {
        entryRules: [
          {
            id: 'rule-composite-bullish',
            category: 'ENTRY',
            name: 'Composite Multi-Factor Score >= 0.30',
            leftOperand: { type: 'CALCULATED_VALUE', reference: 'composite-score' },
            operator: '>=',
            rightOperand: { type: 'CONSTANT', value: 0.30 },
            action: 'BUY'
          }
        ],
        exitRules: [
          {
            id: 'rule-composite-bearish',
            category: 'EXIT',
            name: 'Composite Multi-Factor Score <= -0.30',
            leftOperand: { type: 'CALCULATED_VALUE', reference: 'composite-score' },
            operator: '<=',
            rightOperand: { type: 'CONSTANT', value: -0.30 },
            action: 'SELL'
          }
        ]
      };

    default:
      return { entryRules: [], exitRules: [] };
  }
}
