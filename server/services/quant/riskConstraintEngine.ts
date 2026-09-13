/**
 * Deterministic Risk Constraint Engine (Phase 11)
 * 
 * Audits prospective strategy allocations against portfolio risk limits.
 * 
 * Evaluated Constraints:
 * 1. MAX_POSITION_WEIGHT
 * 2. MAX_SECTOR_WEIGHT
 * 3. MAX_MARKET_WEIGHT
 * 4. MAX_PORTFOLIO_EXPOSURE
 * 5. MAX_POSITION_COUNT
 * 
 * Strict Non-Execution Guardrail:
 * Flags violations transparently and bounds prospective allocations without
 * executing orders or automated rebalancing.
 */

import {
  QuantitativeRiskConstraints,
  RiskConstraintEvaluationResult,
  MarketRegion
} from '../../../src/types';

export interface PortfolioRiskContext {
  totalPortfolioValue?: number;
  currentHoldings?: {
    securityId: string;
    symbol: string;
    weightPct: number;
    sector?: string;
    market?: MarketRegion;
  }[];
  cashReservePct?: number;
  targetSector?: string;
  targetMarket?: MarketRegion;
}

export class RiskConstraintEngine {
  public static evaluateConstraints(
    constraints: QuantitativeRiskConstraints,
    prospectiveWeightPct: number,
    securityId: string,
    context: PortfolioRiskContext = {}
  ): {
    results: RiskConstraintEvaluationResult[];
    constrainedWeightPct: number;
    isConstrained: boolean;
  } {
    const results: RiskConstraintEvaluationResult[] = [];
    let constrainedWeight = prospectiveWeightPct;
    let isConstrained = false;

    const holdings = context.currentHoldings || [];
    const existingPosition = holdings.find(h => h.securityId === securityId);
    const currentWeight = existingPosition ? existingPosition.weightPct : 0;

    // 1. MAX_POSITION_WEIGHT
    if (constraints.maxPositionWeight !== undefined) {
      const limit = constraints.maxPositionWeight;
      const totalProspectiveWeight = currentWeight + prospectiveWeightPct;
      const passed = totalProspectiveWeight <= limit;

      let adjustedWeight: number | undefined;
      if (!passed) {
        adjustedWeight = Math.max(0, limit - currentWeight);
        constrainedWeight = Math.min(constrainedWeight, adjustedWeight);
        isConstrained = true;
      }

      results.push({
        constraintId: 'risk-max-position-weight',
        constraintType: 'MAX_POSITION_WEIGHT',
        passed,
        observedValue: Number(totalProspectiveWeight.toFixed(2)),
        limit,
        severity: passed ? 'INFO' : 'CRITICAL',
        adjustedWeightPct: adjustedWeight !== undefined ? Number(adjustedWeight.toFixed(2)) : undefined,
        explanation: passed
          ? `Prospective weight ${totalProspectiveWeight.toFixed(2)}% is within max position limit of ${limit}%.`
          : `Prospective weight ${totalProspectiveWeight.toFixed(2)}% exceeds max position limit of ${limit}%. Bounded to ${adjustedWeight?.toFixed(2)}%.`
      });
    }

    // 2. MAX_SECTOR_WEIGHT
    if (constraints.maxSectorWeight !== undefined && context.targetSector) {
      const limit = constraints.maxSectorWeight;
      const currentSectorExposure = holdings
        .filter(h => h.sector === context.targetSector && h.securityId !== securityId)
        .reduce((sum, h) => sum + h.weightPct, 0);

      const prospectiveSectorExposure = currentSectorExposure + prospectiveWeightPct;
      const passed = prospectiveSectorExposure <= limit;

      let adjustedWeight: number | undefined;
      if (!passed) {
        adjustedWeight = Math.max(0, limit - currentSectorExposure);
        constrainedWeight = Math.min(constrainedWeight, adjustedWeight);
        isConstrained = true;
      }

      results.push({
        constraintId: 'risk-max-sector-weight',
        constraintType: 'MAX_SECTOR_WEIGHT',
        passed,
        observedValue: Number(prospectiveSectorExposure.toFixed(2)),
        limit,
        severity: passed ? 'INFO' : 'WARNING',
        adjustedWeightPct: adjustedWeight !== undefined ? Number(adjustedWeight.toFixed(2)) : undefined,
        explanation: passed
          ? `Sector "${context.targetSector}" exposure ${prospectiveSectorExposure.toFixed(2)}% is within limit of ${limit}%.`
          : `Sector "${context.targetSector}" exposure would reach ${prospectiveSectorExposure.toFixed(2)}%, exceeding limit of ${limit}%. Bounded to ${adjustedWeight?.toFixed(2)}%.`
      });
    }

    // 3. MAX_MARKET_WEIGHT
    if (constraints.maxMarketWeight !== undefined && context.targetMarket) {
      const limit = constraints.maxMarketWeight;
      const currentMarketExposure = holdings
        .filter(h => h.market === context.targetMarket && h.securityId !== securityId)
        .reduce((sum, h) => sum + h.weightPct, 0);

      const prospectiveMarketExposure = currentMarketExposure + prospectiveWeightPct;
      const passed = prospectiveMarketExposure <= limit;

      let adjustedWeight: number | undefined;
      if (!passed) {
        adjustedWeight = Math.max(0, limit - currentMarketExposure);
        constrainedWeight = Math.min(constrainedWeight, adjustedWeight);
        isConstrained = true;
      }

      results.push({
        constraintId: 'risk-max-market-weight',
        constraintType: 'MAX_MARKET_WEIGHT',
        passed,
        observedValue: Number(prospectiveMarketExposure.toFixed(2)),
        limit,
        severity: passed ? 'INFO' : 'WARNING',
        adjustedWeightPct: adjustedWeight !== undefined ? Number(adjustedWeight.toFixed(2)) : undefined,
        explanation: passed
          ? `Market [${context.targetMarket}] exposure ${prospectiveMarketExposure.toFixed(2)}% is within limit of ${limit}%.`
          : `Market [${context.targetMarket}] exposure would reach ${prospectiveMarketExposure.toFixed(2)}%, exceeding limit of ${limit}%. Bounded to ${adjustedWeight?.toFixed(2)}%.`
      });
    }

    // 4. MAX_PORTFOLIO_EXPOSURE
    if (constraints.maxPortfolioExposure !== undefined) {
      const limit = constraints.maxPortfolioExposure;
      const totalCurrentExposure = holdings
        .filter(h => h.securityId !== securityId)
        .reduce((sum, h) => sum + h.weightPct, 0);

      const prospectiveTotalExposure = totalCurrentExposure + prospectiveWeightPct;
      const passed = prospectiveTotalExposure <= limit;

      let adjustedWeight: number | undefined;
      if (!passed) {
        adjustedWeight = Math.max(0, limit - totalCurrentExposure);
        constrainedWeight = Math.min(constrainedWeight, adjustedWeight);
        isConstrained = true;
      }

      results.push({
        constraintId: 'risk-max-portfolio-exposure',
        constraintType: 'MAX_PORTFOLIO_EXPOSURE',
        passed,
        observedValue: Number(prospectiveTotalExposure.toFixed(2)),
        limit,
        severity: passed ? 'INFO' : 'CRITICAL',
        adjustedWeightPct: adjustedWeight !== undefined ? Number(adjustedWeight.toFixed(2)) : undefined,
        explanation: passed
          ? `Total portfolio exposure ${prospectiveTotalExposure.toFixed(2)}% is within max limit of ${limit}%.`
          : `Total portfolio exposure would reach ${prospectiveTotalExposure.toFixed(2)}%, exceeding max limit of ${limit}%. Bounded to ${adjustedWeight?.toFixed(2)}%.`
      });
    }

    // 5. MAX_POSITION_COUNT
    if (constraints.maxPositionCount !== undefined && !existingPosition) {
      const limit = constraints.maxPositionCount;
      const prospectiveCount = holdings.length + 1;
      const passed = prospectiveCount <= limit;

      if (!passed) {
        constrainedWeight = 0;
        isConstrained = true;
      }

      results.push({
        constraintId: 'risk-max-position-count',
        constraintType: 'MAX_POSITION_COUNT',
        passed,
        observedValue: prospectiveCount,
        limit,
        severity: passed ? 'INFO' : 'WARNING',
        explanation: passed
          ? `Position count (${prospectiveCount}) within portfolio limit of ${limit}.`
          : `Portfolio has reached max position count limit (${limit}). New entry prohibited.`
      });
    }

    return {
      results,
      constrainedWeightPct: Math.max(0, Number(constrainedWeight.toFixed(2))),
      isConstrained
    };
  }
}
