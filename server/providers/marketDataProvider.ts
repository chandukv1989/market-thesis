/**
 * Multi-Market Data Provider & Routing Layer
 * 
 * Routes requests between USMarketProvider (Twelve Data - NASDAQ / NYSE) and
 * IndiaMarketProvider (TrueData - NSE / BSE).
 * 
 * Epistemic Model:
 * - When vendor credentials exist and validated live responses are received:
 *     epistemicStatus: 'REAL'
 *     isSimulated: false
 * - When vendor credentials are absent:
 *     epistemicStatus: 'SIMULATED' (Quotes) / 'UNAVAILABLE' (Historical bars)
 *     isSimulated: true
 * - Real SEC EDGAR provider remains completely separate and server-side.
 */

import { MarketDataProvider } from './types';
import {
  NormalizedQuote,
  ProviderHealth,
  MarketDataRequest,
  HistoricalPricesRequest,
  HistoricalPricesResponse,
  MarketStatusRequest,
  MarketStatusResponse
} from '../../src/types';
import { usMarketProvider, USMarketProvider } from './usMarketProvider';
import { indiaMarketProvider, IndiaMarketProvider } from './indiaMarketProvider';
import { resolveSecurity } from '../../src/data/canonicalSecurities';

export class MarketDataProviderImpl implements MarketDataProvider {
  public usProvider: USMarketProvider;
  public indiaProvider: IndiaMarketProvider;

  constructor(usProvider?: USMarketProvider, indiaProvider?: IndiaMarketProvider) {
    this.usProvider = usProvider || usMarketProvider;
    this.indiaProvider = indiaProvider || indiaMarketProvider;
  }

  public getHealthStatus(): ProviderHealth {
    const usHealth = this.usProvider.getHealthStatus();
    const indiaHealth = this.indiaProvider.getHealthStatus();

    const usLive = usHealth.status === 'Connected';
    const indiaLive = indiaHealth.status === 'Connected';

    const indiaProviderName = this.indiaProvider.fyersProvider.isConfigured() ? 'FYERS' : 'TrueData';

    if (usLive && indiaLive) {
      return {
        name: `Multi-Market Pricing Engine (Twelve Data & ${indiaProviderName})`,
        status: 'Connected',
        lastSuccessfulRetrieval: usHealth.lastSuccessfulRetrieval || indiaHealth.lastSuccessfulRetrieval || new Date().toISOString(),
        dataFreshness: `Live Providers Connected (US: Twelve Data, India: ${indiaProviderName})`,
        details: `Live market data providers configured and active across US (Twelve Data) and India (${indiaProviderName}) markets.`,
        isSimulated: false
      };
    }

    if (usLive || indiaLive) {
      const active = usLive ? 'US (Twelve Data)' : `India (${indiaProviderName})`;
      const unconf = !usLive ? 'US' : 'India';
      return {
        name: `Multi-Market Pricing Engine (Twelve Data & ${indiaProviderName})`,
        status: 'Connected',
        lastSuccessfulRetrieval: usHealth.lastSuccessfulRetrieval || indiaHealth.lastSuccessfulRetrieval || new Date().toISOString(),
        dataFreshness: `Partial Live Integration (${active} Live, ${unconf} Simulated)`,
        details: `${active} provider is live. ${unconf} provider operates in unconfigured simulated baseline.`,
        isSimulated: false
      };
    }

    if (usHealth.status === 'Error' || indiaHealth.status === 'Error') {
      return {
        name: 'Multi-Market Pricing Engine (US & India)',
        status: 'Error',
        lastSuccessfulRetrieval: usHealth.lastSuccessfulRetrieval || indiaHealth.lastSuccessfulRetrieval,
        dataFreshness: 'Provider Connection Error',
        details: `Market provider error: US (${usHealth.status}) - India (${indiaHealth.status})`,
        isSimulated: false
      };
    }

    return {
      name: 'Multi-Market Pricing Engine (US & India)',
      status: 'UNCONFIGURED',
      lastSuccessfulRetrieval: null,
      dataFreshness: 'Simulated Baseline (TWELVE_DATA_API_KEY & FYERS/TRUEDATA Unconfigured)',
      details: 'Market data providers are UNCONFIGURED (TWELVE_DATA_API_KEY, FYERS_APP_ID/FYERS_ACCESS_TOKEN, or TRUEDATA credentials are not set). Operating in fallback mode with prices explicitly labeled as SIMULATED across US (USD) and India (INR) markets.',
      isSimulated: true
    };
  }

