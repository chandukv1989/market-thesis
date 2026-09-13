/**
 * Phase 12A - Real Backtesting Engine Core Types
 * 
 * Strict deterministic contracts for historical walk-forward simulation.
 * Zero LLM / Gemini involvement in mathematical or trade calculations.
 */

import {
  HistoricalPriceBar,
  QuantStrategy,
  PositionSizingRule,
  QuantitativeRiskConstraints,
  PointInTimeProvenance,
  EpistemicStatus,
  DataQualityStatus,
  BacktestConfiguration,
  BacktestTrade,
  EquityPoint,
  SimulatedPosition,
  BacktestResult,
  StrategyEvaluationResult,
  AnalyticalSignal,
  MarketRegion
} from '../../../src/types';

export interface DataValidationIssue {
  type: 'OUT_OF_ORDER' | 'DUPLICATE_TIMESTAMP' | 'NEGATIVE_PRICE' | 'INVALID_OHLC' | 'NEGATIVE_VOLUME' | 'INSUFFICIENT_HISTORY' | 'FREQUENCY_ANOMALY';
  message: string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

export interface HistoricalDataValidationResult {
  isValid: boolean;
  quality: DataQualityStatus;
  totalBars: number;
  startDate?: string;
  endDate?: string;
  issues: DataValidationIssue[];
  corporateActionsStatus: 'ADJUSTED' | 'UNADJUSTED' | 'UNKNOWN';
}

export interface SimulatedOrder {
  orderId: string;
  signalId: string;
  securityId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  targetWeightPct: number;
  requestedPrice: number;
  signalTimestamp: string;
  executionTimestamp: string;
  strategyId: string;
  strategyVersion: string;
  rationale: string;
  provenance: PointInTimeProvenance;
}

export interface ExecutionFill {
  tradeId: string;
  signalId: string;
  securityId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  requestedPrice: number;
  executionPrice: number;
  grossValue: number;
  slippageCost: number;
  transactionCost: number;
  netValue: number; // For BUY: -(gross + cost), For SELL: +(gross - cost)
  timestamp: string;
  signalTimestamp: string;
  executionModel: string;
  realizedPnL?: number;
  rationale: string;
  provenance: PointInTimeProvenance;
}

export interface PortfolioState {
  cash: number;
  positions: Map<string, SimulatedPosition>;
  totalEquity: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalTransactionCosts: number;
  totalSlippageCost: number;
}
