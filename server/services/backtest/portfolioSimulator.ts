/**
 * Phase 12A - Portfolio Simulator & Accounting Engine
 * 
 * Strict deterministic portfolio accounting across every simulation timestamp.
 * 
 * Invariants:
 * - Portfolio Equity = Cash + Market Value of Positions (at every bar).
 * - Ending Equity = Initial Capital + Realized P&L + Unrealized P&L - Transaction Costs.
 * - Multi-lot buys compute weighted average entry price.
 * - Long sales release cost basis and book realized P&L.
 */

import {
  SimulatedPosition,
  EquityPoint
} from '../../../src/types';
import { ExecutionFill, PortfolioState } from './backtestTypes';

export class PortfolioSimulator {
  private cash: number;
  private initialCapital: number;
  private currency: string;
  private positions: Map<string, SimulatedPosition> = new Map();
  private equityCurve: EquityPoint[] = [];
  private peakEquity: number;
  private totalRealizedPnL: number = 0;
  private totalTransactionCosts: number = 0;
  private totalSlippageCost: number = 0;

  constructor(initialCapital: number, currency: string = 'USD') {
    this.initialCapital = initialCapital;
    this.cash = initialCapital;
    this.currency = currency;
    this.peakEquity = initialCapital;
  }

  public getCash(): number {
    return this.cash;
  }

  public getTotalEquity(): number {
    let posValue = 0;
    for (const pos of this.positions.values()) {
      posValue += pos.marketValue;
    }
    return Number((this.cash + posValue).toFixed(4));
  }

  public getPosition(securityId: string): SimulatedPosition | undefined {
    return this.positions.get(securityId);
  }

  public getAllPositions(): SimulatedPosition[] {
    return Array.from(this.positions.values());
  }

  public getEquityCurve(): EquityPoint[] {
    return [...this.equityCurve];
  }

  public getTotalRealizedPnL(): number {
    return Number(this.totalRealizedPnL.toFixed(4));
  }

  public getTotalTransactionCosts(): number {
    return Number(this.totalTransactionCosts.toFixed(4));
  }

  public getTotalSlippageCost(): number {
    return Number(this.totalSlippageCost.toFixed(4));
  }

  public getTotalUnrealizedPnL(): number {
    let unPnL = 0;
    for (const pos of this.positions.values()) {
      unPnL += pos.unrealizedPnL;
    }
    return Number(unPnL.toFixed(4));
  }

  /**
   * Apply an execution fill to cash and positions.
   */
  public applyFill(fill: ExecutionFill): void {
    this.totalTransactionCosts += fill.transactionCost;
    this.totalSlippageCost += fill.slippageCost;

    if (fill.side === 'BUY') {
      // Cash decreases by gross value + transaction cost
      this.cash = Number((this.cash - (fill.grossValue + fill.transactionCost)).toFixed(4));

      const existing = this.positions.get(fill.securityId);
      if (!existing) {
        this.positions.set(fill.securityId, {
          securityId: fill.securityId,
          symbol: fill.symbol,
          quantity: fill.quantity,
          averageEntryPrice: fill.executionPrice,
          currentPrice: fill.executionPrice,
          marketValue: Number((fill.quantity * fill.executionPrice).toFixed(4)),
          realizedPnL: 0,
          unrealizedPnL: 0,
          weight: 0,
          weightPct: 0,
          currency: this.currency
        });
      } else {
        const totalQty = existing.quantity + fill.quantity;
        const totalCostBasis = (existing.quantity * existing.averageEntryPrice) + (fill.quantity * fill.executionPrice);
        const newAvgPrice = totalCostBasis / totalQty;

        existing.quantity = totalQty;
        existing.averageEntryPrice = Number(newAvgPrice.toFixed(4));
        existing.currentPrice = fill.executionPrice;
        existing.marketValue = Number((totalQty * fill.executionPrice).toFixed(4));
        existing.unrealizedPnL = Number((totalQty * (fill.executionPrice - existing.averageEntryPrice)).toFixed(4));
      }
    } else if (fill.side === 'SELL') {
      // Cash increases by gross value - transaction cost
      this.cash = Number((this.cash + (fill.grossValue - fill.transactionCost)).toFixed(4));

      const existing = this.positions.get(fill.securityId);
      if (existing) {
        const realized = fill.realizedPnL !== undefined
          ? fill.realizedPnL
          : fill.quantity * (fill.executionPrice - existing.averageEntryPrice);

        this.totalRealizedPnL += realized;
        existing.realizedPnL = Number((existing.realizedPnL + realized).toFixed(4));

        const remainingQty = existing.quantity - fill.quantity;
        if (remainingQty <= 0) {
          this.positions.delete(fill.securityId);
        } else {
          existing.quantity = remainingQty;
          existing.marketValue = Number((remainingQty * fill.executionPrice).toFixed(4));
          existing.unrealizedPnL = Number((remainingQty * (fill.executionPrice - existing.averageEntryPrice)).toFixed(4));
        }
      }
    }
  }