  public getProviderHealth(): ProviderHealth {
    return this.getHealthStatus();
  }

  public getRegionalHealth(): { us: ProviderHealth; india: ProviderHealth } {
    return {
      us: this.usProvider.getHealthStatus(),
      india: this.indiaProvider.getHealthStatus()
    };
  }

  public async getQuotes(requests: (MarketDataRequest | string)[]): Promise<NormalizedQuote[]> {
    if (requests.length === 0) return [];
    
    const indiaRequests: MarketDataRequest[] = [];
    const usRequests: MarketDataRequest[] = [];

    for (const r of requests) {
      const req: MarketDataRequest = typeof r === 'string' ? { symbol: r } : { ...r };
      const canonical = resolveSecurity(req.symbol);
      if (canonical) {
        if (!req.securityId) req.securityId = canonical.id;
        if (!req.market) req.market = canonical.market;
        if (!req.exchange) req.exchange = canonical.exchange;
        if (!req.currency) req.currency = canonical.currency;
      }
      const market = req.market || (canonical ? canonical.market : 'US');
      if (market === 'INDIA') {
        indiaRequests.push(req);
      } else {
        usRequests.push(req);
      }
    }

    const promises: Promise<NormalizedQuote[]>[] = [];
    if (indiaRequests.length > 0) {
      promises.push(this.indiaProvider.getQuotes(indiaRequests));
    }
    if (usRequests.length > 0) {
      promises.push(Promise.all(usRequests.map(req => this.usProvider.getQuote(req))));
    }

    const results = await Promise.all(promises);
    return results.flat();
  }

  public async getQuote(requestOrTicker: MarketDataRequest | string): Promise<NormalizedQuote> {
    const request: MarketDataRequest = typeof requestOrTicker === 'string'
      ? { symbol: requestOrTicker.toUpperCase().trim() }
      : { ...requestOrTicker };

    // Canonical security enrichment
    const canonical = resolveSecurity(request.symbol);
    if (canonical) {
      if (!request.securityId) request.securityId = canonical.id;
      if (!request.market) request.market = canonical.market;
      if (!request.exchange) request.exchange = canonical.exchange;
      if (!request.currency) request.currency = canonical.currency;
    }

    // Detect target market
    let market = request.market;
    if (!market) {
      market = canonical ? canonical.market : 'US';
    }

    if (market === 'INDIA') {
      return this.indiaProvider.getQuote(request);
    }

    // Default to US market provider
    return this.usProvider.getQuote(request);
  }

  public async getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse> {
    const req = { ...request };
    const canonical = resolveSecurity(req.symbol);
    if (canonical) {
      if (!req.securityId) req.securityId = canonical.id;
      if (!req.market) req.market = canonical.market;
      if (!req.exchange) req.exchange = canonical.exchange;
      if (!req.currency) req.currency = canonical.currency;
    }

    let market = req.market;
    if (!market) {
      market = canonical ? canonical.market : 'US';
    }

    if (market === 'INDIA') {
      return this.indiaProvider.getHistoricalPrices(req);
    }

    return this.usProvider.getHistoricalPrices(req);
  }

  public async getMarketStatus(request: MarketStatusRequest): Promise<MarketStatusResponse> {
    if (request.market === 'INDIA') {
      return this.indiaProvider.getMarketStatus(request.exchange);
    }

    return this.usProvider.getMarketStatus(request.exchange);
  }

  public clearCache(): void {
    this.usProvider.clearCache();
    this.indiaProvider.clearCache();
  }
}

export const marketDataProvider = new MarketDataProviderImpl();
