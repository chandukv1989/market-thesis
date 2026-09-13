/**
 * Deterministic Strategy Rule Evaluator (Phase 11)
 * 
 * Safely evaluates mathematical rule conditions without eval() or string execution.
 * 
 * Supported Operators:
 * - GREATER_THAN / >
 * - GREATER_THAN_OR_EQUAL / >=
 * - LESS_THAN / <
 * - LESS_THAN_OR_EQUAL / <=
 * - EQUAL / ==
 * - CROSS_ABOVE (previousLeft <= previousRight && currentLeft > currentRight)
 * - CROSS_BELOW (previousLeft >= previousRight && currentLeft < currentRight)
 * 
 * Crossover Invariant:
 * Strictly requires prior baseline values. Does NOT fire continuously while remaining above/below.
 */

import {
  HistoricalPriceBar,
  CalculatedIndicator,
  StructuredStrategyRule,
  RuleEvaluationResult,
  RuleComparisonOperator,
  RuleOperand
} from '../../../src/types';

export interface EvaluationState {
  currentBar: HistoricalPriceBar;
  previousBar?: HistoricalPriceBar;
  indicators: Record<string, CalculatedIndicator>;
}

export class StrategyRuleEvaluator {
  /**
   * Evaluate a single structured rule against current market state
   */
  public static evaluateRule(
    rule: StructuredStrategyRule,
    state: EvaluationState
  ): RuleEvaluationResult {
    const leftVal = this.resolveOperandValue(rule.leftOperand, state, false);
    const rightVal = this.resolveOperandValue(rule.rightOperand, state, false);
    const prevLeftVal = this.resolveOperandValue(rule.leftOperand, state, true);
    const prevRightVal = this.resolveOperandValue(rule.rightOperand, state, true);

    // If either operand is null/unavailable, comparison fails deterministically
    if (leftVal === null || rightVal === null) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: false,
        operator: rule.operator,
        currentLeftValue: leftVal,
        currentRightValue: rightVal,
        previousLeftValue: prevLeftVal,
        previousRightValue: prevRightVal,
        explanation: `Rule "${rule.name}" evaluated to FALSE because operand data is unavailable (left: ${leftVal}, right: ${rightVal}).`
      };
    }

    const passed = this.compare(
      rule.operator,
      leftVal,
      rightVal,
      prevLeftVal,
      prevRightVal
    );

    const explanation = this.buildExplanation(
      rule.name,
      rule.operator,
      passed,
      leftVal,
      rightVal,
      prevLeftVal,
      prevRightVal
    );

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      operator: rule.operator,
      currentLeftValue: leftVal,
      currentRightValue: rightVal,
      previousLeftValue: prevLeftVal,
      previousRightValue: prevRightVal,
      explanation
    };
  }

  /**
   * Evaluate a composite group of rules with AND, OR, NOT combinators
   */
  public static evaluateRuleGroup(
    rules: StructuredStrategyRule[],
    combinator: 'AND' | 'OR' = 'AND',
    state: EvaluationState
  ): { passed: boolean; evaluations: RuleEvaluationResult[] } {
    if (!rules || rules.length === 0) {
      return { passed: false, evaluations: [] };
    }

    const evaluations: RuleEvaluationResult[] = [];
    for (const rule of rules) {
      // Subrules recursion if present
      if (rule.subRules && rule.subRules.length > 0) {
        const subGroup = this.evaluateRuleGroup(
          rule.subRules,
          rule.combinator === 'OR' ? 'OR' : 'AND',
          state
        );
        evaluations.push(...subGroup.evaluations);
      } else {
        const res = this.evaluateRule(rule, state);
        evaluations.push(res);
      }
    }

    let groupPassed = combinator === 'AND';
    if (combinator === 'AND') {
      groupPassed = evaluations.every(e => e.passed);
    } else {
      groupPassed = evaluations.some(e => e.passed);
    }

    return { passed: groupPassed, evaluations };
  }

  /**
   * Compare operands safely using deterministic operators
   */
  public static compare(
    operator: RuleComparisonOperator,
    currentLeft: number,
    currentRight: number,
    previousLeft: number | null,
    previousRight: number | null
  ): boolean {
    switch (operator) {
      case '>':
      case 'GREATER_THAN':
        return currentLeft > currentRight;

      case '>=':
      case 'GREATER_THAN_OR_EQUAL':
        return currentLeft >= currentRight;

      case '<':
      case 'LESS_THAN':
        return currentLeft < currentRight;

      case '<=':
      case 'LESS_THAN_OR_EQUAL':
        return currentLeft <= currentRight;

      case '==':
      case 'EQUAL':
        return Math.abs(currentLeft - currentRight) < 0.00001;

      case 'CROSS_ABOVE':
        // Must have both previous left and previous right
        if (previousLeft === null || previousRight === null) {
          return false;
        }
        // Strict crossover condition:
        // Was at or below right on previous bar, now strictly above right on current bar
        return previousLeft <= previousRight && currentLeft > currentRight;

      case 'CROSS_BELOW':
        if (previousLeft === null || previousRight === null) {
          return false;
        }
        // Strict crossover condition:
        // Was at or above right on previous bar, now strictly below right on current bar
        return previousLeft >= previousRight && currentLeft < currentRight;

      default:
        return false;
    }
  }

  /**
   * Resolve numeric value of an operand from current state or previous bar
   */
  private static resolveOperandValue(
    operand: RuleOperand,
    state: EvaluationState,
    isPrevious: boolean
  ): number | null {
    if (operand.type === 'CONSTANT') {
      return operand.value !== undefined ? operand.value : null;
    }

    const bar = isPrevious ? state.previousBar : state.currentBar;

    if (operand.type === 'PRICE') {
      if (!bar) return null;
      const field = operand.field || 'close';
      const val = bar[field];
      return typeof val === 'number' && !isNaN(val) ? val : null;
    }

    if (operand.type === 'VOLUME') {
      if (!bar || bar.volume === undefined || bar.volume === null || isNaN(bar.volume)) return null;
      return bar.volume;
    }

    if (operand.type === 'INDICATOR' || operand.type === 'CALCULATED_VALUE') {
      const ref = operand.reference;
      if (!ref) return null;

      // Match by exact indicatorId or case-insensitive name
      const indicator =
        state.indicators[ref] ||
        Object.values(state.indicators).find(
          ind => ind.indicatorId.toLowerCase() === ref.toLowerCase() || ind.name.toLowerCase() === ref.toLowerCase()
        );

      if (!indicator || indicator.status !== 'VALID') return null;

      return isPrevious ? (indicator.previousValue ?? null) : (indicator.value ?? null);
    }

    return null;
  }

  private static buildExplanation(
    ruleName: string,
    operator: RuleComparisonOperator,
    passed: boolean,
    currentLeft: number,
    currentRight: number,
    previousLeft: number | null,
    previousRight: number | null
  ): string {
    const outcome = passed ? 'PASSED' : 'FAILED';
    if (operator === 'CROSS_ABOVE') {
      return `${ruleName}: ${outcome}. (Current: ${currentLeft} > ${currentRight}, Previous: ${previousLeft} <= ${previousRight})`;
    }
    if (operator === 'CROSS_BELOW') {
      return `${ruleName}: ${outcome}. (Current: ${currentLeft} < ${currentRight}, Previous: ${previousLeft} >= ${previousRight})`;
    }
    return `${ruleName}: ${outcome}. (${currentLeft} ${operator} ${currentRight})`;
  }
}
