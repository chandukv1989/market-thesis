/**
 * Deterministic Alert Evaluator (Phase 10)
 * 
 * Evaluates AlertRules strictly through deterministic logic against verified market data,
 * portfolio metrics, and evidence items.
 * 
 * Strict Architectural Invariants:
 * 1. Gemini NEVER determines whether an alert fires.
 * 2. Crossing semantics require valid previous observations (prev < T && curr >= T).
 * 3. Epistemic status is faithfully propagated:
 *    - REAL provider quote -> REAL alert
 *    - SIMULATED quote -> SIMULATED alert
 *    - Portfolio metrics -> CALCULATED alert
 *    - Missing/errored data -> UNAVAILABLE alert (never fires a REAL alert)
 * 4. Stale data is detected and flagged.
 */

import {
  AlertRule,
  AlertEvaluation,
  NormalizedQuote,
  PortfolioMetrics,
  EvidenceItem,
  Holding
} from '../../../src/types';

export interface AlertEvaluationContext {
  rule: AlertRule;
  quote?: NormalizedQuote | null;
  historicalStats?: {
    avgVolume?: number;
    high52Week?: number;
    low52Week?: number;
    dayHigh?: number;
    dayLow?: number;
  } | null;
  portfolioMetrics?: PortfolioMetrics | null;
  portfolioHoldings?: Holding[] | null;
  evidenceItems?: EvidenceItem[] | null;
  previousObservation?: {
    observedValue: number | string | null;
    observedAt?: string;
  } | null;
  asOfDate?: string;
  maxStaleHours?: number; // default 24 hours
}

/**
 * Utility to parse volume from string or number representations (e.g. "45.2M", "1.2B", "500K", 123456)
 */
