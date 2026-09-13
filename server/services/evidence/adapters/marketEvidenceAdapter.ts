/**
 * Market Data Evidence Adapter (Phase 8A)
 * 
 * Normalizes live, simulated, and historical market quotes from Twelve Data
 * and India market providers into canonical EvidenceItem objects.
 * Strictly preserves epistemic status (never fabricates REAL data).
 */

import { EvidenceItem, SecurityIdentifier } from '../../../../src/types';
import { financialDataService } from '../../financialDataService';

export class MarketEvidenceAdapter {
  /**
   * Gather and normalize current market quote for a security.
   */
  public async getQuoteEvidence(
    security: SecurityIdentifier,
    asOfDate?: string | Date
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = [];
    const now = new Date().toISOString();

    try {
      const quote = await financialDataService.getQuote({
        symbol: security.symbol,
        market: security.market,
        exchange: security.exchange
      });

      const publishedAt = quote.asOf || quote.retrievedAt || now;

      // Point-in-time guard
      if (asOfDate) {
        const asOfTime = new Date(asOfDate).getTime();
        const pubTime = new Date(publishedAt).getTime();
        if (!isNaN(asOfTime) && !isNaN(pubTime) && pubTime > asOfTime) {
          // Quote was produced after the asOfDate
          return evidenceItems;
        }
      }

      const isSimulated = quote.isSimulated ?? (quote.epistemicStatus === 'SIMULATED');
      let epistemicStatus: 'REAL' | 'SIMULATED' | 'UNAVAILABLE' | 'CALCULATED' = quote.epistemicStatus || (isSimulated ? 'SIMULATED' : 'REAL');

      // Strict enforcement: Indian equities without verified live KYC must NEVER be labeled REAL
      if (security.market === 'INDIA' && epistemicStatus === 'REAL') {
        const health = financialDataService.getDataSourcesHealth();
        if (health.indiaMarketData?.status !== 'Connected') {
          epistemicStatus = isSimulated ? 'SIMULATED' : 'UNAVAILABLE';
        }
      }

      const providerName = quote.provider || (security.market === 'US' ? 'Twelve Data' : 'India Market Provider');

      evidenceItems.push({
        evidenceId: `ev-quote-${security.symbol.toLowerCase()}`,
        securityId: security.id,
        sourceType: 'MARKET_DATA',
        provider: providerName,
        documentType: 'MARKET_QUOTE',
        title: `Market Quote: ${security.symbol} (${security.exchange})`,
        content: `Market quote for ${security.symbol} (${security.companyName}): Price ${quote.price} ${quote.currency}, Change ${quote.change >= 0 ? '+' : ''}${quote.change} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent?.toFixed(2)}%) on ${quote.exchange}. Volume: ${quote.volume || 'N/A'}. Provider: ${providerName}. Status: ${epistemicStatus}${isSimulated ? ' (SIMULATED - Pending exchange connection)' : ''}.`,
        structuredValue: {
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          currency: quote.currency,
          exchange: quote.exchange,
          marketCap: quote.marketCap
        },
        unit: quote.currency,
        currency: quote.currency,
        publishedAt,
        retrievedAt: quote.retrievedAt || now,
        epistemicStatus: epistemicStatus as any,
        isSimulated,
        sourceReference: {
          symbol: security.symbol,
          exchange: quote.exchange,
          market: security.market,
          concept: 'market_price',
          provider: providerName
        },
        metadata: {
          isSimulated,
          epistemicStatus,
          providerAsOf: quote.asOf
        }
      });
    } catch (err: unknown) {
      evidenceItems.push({
        evidenceId: `ev-quote-${security.symbol.toLowerCase()}-unavailable`,
        securityId: security.id,
        sourceType: 'MARKET_DATA',
        provider: security.market === 'US' ? 'Twelve Data' : 'India Market Provider',
        documentType: 'MARKET_QUOTE_ERROR',
        title: `Market Quote Unavailable for ${security.symbol}`,
        content: `Market quote for ${security.symbol} is currently UNAVAILABLE.`,
        publishedAt: now,
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        sourceReference: {
          symbol: security.symbol,
          market: security.market,
          provider: security.market === 'US' ? 'Twelve Data' : 'India Market Provider'
        }
      });
    }

    return evidenceItems;
  }

  /**
   * Gather and normalize historical prices (OHLCV) for a security.
   */
  public async getHistoricalEvidence(
    security: SecurityIdentifier,
    asOfDate?: string | Date
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = [];
    const now = new Date().toISOString();

    try {
      const history = await financialDataService.getHistoricalPrices({
        symbol: security.symbol,
        market: security.market,
        exchange: security.exchange,
        period: '1M',
        interval: '1d'
      });

      if (history && history.bars && history.bars.length > 0) {
        const isSimulated = history.isSimulated ?? false;
        let epistemicStatus: 'REAL' | 'SIMULATED' | 'UNAVAILABLE' | 'CALCULATED' = isSimulated ? 'SIMULATED' : 'REAL';

        if (security.market === 'INDIA' && epistemicStatus === 'REAL') {
          const health = financialDataService.getDataSourcesHealth();
          if (health.indiaMarketData?.status !== 'Connected') {
            epistemicStatus = isSimulated ? 'SIMULATED' : 'UNAVAILABLE';
          }
        }

        // Return recent bars that comply with asOfDate
        for (const bar of history.bars.slice(-5)) {
          const dateStr = bar.timestamp.includes('T') ? bar.timestamp.split('T')[0] : bar.timestamp;
          const publishedAt = bar.timestamp.includes('T') ? bar.timestamp : `${bar.timestamp}T16:00:00.000Z`;

          if (asOfDate) {
            const asOfTime = new Date(asOfDate).getTime();
            const pubTime = new Date(publishedAt).getTime();
            if (!isNaN(asOfTime) && !isNaN(pubTime) && pubTime > asOfTime) {
              continue;
            }
          }

          evidenceItems.push({
            evidenceId: `ev-ohlcv-${security.symbol.toLowerCase()}-${dateStr}`,
            securityId: security.id,
            sourceType: 'MARKET_DATA',
            provider: history.provider || (security.market === 'US' ? 'Twelve Data' : 'India Market Provider'),
            documentType: 'HISTORICAL_OHLCV',
            title: `OHLCV Candle: ${security.symbol} on ${dateStr}`,
            content: `Daily trading session for ${security.symbol} on ${dateStr}: Open ${bar.open}, High ${bar.high}, Low ${bar.low}, Close ${bar.close}, Volume ${bar.volume.toLocaleString()}.`,
            structuredValue: {
              date: dateStr,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume
            },
            unit: security.currency,
            currency: security.currency,
            publishedAt,
            periodEnd: dateStr,
            retrievedAt: now,
            epistemicStatus: epistemicStatus as any,
            isSimulated,
            sourceReference: {
              symbol: security.symbol,
              date: dateStr,
              concept: 'historical_close',
              provider: history.provider
            }
          });
        }
      }
    } catch {
      // Historical lookup failure; omit or gracefully handle
    }

    return evidenceItems;
  }
}

export const marketEvidenceAdapter = new MarketEvidenceAdapter();
