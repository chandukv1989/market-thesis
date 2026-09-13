/**
 * Quantitative Data Validator (Phase 11)
 * 
 * Enforces strict mathematical and structural invariants on historical price bars
 * before any indicator calculations or rule evaluations take place.
 * 
 * Invariants:
 * 1. Strict chronological ordering (no backward time jumps)
 * 2. No duplicate timestamps
 * 3. Consistent OHLC bounds (high >= open, high >= close, low <= open, low <= close, high >= low)
 * 4. No impossible non-positive or negative prices (open > 0, high > 0, low > 0, close > 0)
 * 5. Non-negative volume (volume >= 0)
 * 
 * Strict Principle: NEVER silently repair malformed data. Return structured validation results.
 */

import { HistoricalPriceBar, DataValidationResult, DataQualityStatus } from '../../../src/types';

export interface ValidationOptions {
  minBarsRequired?: number;
  requireVolume?: boolean;
}

export class HistoricalDataValidator {
  /**
   * Validate a series of historical price bars
   */
  public static validate(
    bars: HistoricalPriceBar[],
    options: ValidationOptions = {}
  ): DataValidationResult {
    const minBars = options.minBarsRequired ?? 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    let chronological = true;
    let hasDuplicates = false;
    let hasMissingFields = false;
    let hasVolumeIssues = false;

    if (!Array.isArray(bars) || bars.length === 0) {
      return {
        isValid: false,
        quality: 'INSUFFICIENT',
        barCount: 0,
        errors: ['Historical bars array is empty or undefined.'],
        warnings: [],
        chronological: true,
        hasDuplicates: false,
        hasMissingFields: true
      };
    }

    const seenTimestamps = new Set<string>();
    let previousEpoch = -Infinity;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const indexLabel = `Bar[${i}]`;

      // 1. Check required fields
      if (!bar.timestamp) {
        errors.push(`${indexLabel}: Missing required timestamp.`);
        hasMissingFields = true;
      }
      if (typeof bar.open !== 'number' || isNaN(bar.open) ||
          typeof bar.high !== 'number' || isNaN(bar.high) ||
          typeof bar.low !== 'number' || isNaN(bar.low) ||
          typeof bar.close !== 'number' || isNaN(bar.close)) {
        errors.push(`${indexLabel}: Missing or NaN OHLC price field.`);
        hasMissingFields = true;
        continue;
      }

      // 2. Timestamp order & duplicate check
      const currentEpoch = new Date(bar.timestamp).getTime();
      if (isNaN(currentEpoch)) {
        errors.push(`${indexLabel}: Invalid ISO timestamp format "${bar.timestamp}".`);
        hasMissingFields = true;
      } else {
        if (seenTimestamps.has(bar.timestamp)) {
          errors.push(`${indexLabel}: Duplicate timestamp detected "${bar.timestamp}".`);
          hasDuplicates = true;
        }
        seenTimestamps.add(bar.timestamp);

        if (currentEpoch < previousEpoch) {
          errors.push(`${indexLabel}: Out-of-order timestamp. ${bar.timestamp} occurs before previous bar.`);
          chronological = false;
        } else if (currentEpoch === previousEpoch && !hasDuplicates) {
          errors.push(`${indexLabel}: Identical timestamp with preceding bar.`);
          hasDuplicates = true;
        }
        previousEpoch = currentEpoch;
      }

      // 3. Price positivity check (no zero or negative prices)
      if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) {
        errors.push(`${indexLabel}: Impossible non-positive price detected (O: ${bar.open}, H: ${bar.high}, L: ${bar.low}, C: ${bar.close}).`);
      }

      // 4. OHLC geometric relationship checks
      if (bar.high < bar.low) {
        errors.push(`${indexLabel}: Malformed bar geometry: high (${bar.high}) < low (${bar.low}).`);
      }
      if (bar.high < bar.open) {
        errors.push(`${indexLabel}: Malformed bar geometry: high (${bar.high}) < open (${bar.open}).`);
      }
      if (bar.high < bar.close) {
        errors.push(`${indexLabel}: Malformed bar geometry: high (${bar.high}) < close (${bar.close}).`);
      }
      if (bar.low > bar.open) {
        errors.push(`${indexLabel}: Malformed bar geometry: low (${bar.low}) > open (${bar.open}).`);
      }
      if (bar.low > bar.close) {
        errors.push(`${indexLabel}: Malformed bar geometry: low (${bar.low}) > close (${bar.close}).`);
      }

      // 5. Volume check
      if (bar.volume === undefined || bar.volume === null || isNaN(bar.volume)) {
        if (options.requireVolume) {
          errors.push(`${indexLabel}: Missing required volume data.`);
        } else {
          warnings.push(`${indexLabel}: Volume is undefined or NaN.`);
        }
        hasVolumeIssues = true;
      } else if (bar.volume < 0) {
        errors.push(`${indexLabel}: Impossible negative volume (${bar.volume}).`);
        hasVolumeIssues = true;
      }
    }

    // Determine quality status
    let quality: DataQualityStatus = 'COMPLETE';
    if (errors.length > 0) {
      quality = 'INVALID';
    } else if (bars.length < minBars) {
      quality = 'INSUFFICIENT';
      warnings.push(`Bar count (${bars.length}) is below required minimum of ${minBars}.`);
    } else if (hasVolumeIssues) {
      quality = 'PARTIAL';
    }

    const isValid = errors.length === 0 && quality !== 'INSUFFICIENT';

    return {
      isValid,
      quality,
      barCount: bars.length,
      errors,
      warnings,
      chronological,
      hasDuplicates,
      hasMissingFields,
      startRange: bars[0]?.timestamp,
      endRange: bars[bars.length - 1]?.timestamp
    };
  }
}