export function parseVolume(volume: unknown): number | null {
  if (volume === null || volume === undefined) return null;
  if (typeof volume === 'number') return isNaN(volume) ? null : volume;
  if (typeof volume === 'string') {
    const clean = volume.trim().toUpperCase().replace(/,/g, '');
    if (!clean) return null;
    if (clean.endsWith('B')) {
      const num = parseFloat(clean.slice(0, -1));
      return isNaN(num) ? null : num * 1_000_000_000;
    }
    if (clean.endsWith('M')) {
      const num = parseFloat(clean.slice(0, -1));
      return isNaN(num) ? null : num * 1_000_000;
    }
    if (clean.endsWith('K')) {
      const num = parseFloat(clean.slice(0, -1));
      return isNaN(num) ? null : num * 1_000;
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Checks if a timestamp is older than maxStaleHours
 */
export function isDataStale(timestampStr?: string | null, maxStaleHours = 24): boolean {
  if (!timestampStr) return false;
  const time = new Date(timestampStr).getTime();
  if (isNaN(time)) return false;
  const now = Date.now();
  return (now - time) > maxStaleHours * 3600 * 1000;
}

export class AlertEvaluator {
  /**
   * Evaluates an AlertRule against the provided context.
   */
  public evaluate(context: AlertEvaluationContext): AlertEvaluation {
    const {
      rule,
      quote,
      historicalStats,
      portfolioMetrics,
      portfolioHoldings,
      evidenceItems,
      previousObservation,
      asOfDate,
      maxStaleHours = 24
    } = context;

    const evaluatedAt = asOfDate || new Date().toISOString();
    const thresholdNum = typeof rule.threshold === 'number' ? rule.threshold : parseFloat(String(rule.threshold));

    // Default UNAVAILABLE template for missing requirements
    const createUnavailable = (reason: string): AlertEvaluation => ({
      triggered: false,
      alertRuleId: rule.alertRuleId,
      securityId: rule.securityId,
      portfolioId: rule.portfolioId,
      symbol: rule.symbol || quote?.symbol,
      observedValue: null,
      threshold: rule.threshold,
      comparison: rule.comparison,
      evaluatedAt,
      epistemicStatus: 'UNAVAILABLE',
      isSimulated: false,
      provider: quote?.provider || 'SYSTEM',
      market: quote?.market,
      exchange: quote?.exchange,
      currency: quote?.currency,
      reason,
      provenance: {
        retrievedAt: evaluatedAt,
        asOf: asOfDate,
        sourceReference: quote?.securityId || rule.securityId || rule.portfolioId
      }
    });

    if (!rule.enabled) {
      return {
        triggered: false,
        alertRuleId: rule.alertRuleId,
        securityId: rule.securityId,
        portfolioId: rule.portfolioId,
        symbol: rule.symbol,
        observedValue: null,
        threshold: rule.threshold,
        comparison: rule.comparison,
        evaluatedAt,
        epistemicStatus: 'CALCULATED',
        isSimulated: false,
        provider: 'SYSTEM',
        reason: 'Rule is disabled',
        provenance: { retrievedAt: evaluatedAt }
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 1: PRICE & MARKET ALERTS
    // -------------------------------------------------------------
    const priceAlertTypes = [
      'PRICE_ABOVE',
      'PRICE_BELOW',
      'PRICE_CROSSES_ABOVE',
      'PRICE_CROSSES_BELOW',
      'DAILY_CHANGE_ABOVE',
      'DAILY_CHANGE_BELOW',
      'DAILY_CHANGE_ABSOLUTE_ABOVE',
      'VOLUME_ABOVE',
      'VOLUME_MULTIPLE_OF_AVERAGE',
      'DAILY_HIGH',
      'DAILY_LOW'
    ];

    if (priceAlertTypes.includes(rule.alertType)) {
      if (!quote || quote.status === 'unavailable' || quote.price === undefined || quote.price === null || isNaN(quote.price)) {
        return createUnavailable(`Market quote for ${rule.symbol || rule.securityId} is unavailable`);
      }

      // Check staleness based on retrieval time (or asOf if retrievedAt is not present)
      const quoteTime = quote.retrievedAt || quote.asOf;
      const isStale = isDataStale(quoteTime, maxStaleHours);

      if (isStale) {
        return {
          alertRuleId: rule.alertRuleId,
          securityId: rule.securityId || quote.securityId,
          symbol: quote.symbol || rule.symbol,
          threshold: rule.threshold,
          comparison: rule.comparison,
          evaluatedAt,
          epistemicStatus: 'STALE',
          isSimulated: quote.isSimulated,
          provider: quote.provider,
          market: quote.market,
          exchange: quote.exchange,
          currency: quote.currency,
          triggered: false,
          observedValue: quote.price,
          reason: `Market quote for ${quote.symbol} is stale (as of ${quoteTime}, exceeds staleness limit of ${maxStaleHours}h)`,
          provenance: {
            retrievedAt: quote.retrievedAt || evaluatedAt,
            asOf: quote.asOf,
            sourceReference: quote.securityId,
            quoteTimestamp: quote.asOf
          }
        };
      }

      // Faithful epistemic status propagation
      const epistemicStatus = (quote.epistemicStatus === 'REAL' && !quote.isSimulated)
        ? 'REAL'
        : quote.isSimulated
          ? 'SIMULATED'
          : (quote.epistemicStatus || 'SIMULATED');

      const isSimulated = quote.isSimulated || epistemicStatus === 'SIMULATED';

      const baseResult = {
        alertRuleId: rule.alertRuleId,
        securityId: rule.securityId || quote.securityId,
        symbol: quote.symbol || rule.symbol,
        threshold: rule.threshold,
        comparison: rule.comparison,
        evaluatedAt,
        epistemicStatus,
        isSimulated,
        provider: quote.provider,
        market: quote.market,
        exchange: quote.exchange,
        currency: quote.currency,
        provenance: {
          retrievedAt: quote.retrievedAt || evaluatedAt,
          asOf: quote.asOf,
          sourceReference: quote.securityId,
          quoteTimestamp: quote.asOf
        }
      };

      const currentPrice = quote.price;

      switch (rule.alertType) {
        case 'PRICE_ABOVE': {
          const triggered = currentPrice > thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: currentPrice,
            reason: triggered
              ? `${quote.symbol} price ${currentPrice} ${quote.currency} is above threshold ${thresholdNum} ${quote.currency}`
              : `${quote.symbol} price ${currentPrice} did not exceed threshold ${thresholdNum}`
          };
        }

        case 'PRICE_BELOW': {
          const triggered = currentPrice < thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: currentPrice,
            reason: triggered
              ? `${quote.symbol} price ${currentPrice} ${quote.currency} is below threshold ${thresholdNum} ${quote.currency}`
              : `${quote.symbol} price ${currentPrice} is not below threshold ${thresholdNum}`
          };
        }

        case 'PRICE_CROSSES_ABOVE': {
          if (!previousObservation || previousObservation.observedValue === null || previousObservation.observedValue === undefined) {
            return {
              ...baseResult,
              triggered: false,
              observedValue: currentPrice,
              reason: `Previous observation required to determine crossing above ${thresholdNum}`
            };
          }
          const prevPrice = typeof previousObservation.observedValue === 'number'
            ? previousObservation.observedValue
            : parseFloat(String(previousObservation.observedValue));

          if (isNaN(prevPrice)) {
            return {
              ...baseResult,
              triggered: false,
              observedValue: currentPrice,
              reason: `Invalid previous observation value: ${previousObservation.observedValue}`
            };
          }

          const triggered = prevPrice < thresholdNum && currentPrice >= thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: currentPrice,
            reason: triggered
              ? `${quote.symbol} crossed above ${thresholdNum} (prev: ${prevPrice}, current: ${currentPrice})`
              : `${quote.symbol} did not cross above ${thresholdNum} (prev: ${prevPrice}, current: ${currentPrice})`
          };
        }

        case 'PRICE_CROSSES_BELOW': {
          if (!previousObservation || previousObservation.observedValue === null || previousObservation.observedValue === undefined) {
            return {
              ...baseResult,
              triggered: false,
              observedValue: currentPrice,
              reason: `Previous observation required to determine crossing below ${thresholdNum}`
            };
          }
          const prevPrice = typeof previousObservation.observedValue === 'number'
            ? previousObservation.observedValue
            : parseFloat(String(previousObservation.observedValue));

          if (isNaN(prevPrice)) {
            return {
              ...baseResult,
              triggered: false,
              observedValue: currentPrice,
              reason: `Invalid previous observation value: ${previousObservation.observedValue}`
            };
          }

          const triggered = prevPrice > thresholdNum && currentPrice <= thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: currentPrice,
            reason: triggered
              ? `${quote.symbol} crossed below ${thresholdNum} (prev: ${prevPrice}, current: ${currentPrice})`
              : `${quote.symbol} did not cross below ${thresholdNum} (prev: ${prevPrice}, current: ${currentPrice})`
          };
        }

        case 'DAILY_CHANGE_ABOVE': {
          const changePct = quote.changePercent;
          const triggered = changePct > thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: changePct,
            reason: triggered
              ? `${quote.symbol} daily gain ${changePct > 0 ? '+' : ''}${changePct}% is above threshold ${thresholdNum}%`
              : `${quote.symbol} daily gain ${changePct}% is not above threshold ${thresholdNum}%`
          };
        }

        case 'DAILY_CHANGE_BELOW': {
          const changePct = quote.changePercent;
          const triggered = changePct < thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: changePct,
            reason: triggered
              ? `${quote.symbol} daily move ${changePct}% is below threshold ${thresholdNum}%`
              : `${quote.symbol} daily move ${changePct}% is not below threshold ${thresholdNum}%`
          };
        }

        case 'DAILY_CHANGE_ABSOLUTE_ABOVE': {
          const absChange = Math.abs(quote.changePercent);
          const triggered = absChange > thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: absChange,
            reason: triggered
              ? `${quote.symbol} absolute daily move |${quote.changePercent}%| = ${absChange.toFixed(2)}% exceeds threshold ${thresholdNum}%`
              : `${quote.symbol} absolute daily move ${absChange.toFixed(2)}% does not exceed threshold ${thresholdNum}%`
          };
        }

        case 'VOLUME_ABOVE': {
          const rawVol = quote.volume !== undefined && quote.volume !== null ? quote.volume : (quote as any).dayVolume;
          const vol = parseVolume(rawVol);
          if (vol === null || vol <= 0) {
            return createUnavailable(`Volume data unavailable for ${quote.symbol}`);
          }
          const triggered = vol > thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: vol,
            reason: triggered
              ? `${quote.symbol} volume ${vol.toLocaleString()} exceeds threshold ${thresholdNum.toLocaleString()}`
              : `${quote.symbol} volume ${vol.toLocaleString()} did not exceed threshold ${thresholdNum.toLocaleString()}`
          };
        }

        case 'VOLUME_MULTIPLE_OF_AVERAGE': {
          const rawVol = quote.volume !== undefined && quote.volume !== null ? quote.volume : (quote as any).dayVolume;
          const vol = parseVolume(rawVol);
          const avgVol = historicalStats?.avgVolume || (rule.metadata?.averageVolume as number | undefined) || (rule.metadata?.avgVolume as number | undefined);
          if (vol === null || vol <= 0 || !avgVol || avgVol <= 0) {
            return createUnavailable(`Average volume baseline unavailable for ${quote.symbol} - cannot fabricate comparison`);
          }
          const multiple = vol / avgVol;
          const triggered = multiple >= thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: Math.round(multiple * 100) / 100,
            reason: triggered
              ? `${quote.symbol} volume ${vol.toLocaleString()} is ${multiple.toFixed(2)}x of average volume ${avgVol.toLocaleString()} (threshold: ${thresholdNum}x)`
              : `${quote.symbol} volume is ${multiple.toFixed(2)}x of average volume (threshold: ${thresholdNum}x)`
          };
        }

        case 'DAILY_HIGH': {
          const high = historicalStats?.dayHigh || (rule.metadata?.dayHigh as number | undefined);
          const val = high !== undefined ? high : currentPrice;
          const triggered = val >= thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: val,
            reason: triggered
              ? `${quote.symbol} reached high of ${val} meeting threshold ${thresholdNum}`
              : `${quote.symbol} high ${val} did not reach threshold ${thresholdNum}`
          };
        }

        case 'DAILY_LOW': {
          const low = historicalStats?.dayLow || (rule.metadata?.dayLow as number | undefined);
          const val = low !== undefined ? low : currentPrice;
          const triggered = val <= thresholdNum;
          return {
            ...baseResult,
            triggered,
            observedValue: val,
            reason: triggered
              ? `${quote.symbol} dropped to low of ${val} meeting threshold ${thresholdNum}`
              : `${quote.symbol} low ${val} is not at or below threshold ${thresholdNum}`
          };
        }
      }
    }

    // -------------------------------------------------------------
    // CATEGORY 2: PORTFOLIO & CONCENTRATION ALERTS (PHASE 9)
    // -------------------------------------------------------------
    const portfolioAlertTypes = [
      'PORTFOLIO_DAILY_LOSS_ABOVE',
      'PORTFOLIO_DRAWDOWN_ABOVE',
      'POSITION_WEIGHT_ABOVE',
      'SECTOR_WEIGHT_ABOVE',
      'RISK_CONTRIBUTION_ABOVE'
    ];

    if (portfolioAlertTypes.includes(rule.alertType)) {
      if (!portfolioMetrics) {
        return createUnavailable('Portfolio metrics unavailable from Phase 9 portfolio calculation engine');
      }

      const anyMetrics = portfolioMetrics as any;

      // Portfolio calculations are ALWAYS CALCULATED and never simulated
      const basePortfolioResult = {
        alertRuleId: rule.alertRuleId,
        portfolioId: rule.portfolioId || 'primary-portfolio',
        threshold: rule.threshold,
        comparison: rule.comparison,
        evaluatedAt,
        epistemicStatus: 'CALCULATED' as const,
        isSimulated: false,
        provider: 'PORTFOLIO_ENGINE',
        currency: anyMetrics.baseCurrency || anyMetrics.currency || 'USD',
        provenance: {
          retrievedAt: evaluatedAt,
          asOf: asOfDate,
          sourceReference: 'PORTFOLIO_ENGINE_PHASE_9'
        }
      };

      switch (rule.alertType) {
        case 'PORTFOLIO_DAILY_LOSS_ABOVE': {
          // If return is negative, loss percentage is positive
          const dailyReturn = anyMetrics.performance?.dailyReturnPct?.value !== undefined
            ? anyMetrics.performance.dailyReturnPct.value
            : (anyMetrics.dailyReturnPercent !== undefined ? anyMetrics.dailyReturnPercent : (anyMetrics.dailyReturnPct !== undefined ? anyMetrics.dailyReturnPct : 0));
          const dailyLoss = dailyReturn < 0 ? Math.abs(dailyReturn) : 0;
          const triggered = dailyLoss >= thresholdNum;
          return {
            ...basePortfolioResult,
            triggered,
            observedValue: Math.round(dailyLoss * 100) / 100,
            reason: triggered
              ? `Portfolio daily loss of ${dailyLoss.toFixed(2)}% exceeds limit of ${thresholdNum}%`
              : `Portfolio daily loss is ${dailyLoss.toFixed(2)}% (within ${thresholdNum}% threshold)`
          };
        }

        case 'PORTFOLIO_DRAWDOWN_ABOVE': {
          const drawdown = anyMetrics.risk?.maxDrawdownPct !== undefined
            ? Math.abs(anyMetrics.risk.maxDrawdownPct)
            : (anyMetrics.currentDrawdown !== undefined ? Math.abs(anyMetrics.currentDrawdown) : (anyMetrics.drawdown !== undefined ? Math.abs(anyMetrics.drawdown) : 0));
          const triggered = drawdown >= thresholdNum;
          return {
            ...basePortfolioResult,
            triggered,
            observedValue: Math.round(drawdown * 100) / 100,
            reason: triggered
              ? `Portfolio maximum drawdown of ${drawdown.toFixed(2)}% exceeds threshold of ${thresholdNum}%`
              : `Portfolio drawdown of ${drawdown.toFixed(2)}% is within ${thresholdNum}% threshold`
          };
        }

        case 'POSITION_WEIGHT_ABOVE': {
          const targetSec = (rule.symbol || rule.securityId || '').toUpperCase();
          let weightPct: number | null = null;

          if (anyMetrics.holdingWeights && anyMetrics.holdingWeights[targetSec] !== undefined) {
            weightPct = anyMetrics.holdingWeights[targetSec];
          } else if (anyMetrics.topHoldings && Array.isArray(anyMetrics.topHoldings)) {
            const targetHolding = anyMetrics.topHoldings.find(
              (h: any) => (h.symbol || h.ticker || '').toUpperCase() === targetSec
            );
            if (targetHolding) {
              weightPct = targetHolding.weightPct;
            }
          } else if (portfolioHoldings) {
            const h = portfolioHoldings.find(
              (h: any) => (h.ticker || h.symbol || h.securityId || '').toUpperCase() === targetSec
            );
            if (h) {
              weightPct = h.weightPct || 0;
            }
          }

          if (weightPct === null) {
            return createUnavailable(`Holding ${targetSec} not found in portfolio positions`);
          }

          const triggered = weightPct >= thresholdNum;
          return {
            ...basePortfolioResult,
            securityId: rule.securityId,
            symbol: targetSec,
            triggered,
            observedValue: Math.round(weightPct * 100) / 100,
            reason: triggered
              ? `Position ${targetSec} weight ${weightPct.toFixed(2)}% exceeds allocation limit ${thresholdNum}%`
              : `Position ${targetSec} weight ${weightPct.toFixed(2)}% is within allocation limit ${thresholdNum}%`
          };
        }

        case 'SECTOR_WEIGHT_ABOVE': {
          const targetSector = String(rule.metadata?.sector || rule.symbol || '').trim();
          if (!targetSector) {
            return createUnavailable('Sector name must be specified in metadata or symbol for sector weight rule');
          }

          let sectorWeight: number | null = null;
          if (anyMetrics.sectorWeights && anyMetrics.sectorWeights[targetSector] !== undefined) {
            sectorWeight = anyMetrics.sectorWeights[targetSector];
          } else if (anyMetrics.sectorExposure && Array.isArray(anyMetrics.sectorExposure)) {
            const item = anyMetrics.sectorExposure.find((s: any) => s.sector.toLowerCase() === targetSector.toLowerCase());
            if (item) sectorWeight = item.weightPct;
          } else if (anyMetrics.exposures?.sectors && anyMetrics.exposures.sectors[targetSector] !== undefined) {
            sectorWeight = anyMetrics.exposures.sectors[targetSector];
          }

          if (sectorWeight === null) {
            sectorWeight = 0;
          }

          const triggered = sectorWeight >= thresholdNum;
          return {
            ...basePortfolioResult,
            triggered,
            observedValue: Math.round(sectorWeight * 100) / 100,
            reason: triggered
              ? `Sector ${targetSector} exposure of ${sectorWeight.toFixed(2)}% exceeds allocation ceiling of ${thresholdNum}%`
              : `Sector ${targetSector} exposure of ${sectorWeight.toFixed(2)}% is within limit ${thresholdNum}%`
          };
        }

        case 'RISK_CONTRIBUTION_ABOVE': {
          const targetSec = (rule.symbol || rule.securityId || '').toUpperCase();
          let riskPct: number | null = null;

          if (anyMetrics.riskContributions && anyMetrics.riskContributions[targetSec] !== undefined) {
            riskPct = anyMetrics.riskContributions[targetSec];
          } else if (anyMetrics.risk?.topRiskContributors && Array.isArray(anyMetrics.risk.topRiskContributors)) {
            const contributor = anyMetrics.risk.topRiskContributors.find(
              (c: any) => c.symbol.toUpperCase() === targetSec
            );
            if (contributor) riskPct = contributor.riskPct;
          }

          if (riskPct === null) {
            return createUnavailable(`Risk contributor ${targetSec} not identified in portfolio risk model`);
          }

          const triggered = riskPct >= thresholdNum;
          return {
            ...basePortfolioResult,
            securityId: rule.securityId,
            symbol: targetSec,
            triggered,
            observedValue: Math.round(riskPct * 100) / 100,
            reason: triggered
              ? `Position ${targetSec} risk contribution of ${riskPct.toFixed(2)}% exceeds risk limit of ${thresholdNum}%`
              : `Position ${targetSec} risk contribution of ${riskPct.toFixed(2)}% is within limit ${thresholdNum}%`
          };
        }
      }
    }

    // -------------------------------------------------------------
    // CATEGORY 3: RESEARCH & DISCLOSURE ALERTS (PHASE 8 & SEC)
    // -------------------------------------------------------------
    if (rule.alertType === 'NEW_SEC_FILING') {
      const secFilings = evidenceItems?.filter(
        ev => ev.sourceType === 'SEC_EDGAR' && (!rule.securityId || ev.securityId === rule.securityId)
      ) || [];

      if (secFilings.length === 0) {
        return {
          triggered: false,
          alertRuleId: rule.alertRuleId,
          securityId: rule.securityId,
          symbol: rule.symbol,
          observedValue: 0,
          threshold: rule.threshold,
          comparison: rule.comparison,
          evaluatedAt,
          epistemicStatus: 'REAL',
          isSimulated: false,
          provider: 'SEC_EDGAR',
          reason: 'No new SEC filings detected',
          provenance: { retrievedAt: evaluatedAt, sourceReference: 'SEC_EDGAR' }
        };
      }

      const latestFiling = secFilings[0];
      const triggered = true;
      return {
        triggered,
        alertRuleId: rule.alertRuleId,
        securityId: rule.securityId,
        symbol: rule.symbol,
        observedValue: latestFiling.title || latestFiling.evidenceId,
        threshold: rule.threshold,
        comparison: rule.comparison,
        evaluatedAt,
        epistemicStatus: 'REAL',
        isSimulated: false,
        provider: 'SEC_EDGAR',
        reason: `Verified SEC filing published: ${latestFiling.title || latestFiling.evidenceId}`,
        provenance: {
          retrievedAt: latestFiling.retrievedAt || evaluatedAt,
          sourceReference: latestFiling.sourceReference?.accessionNumber || latestFiling.evidenceId,
          asOf: latestFiling.filingDate
        }
      };
    }

    if (rule.alertType === 'EVIDENCE_CONFLICT') {
      const conflicts = rule.metadata?.conflicts as unknown[] | undefined;
      const hasConflicts = Array.isArray(conflicts) && conflicts.length > 0;
      return {
        triggered: hasConflicts,
        alertRuleId: rule.alertRuleId,
        securityId: rule.securityId,
        symbol: rule.symbol,
        observedValue: hasConflicts ? conflicts.length : 0,
        threshold: rule.threshold,
        comparison: rule.comparison,
        evaluatedAt,
        epistemicStatus: 'REAL',
        isSimulated: false,
        provider: 'EVIDENCE_REPOSITORY',
        reason: hasConflicts
          ? `Detected ${conflicts.length} grounded evidence conflicts for ${rule.symbol || rule.securityId}`
          : 'No evidence conflicts detected',
        provenance: { retrievedAt: evaluatedAt, sourceReference: 'EVIDENCE_REPOSITORY' }
      };
    }

    return createUnavailable(`Unsupported alert rule type: ${rule.alertType}`);
  }
}

export const alertEvaluator = new AlertEvaluator();
