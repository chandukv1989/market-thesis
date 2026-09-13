/**
 * Phase 12A - Simulated Execution Engine
 * 
 * 100% Deterministic simulated trade execution.
 * 
 * Invariants:
 * - NO real broker connection or live order routing.
 * - Slippage always worsens execution price (BUY higher, SELL lower).
 * - Configurable transaction costs (US vs India).
 * - Strict long-only default (no naked shorting).
 * - No leverage default (cash cannot go below zero).
 */

import {
  BacktestConfiguration,
  TransactionCostConfig,
  SlippageConfig,
  PointInTimeProvenance,
  SimulatedPosition
} from '../../../src/types';
import { SimulatedOrder, ExecutionFill } from './backtestTypes';

export class SimulatedExecutionEngine {
  /**
   * Determine slippage rate from configuration.
   */
  public static getSlippageRate(config?: SlippageConfig, slippageBps?: number): number {
    if (config) {
      if (config.type === 'BPS') {
        return Math.max(0, config.rate) / 10000;
      }
      return Math.max(0, config.rate);
    }
    if (typeof slippageBps === 'number') {
      return Math.max(0, slippageBps) / 10000;
    }
    // Default 5 bps (0.05%)
    return 0.0005;
  }

  /**
   * Calculate transaction costs for a trade gross value.
   */
  public static calculateTransactionCost(
    grossValue: number,
    currency: string,
    costConfig?: TransactionCostConfig,
    commissionPerTrade?: number
  ): number {
    if (grossValue <= 0) return 0;

    if (costConfig) {
      let cost = 0;
      if (costConfig.type === 'BPS') {
        cost = grossValue * (costConfig.rate / 10000);
      } else if (costConfig.type === 'PERCENT') {
        cost = grossValue * costConfig.rate;
      } else if (costConfig.type === 'FIXED') {
        cost = costConfig.rate;
      }

      if (costConfig.fixedPerTrade) {
        cost += costConfig.fixedPerTrade;
      }

      if (costConfig.minCost && cost < costConfig.minCost) {
        cost = costConfig.minCost;
      }

      return Math.max(0, Number(cost.toFixed(4)));
    }

    if (typeof commissionPerTrade === 'number' && commissionPerTrade >= 0) {
      return commissionPerTrade;
    }

    // Default institutional/retail estimates
    if (currency === 'INR') {
      // Indian brokerage + STT + exchange fees ~ 0.1% or ₹20 fixed
      const variable = grossValue * 0.001;
      return Math.max(20, Number(variable.toFixed(2)));
    }

    // US default: ~0.05% with $1 minimum
    const variable = grossValue * 0.0005;
    return Math.max(1.0, Number(variable.toFixed(4)));
  }

