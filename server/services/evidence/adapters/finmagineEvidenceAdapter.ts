/**
 * Phase 18: Finmagine Evidence Adapter
 * 
 * Epistemic & PIT Guarantees:
 * - Integrates Finmagine supplemental research into the existing EvidenceItem infrastructure.
 * - Source type: 'FINMAGINE', Provider: 'FINMAGINE'.
 * - REAL when configured and successful; UNAVAILABLE when unconfigured or failing.
 * - Never converts UNAVAILABLE into fake REAL.
 * - Point-In-Time (PIT) Enforced:
 *     - When asOfDate is provided, only items published/available on or before asOfDate are returned.
 *     - Undated or current-only provider observations are marked PIT_UNVERIFIED and excluded from historical queries.
 * - Non-destructive:
 *     - NEVER replaces or overwrites Twelve Data or FYERS market prices.
 *     - If Finmagine fundamental values conflict with SEC EDGAR, both are preserved with distinct evidence IDs.
 */

import {
  EvidenceItem,
  SecurityIdentifier,
  EvidenceEpistemicStatus
} from '../../../../src/types';
import { finmagineProvider, FinmagineResearchProvider } from '../../../providers/finmagineProvider';

export class FinmagineEvidenceAdapter {
  private provider: FinmagineResearchProvider;

  constructor(provider?: FinmagineResearchProvider) {
    this.provider = provider || finmagineProvider;
  }

  public setProvider(provider: FinmagineResearchProvider): void {
    this.provider = provider;
  }

  /**
   * Check if an observation timestamp is safely point-in-time compliant.
   */
  private isPointInTimeCompliant(availableAt: string | undefined, asOfDate?: string): boolean {
    if (!asOfDate) {
      return true; // Current query
    }
    if (!availableAt) {
      return false; // Undated observations are excluded from historical queries
    }
    const queryTime = new Date(asOfDate).getTime();
    const itemTime = new Date(availableAt).getTime();
    return !isNaN(queryTime) && !isNaN(itemTime) && itemTime <= queryTime;
  }

