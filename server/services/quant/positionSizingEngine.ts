/**
 * Deterministic Position Sizing Engine (Phase 11)
 * 
 * Computes portfolio allocation weights based on mathematical models and clamps
 * allocations strictly to risk bounds.
 * 
 * Sizing Methods:
 * 1. FIXED_PERCENT: Fixed capital allocation (e.g. 5% per position)
 * 2. EQUAL_WEIGHT: Equal allocation across universe/target slots (e.g. 100 / N)
 * 3. VOLATILITY_WEIGHTED: Risk-parity weighting inversely proportional to asset volatility
 * 
 * Safety:
 * Always enforces [minPositionWeightPct, maxPositionWeightPct].
 */

import {
  PositionSizingRule,
  PositionSizingResult,
  CalculatedIndicator
} from '../../../src/types';

export interface SizingContext {
  portfolioValue?: number;
  currentPrice?: number;
  volatilityIndicator?: CalculatedIndicator;
  targetRiskVolPct?: number; // Target portfolio risk volatility (default 15%)
  universeSize?: number;
}

export class PositionSizingEngine {
  public static calculateSizing(
    rule: PositionSizingRule,
    context: SizingContext = {}
  ): PositionSizingResult {
    const minWeight = rule.minPositionWeightPct ?? 0;
    const maxWeight = rule.maxPositionWeightPct ?? 100;
    let rawWeight = 0;
    let explanation = '';

    switch (rule.method) {
      case 'FIXED_PERCENT': {
        rawWeight = rule.targetPositionPct ?? 5.0;
        explanation = `Fixed allocation targeting ${rawWeight}% of portfolio.`;
        break;
      }

      case 'EQUAL_WEIGHT': {
        const slots = context.universeSize && context.universeSize > 0 ? context.universeSize : 10;
        rawWeight = Number((100 / slots).toFixed(2));
        explanation = `Equal weighting across ${slots} universe slots (${rawWeight}% per position).`;
        break;
      }

      case 'VOLATILITY_WEIGHTED': {
        const vol = context.volatilityIndicator?.value;
        const targetVol = context.targetRiskVolPct || 15.0; // Target annual risk 15%

        if (vol && vol > 0) {
          // Weight inversely proportional to annualized volatility
          // Weight = TargetRisk / AssetVolatility * baseAllocation (e.g. 5%)
          const scalar = targetVol / vol;
          const basePct = rule.targetPositionPct ?? 5.0;
          rawWeight = Number((basePct * scalar).toFixed(2));
          explanation = `Volatility-adjusted allocation: Target Risk ${targetVol}% / Volatility ${vol}% * Base ${basePct}% = ${rawWeight}%.`;
        } else {
          // Fallback to conservative default if volatility unavailable
          rawWeight = rule.targetPositionPct ?? 5.0;
          explanation = `Volatility unavailable; defaulted to baseline allocation ${rawWeight}%.`;
        }
        break;
      }

      default: {
        rawWeight = rule.targetPositionPct ?? 5.0;
        explanation = `Standard allocation targeting ${rawWeight}%.`;
      }
    }

    // Strict boundary clamping
    let boundedWeight = rawWeight;
    let isConstrained = false;

    if (boundedWeight < minWeight) {
      boundedWeight = minWeight;
      isConstrained = true;
      explanation += ` Clamped up to minimum bound of ${minWeight}%.`;
    } else if (boundedWeight > maxWeight) {
      boundedWeight = maxWeight;
      isConstrained = true;
      explanation += ` Clamped down to maximum bound of ${maxWeight}%.`;
    }

    // Calculate shares and capital if portfolio value and price are provided
    let shares: number | undefined;
    let capitalAllocation: number | undefined;

    if (context.portfolioValue && context.portfolioValue > 0) {
      capitalAllocation = Number(((boundedWeight / 100) * context.portfolioValue).toFixed(2));
      if (context.currentPrice && context.currentPrice > 0) {
        shares = Math.floor(capitalAllocation / context.currentPrice);
      }
    }

    return {
      method: rule.method,
      rawWeightPct: Number(rawWeight.toFixed(2)),
      boundedWeightPct: Number(boundedWeight.toFixed(2)),
      targetWeightPct: Number(boundedWeight.toFixed(2)),
      shares,
      capitalAllocation,
      isConstrained,
      explanation
    };
  }
}