  /**
   * Execute a simulated trade given target weight, current portfolio state, and execution market price.
   */
  public static executeOrder(
    order: SimulatedOrder,
    executionMarketPrice: number,
    availableCash: number,
    totalPortfolioEquity: number,
    currentPosition: SimulatedPosition | undefined,
    config: BacktestConfiguration
  ): ExecutionFill | null {
    if (executionMarketPrice <= 0 || totalPortfolioEquity <= 0) {
      return null;
    }

    const slippageRate = this.getSlippageRate(config.slippage, config.slippageBps);
    const currency = config.currency || config.baseCurrency || 'USD';
    const allowShorting = config.allowShorting === true;

    const currentQty = currentPosition ? currentPosition.quantity : 0;
    const currentAvgPrice = currentPosition ? currentPosition.averageEntryPrice : 0;

    // Calculate target value in currency
    const targetValue = (order.targetWeightPct / 100) * totalPortfolioEquity;
    const currentValue = currentQty * executionMarketPrice;
    const deltaValue = targetValue - currentValue;

    // Minimum trade threshold (avoid microscopic trades)
    const minTradeValue = currency === 'INR' ? 100 : 10;

    if (order.side === 'BUY') {
      // Calculate execution price with slippage (BUY higher)
      const executionPrice = executionMarketPrice * (1 + slippageRate);
      const slippagePerShare = executionPrice - executionMarketPrice;

      // Determine desired shares
      let desiredShares = Math.floor(Math.max(0, deltaValue) / executionPrice);
      if (desiredShares <= 0) {
        return null;
      }

      // Check cash constraint (no leverage)
      let grossValue = desiredShares * executionPrice;
      let transactionCost = this.calculateTransactionCost(grossValue, currency, config.transactionCost, config.commissionPerTrade);

      while (desiredShares > 0 && (grossValue + transactionCost > availableCash)) {
        desiredShares--;
        grossValue = desiredShares * executionPrice;
        transactionCost = this.calculateTransactionCost(grossValue, currency, config.transactionCost, config.commissionPerTrade);
      }

      if (desiredShares <= 0) {
        return null; // Insufficient cash to execute even 1 share + cost
      }

      const slippageCost = slippagePerShare * desiredShares;
      const netValue = -(grossValue + transactionCost);

      return {
        tradeId: `trade-${order.orderId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        signalId: order.signalId,
        securityId: order.securityId,
        symbol: order.symbol,
        side: 'BUY',
        quantity: desiredShares,
        requestedPrice: order.requestedPrice,
        executionPrice: Number(executionPrice.toFixed(4)),
        grossValue: Number(grossValue.toFixed(4)),
        slippageCost: Number(slippageCost.toFixed(4)),
        transactionCost: Number(transactionCost.toFixed(4)),
        netValue: Number(netValue.toFixed(4)),
        timestamp: order.executionTimestamp,
        signalTimestamp: order.signalTimestamp,
        executionModel: config.executionTiming || 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN',
        rationale: order.rationale,
        provenance: order.provenance
      };
    }

    if (order.side === 'SELL') {
      // Long-only constraint: cannot sell what we do not hold
      if (currentQty <= 0) {
        return null;
      }

      // Calculate execution price with slippage (SELL lower)
      const executionPrice = executionMarketPrice * (1 - slippageRate);
      const slippagePerShare = executionMarketPrice - executionPrice;

      // Determine shares to sell
      let sharesToSell = 0;
      if (order.targetWeightPct <= 0) {
        // Complete exit
        sharesToSell = currentQty;
      } else {
        // Partial rebalance down
        const sharesToReduce = Math.floor(Math.abs(deltaValue) / executionMarketPrice);
        sharesToSell = Math.min(currentQty, sharesToReduce);
      }

      if (sharesToSell <= 0) {
        return null;
      }

      const grossValue = sharesToSell * executionPrice;
      const slippageCost = slippagePerShare * sharesToSell;
      const transactionCost = this.calculateTransactionCost(grossValue, currency, config.transactionCost, config.commissionPerTrade);
      const netValue = grossValue - transactionCost;

      // Realized P&L calculation for long position exit
      const realizedPnL = sharesToSell * (executionPrice - currentAvgPrice);

      return {
        tradeId: `trade-${order.orderId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        signalId: order.signalId,
        securityId: order.securityId,
        symbol: order.symbol,
        side: 'SELL',
        quantity: sharesToSell,
        requestedPrice: order.requestedPrice,
        executionPrice: Number(executionPrice.toFixed(4)),
        grossValue: Number(grossValue.toFixed(4)),
        slippageCost: Number(slippageCost.toFixed(4)),
        transactionCost: Number(transactionCost.toFixed(4)),
        netValue: Number(netValue.toFixed(4)),
        timestamp: order.executionTimestamp,
        signalTimestamp: order.signalTimestamp,
        executionModel: config.executionTiming || 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN',
        realizedPnL: Number(realizedPnL.toFixed(4)),
        rationale: order.rationale,
        provenance: order.provenance
      };
    }

    return null;
  }
}
