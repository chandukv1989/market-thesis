/**
 * Phase 12A - Historical Market Data Validator
 * 
 * Strict pre-simulation data hygiene:
 * - Chronological ordering
 * - Duplicate timestamp detection
 * - Positive price enforcement
 * - High/Low/Open/Close mathematical integrity
 * - Volume validity
 * - Minimum sample requirements
 * 
 * STRICT INVARIANT: Never silently repair or synthesize candles.
 * Returns structured quality assessments.
 */

import { HistoricalPriceBar, DataQualityStatus } from '../../../src/types';
import { HistoricalDataValidationResult, DataValidationIssue } from './backtestTypes';

export class HistoricalDataValidator {
  /**
   * Validate raw historical price bars before backtest execution.
   */
  public static validate(
    bars: HistoricalPriceBar[],
    minRequiredBars: number = 20,
    expectedCorporateActionStatus?: 'ADJUSTED' | 'UNADJUSTED'
  ): HistoricalDataValidationResult {
    const issues: DataValidationIssue[] = [];

    if (!bars || bars.length === 0) {
      return {
        isValid: false,
        quality: 'INVALID',
        totalBars: 0,
        issues: [{
          type: 'INSUFFICIENT_HISTORY',
          message: 'Historical bar series is completely empty (0 bars received).'
        }],
        corporateActionsStatus: 'UNKNOWN'
      };
    }

    if (bars.length < minRequiredBars) {
      issues.push({
        type: 'INSUFFICIENT_HISTORY',
        message: `Historical series contains ${bars.length} bars, which is fewer than the minimum required ${minRequiredBars} bars for strategy warm-up and evaluation.`,
        details: { totalBars: bars.length, minRequired: minRequiredBars }
      });
    }

    let isAdjustedDetected = false;
    let isUnadjustedDetected = false;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const ts = bar.timestamp;

      // 1. Positive price checks
      if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) {
        issues.push({
          type: 'NEGATIVE_PRICE',
          message: `Non-positive price encountered at bar index ${i} (${ts}): O=${bar.open}, H=${bar.high}, L=${bar.low}, C=${bar.close}`,
          timestamp: ts,
          details: { index: i, open: bar.open, high: bar.high, low: bar.low, close: bar.close }
        });
      }

      // 2. OHLC consistency
      // High must be >= max(open, close), Low must be <= min(open, close)
      // Allow minor floating point tolerance (1e-6)
      const maxOC = Math.max(bar.open, bar.close);
      const minOC = Math.min(bar.open, bar.close);

      if (bar.high + 1e-6 < maxOC || bar.low - 1e-6 > minOC || bar.high + 1e-6 < bar.low) {
        issues.push({
          type: 'INVALID_OHLC',
          message: `Inconsistent OHLC bounds at bar index ${i} (${ts}): High (${bar.high}) must be >= max(Open, Close) (${maxOC}) and Low (${bar.low}) must be <= min(Open, Close) (${minOC})`,
          timestamp: ts,
          details: { index: i, open: bar.open, high: bar.high, low: bar.low, close: bar.close }
        });
      }

      // 3. Volume sanity
      if (typeof bar.volume === 'number' && bar.volume < 0) {
        issues.push({
          type: 'NEGATIVE_VOLUME',
          message: `Negative volume encountered at bar index ${i} (${ts}): Volume=${bar.volume}`,
          timestamp: ts,
          details: { index: i, volume: bar.volume }
        });
      }

      // 4. Chronological order & duplicates
      if (i > 0) {
        const prevBar = bars[i - 1];
        const prevTime = new Date(prevBar.timestamp).getTime();
        const currTime = new Date(bar.timestamp).getTime();

        if (currTime === prevTime || bar.timestamp === prevBar.timestamp) {
          issues.push({
            type: 'DUPLICATE_TIMESTAMP',
            message: `Duplicate timestamp encountered between bar ${i - 1} and bar ${i}: ${ts}`,
            timestamp: ts,
            details: { previousIndex: i - 1, currentIndex: i, timestamp: ts }
          });
        } else if (currTime < prevTime) {
          issues.push({
            type: 'OUT_OF_ORDER',
            message: `Chronological ordering violation at bar index ${i}: ${bar.timestamp} is before preceding bar ${prevBar.timestamp}`,
            timestamp: ts,
            details: { previousTimestamp: prevBar.timestamp, currentTimestamp: ts }
          });
        }
      }

      // Corporate actions tracking
      if (bar.corporateActionsAdjusted === true) {
        isAdjustedDetected = true;
      } else if (bar.corporateActionsAdjusted === false) {
        isUnadjustedDetected = true;
      }
    }

    let corporateActionsStatus: 'ADJUSTED' | 'UNADJUSTED' | 'UNKNOWN' = 'UNKNOWN';
    if (expectedCorporateActionStatus) {
      corporateActionsStatus = expectedCorporateActionStatus;
    } else if (isAdjustedDetected && !isUnadjustedDetected) {
      corporateActionsStatus = 'ADJUSTED';
    } else if (isUnadjustedDetected && !isAdjustedDetected) {
      corporateActionsStatus = 'UNADJUSTED';
    }

    const fatalIssueTypes = new Set(['OUT_OF_ORDER', 'DUPLICATE_TIMESTAMP', 'NEGATIVE_PRICE', 'INVALID_OHLC', 'NEGATIVE_VOLUME']);
    const hasFatalIssues = issues.some(iss => fatalIssueTypes.has(iss.type));
    const hasInsufficientHistory = issues.some(iss => iss.type === 'INSUFFICIENT_HISTORY');

    let quality: DataQualityStatus = 'COMPLETE';
    if (hasFatalIssues) {
      quality = 'INVALID';
    } else if (hasInsufficientHistory) {
      quality = 'INSUFFICIENT';
    } else if (issues.length > 0) {
      quality = 'PARTIAL';
    }

    return {
      isValid: !hasFatalIssues && !hasInsufficientHistory,
      quality,
      totalBars: bars.length,
      startDate: bars[0]?.timestamp,
      endDate: bars[bars.length - 1]?.timestamp,
      issues,
      corporateActionsStatus
    };
  }
}