  /**
   * Mark all positions to market at bar close and record equity curve point.
   */
  public markToMarket(
    timestamp: string,
    currentPrices: Map<string, number>,
    benchmarkValue: number = 0
  ): EquityPoint {
    let positionsValue = 0;

    for (const [secId, pos] of this.positions.entries()) {
      const currentPrice = currentPrices.get(secId) || pos.currentPrice;
      pos.currentPrice = currentPrice;
      pos.marketValue = Number((pos.quantity * currentPrice).toFixed(4));
      pos.unrealizedPnL = Number((pos.quantity * (currentPrice - pos.averageEntryPrice)).toFixed(4));
      positionsValue += pos.marketValue;
    }

    const totalEquity = Number((this.cash + positionsValue).toFixed(4));

    if (totalEquity > this.peakEquity) {
      this.peakEquity = totalEquity;
    }

    const drawdown = this.peakEquity > 0
      ? Number((((totalEquity - this.peakEquity) / this.peakEquity) * 100).toFixed(2))
      : 0;

    // Update position weights
    for (const pos of this.positions.values()) {
      pos.weight = totalEquity > 0 ? Number((pos.marketValue / totalEquity).toFixed(4)) : 0;
      pos.weightPct = Number((pos.weight * 100).toFixed(2));
    }

    const dateStr = timestamp.includes('T') ? timestamp.split('T')[0] : timestamp;

    const point: EquityPoint = {
      timestamp,
      date: dateStr,
      cash: Number(this.cash.toFixed(2)),
      positionsValue: Number(positionsValue.toFixed(2)),
      totalEquity: Number(totalEquity.toFixed(2)),
      strategy: Number(totalEquity.toFixed(2)),
      benchmark: benchmarkValue > 0 ? Number(benchmarkValue.toFixed(2)) : Number(totalEquity.toFixed(2)),
      drawdown,
      drawdownPct: drawdown
    };

    this.equityCurve.push(point);
    return point;
  }

  /**
   * Reconcile accounting equation:
   * Ending Equity === Initial Capital + Realized PnL + Unrealized PnL - Transaction Costs
   */
  public reconcileAccounting(): {
    reconciled: boolean;
    endingEquity: number;
    expectedEquity: number;
    difference: number;
    initialCapital: number;
    realizedPnL: number;
    unrealizedPnL: number;
    transactionCosts: number;
  } {
    const endingEquity = this.getTotalEquity();
    const unrealizedPnL = this.getTotalUnrealizedPnL();
    const realizedPnL = this.getTotalRealizedPnL();
    const transactionCosts = this.getTotalTransactionCosts();

    const expectedEquity = Number((this.initialCapital + realizedPnL + unrealizedPnL - transactionCosts).toFixed(4));
    const difference = Math.abs(Number((endingEquity - expectedEquity).toFixed(4)));

    // Allow float epsilon tolerance (0.05 currency units)
    const reconciled = difference < 0.05;

    return {
      reconciled,
      endingEquity,
      expectedEquity,
      difference,
      initialCapital: this.initialCapital,
      realizedPnL,
      unrealizedPnL,
      transactionCosts
    };
  }
}