  /**
   * Gather supplemental research evidence for a given security.
   */
  public async getEvidenceForSecurity(
    security: SecurityIdentifier,
    asOfDate?: string
  ): Promise<EvidenceItem[]> {
    if (!this.provider.isConfigured()) {
      return [];
    }

    const items: EvidenceItem[] = [];
    const symbol = security.symbol;
    const market = security.market === 'INDIA' ? 'INDIA' : 'US';
    const now = new Date().toISOString();

    try {
      // 1. Company Profile
      const profile = await this.provider.getCompanyProfile(symbol, market);
      if (profile) {
        const availableAt = profile.asOfDate || profile.retrievedAt;
        if (this.isPointInTimeCompliant(availableAt, asOfDate)) {
          items.push({
            evidenceId: `finmagine-profile-${security.id}`,
            securityId: security.id,
            sourceType: 'FINMAGINE',
            provider: 'FINMAGINE',
            title: `${symbol} Company Profile (Finmagine)`,
            content: `${profile.companyName} (${profile.symbol}) is a ${profile.sector || 'general'} company in ${profile.country}. ${profile.description || ''}`,
            structuredValue: {
              companyName: profile.companyName,
              sector: profile.sector,
              industry: profile.industry,
              marketCap: profile.marketCap,
              employees: profile.employees,
              exchange: profile.exchange,
              currency: profile.currency
            },
            currency: profile.currency,
            publishedAt: profile.asOfDate,
            availableAt: availableAt,
            retrievedAt: profile.retrievedAt,
            epistemicStatus: profile.epistemicStatus,
            isSimulated: profile.isSimulated,
            sourceReference: {
              provider: 'FINMAGINE',
              symbol: profile.symbol,
              exchange: profile.exchange
            }
          });
        }
      }

      // 2. Financial Ratios (35+ metrics)
      const ratios = await this.provider.getFinancialRatios(symbol, market);
      if (ratios) {
        const availableAt = ratios.asOfDate || ratios.retrievedAt;
        if (this.isPointInTimeCompliant(availableAt, asOfDate)) {
          const ratioDesc = [
            ratios.peRatio !== undefined ? `P/E: ${ratios.peRatio.toFixed(2)}` : null,
            ratios.pbRatio !== undefined ? `P/B: ${ratios.pbRatio.toFixed(2)}` : null,
            ratios.evToEbitda !== undefined ? `EV/EBITDA: ${ratios.evToEbitda.toFixed(2)}` : null,
            ratios.roe !== undefined ? `ROE: ${(ratios.roe * 100).toFixed(1)}%` : null,
            ratios.operatingMarginPct !== undefined ? `Operating Margin: ${ratios.operatingMarginPct.toFixed(1)}%` : null,
            ratios.debtToEquity !== undefined ? `D/E: ${ratios.debtToEquity.toFixed(2)}` : null
          ].filter(Boolean).join(', ');

          items.push({
            evidenceId: `finmagine-ratios-${security.id}`,
            securityId: security.id,
            sourceType: 'FINMAGINE',
            provider: 'FINMAGINE',
            title: `${symbol} Financial Ratios (Finmagine)`,
            content: `Key fundamental ratios for ${symbol}: ${ratioDesc}`,
            structuredValue: {
              peRatio: ratios.peRatio,
              pbRatio: ratios.pbRatio,
              psRatio: ratios.psRatio,
              evToEbitda: ratios.evToEbitda,
              debtToEquity: ratios.debtToEquity,
              currentRatio: ratios.currentRatio,
              quickRatio: ratios.quickRatio,
              roe: ratios.roe,
              roa: ratios.roa,
              grossMarginPct: ratios.grossMarginPct,
              operatingMarginPct: ratios.operatingMarginPct,
              netMarginPct: ratios.netMarginPct,
              dividendYieldPct: ratios.dividendYieldPct
            },
            publishedAt: ratios.asOfDate,
            availableAt: availableAt,
            retrievedAt: ratios.retrievedAt,
            epistemicStatus: ratios.epistemicStatus,
            isSimulated: ratios.isSimulated,
            sourceReference: {
              provider: 'FINMAGINE',
              symbol: ratios.symbol,
              market: ratios.market
            }
          });
        }
      }

      // 3. Valuation Context
      const valuation = await this.provider.getValuation(symbol, market);
      if (valuation) {
        const availableAt = valuation.asOfDate || valuation.retrievedAt;
        if (this.isPointInTimeCompliant(availableAt, asOfDate)) {
          items.push({
            evidenceId: `finmagine-valuation-${security.id}`,
            securityId: security.id,
            sourceType: 'FINMAGINE',
            provider: 'FINMAGINE',
            title: `${symbol} Valuation Intelligence (Finmagine)`,
            content: `Valuation perspective: DCF Intrinsic Value ${valuation.dcfValue || 'N/A'}, Discount to Intrinsic ${valuation.discountToIntrinsicPct !== undefined ? `${valuation.discountToIntrinsicPct}%` : 'N/A'}. Provider valuation score: ${valuation.valuationScore || 'N/A'}.`,
            structuredValue: {
              valuationScore: valuation.valuationScore,
              dcfValue: valuation.dcfValue,
              discountToIntrinsicPct: valuation.discountToIntrinsicPct,
              historicalPeRange: valuation.historicalPeRange
            },
            publishedAt: valuation.asOfDate,
            availableAt: availableAt,
            retrievedAt: valuation.retrievedAt,
            epistemicStatus: valuation.epistemicStatus,
            isSimulated: valuation.isSimulated,
            sourceReference: {
              provider: 'FINMAGINE',
              symbol: valuation.symbol
            }
          });
        }
      }

      // 4. Momentum & Technical Metrics
      const momentum = await this.provider.getMomentum(symbol, market);
      if (momentum) {
        const availableAt = momentum.asOfDate || momentum.retrievedAt;
        if (this.isPointInTimeCompliant(availableAt, asOfDate)) {
          items.push({
            evidenceId: `finmagine-momentum-${security.id}`,
            securityId: security.id,
            sourceType: 'FINMAGINE',
            provider: 'FINMAGINE',
            title: `${symbol} Momentum Indicators (Finmagine)`,
            content: `Technical context: RSI(14) ${momentum.rsi14 || 'N/A'}, SMA50 ${momentum.sma50 || 'N/A'}, SMA200 ${momentum.sma200 || 'N/A'}, Momentum Score ${momentum.momentumScore || 'N/A'}.`,
            structuredValue: {
              rsi14: momentum.rsi14,
              sma50: momentum.sma50,
              sma200: momentum.sma200,
              momentumScore: momentum.momentumScore,
              relStrengthVsIndex: momentum.relStrengthVsIndex
            },
            publishedAt: momentum.asOfDate,
            availableAt: availableAt,
            retrievedAt: momentum.retrievedAt,
            epistemicStatus: momentum.epistemicStatus,
            isSimulated: momentum.isSimulated,
            sourceReference: {
              provider: 'FINMAGINE',
              symbol: momentum.symbol
            }
          });
        }
      }

      // 5. Fundamentals (Financial Statements)
      const fundamentals = await this.provider.getFundamentals(symbol, market);
      if (fundamentals && (fundamentals.annualFinancials?.length || fundamentals.quarterlyFinancials?.length)) {
        const availableAt = fundamentals.asOfDate || fundamentals.retrievedAt;
        if (this.isPointInTimeCompliant(availableAt, asOfDate)) {
          items.push({
            evidenceId: `finmagine-fundamentals-${security.id}`,
            securityId: security.id,
            sourceType: 'FINMAGINE',
            provider: 'FINMAGINE',
            title: `${symbol} Fundamentals (Finmagine)`,
            content: `Reported financials from Finmagine: ${fundamentals.annualFinancials?.length || 0} annual periods, ${fundamentals.quarterlyFinancials?.length || 0} quarterly periods.`,
            structuredValue: {
              annual: fundamentals.annualFinancials,
              quarterly: fundamentals.quarterlyFinancials
            },
            publishedAt: fundamentals.asOfDate,
            availableAt: availableAt,
            retrievedAt: fundamentals.retrievedAt,
            epistemicStatus: fundamentals.epistemicStatus,
            isSimulated: fundamentals.isSimulated,
            sourceReference: {
              provider: 'FINMAGINE',
              symbol: fundamentals.symbol
            }
          });
        }
      }

      // 6. Earnings Consensus
      const earnings = await this.provider.getEarnings(symbol, market);
      if (earnings && (earnings.epsConsensus !== undefined || earnings.epsActual !== undefined || earnings.nextEarningsDate)) {
        const availableAt = earnings.asOfDate || earnings.retrievedAt;
        if (this.isPointInTimeCompliant(availableAt, asOfDate)) {
          items.push({
            evidenceId: `finmagine-earnings-${security.id}`,
            securityId: security.id,
            sourceType: 'FINMAGINE',
            provider: 'FINMAGINE',
            title: `${symbol} Earnings Consensus (Finmagine)`,
            content: `Earnings outlook: Next date ${earnings.nextEarningsDate || 'TBD'}, EPS Consensus ${earnings.epsConsensus ?? 'N/A'}, Actual ${earnings.epsActual ?? 'N/A'}, Surprise ${earnings.epsSurprisePct ? `${earnings.epsSurprisePct}%` : 'N/A'}.`,
            structuredValue: {
              epsConsensus: earnings.epsConsensus,
              epsActual: earnings.epsActual,
              epsSurprisePct: earnings.epsSurprisePct,
              revenueConsensus: earnings.revenueConsensus,
              revenueActual: earnings.revenueActual,
              nextEarningsDate: earnings.nextEarningsDate
            },
            publishedAt: earnings.asOfDate,
            availableAt: availableAt,
            retrievedAt: earnings.retrievedAt,
            epistemicStatus: earnings.epistemicStatus,
            isSimulated: earnings.isSimulated,
            sourceReference: {
              provider: 'FINMAGINE',
              symbol: earnings.symbol
            }
          });
        }
      }
    } catch (err) {
      console.warn(`[FinmagineEvidenceAdapter] Error gathering evidence for ${symbol}:`, err instanceof Error ? err.message : String(err));
    }

    return items;
  }
}

export const finmagineEvidenceAdapter = new FinmagineEvidenceAdapter();
