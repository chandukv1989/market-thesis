/**
 * US Market Data Provider (Twelve Data API - NASDAQ / NYSE)
 * 
 * Epistemic Model:
 * - When TWELVE_DATA_API_KEY is configured and response is verified:
 *     provider: 'Twelve Data'
 *     epistemicStatus: 'REAL'
 *     isSimulated: false
 * - When unconfigured:
 *     provider: 'US Simulated Pricing Engine (Unconfigured Provider)'
 *     epistemicStatus: 'SIMULATED'
 *     isSimulated: true
 * - Historical OHLCV:
 *     Returns REAL bars when Twelve Data succeeds.
 *     Returns UNAVAILABLE when unconfigured or when vendor limits are exceeded.
 *     NEVER fabricates fake historical bars.
 * 
 * Security:
 * - TWELVE_DATA_API_KEY is accessed strictly server-side.
 * - Credential values are NEVER logged, exposed to client bundles, or returned in API payloads.
 */

import { RegionalMarketProvider } from './types';
import {
  MarketDataRequest,
  HistoricalPricesRequest,
  HistoricalPricesResponse,
  MarketStatusResponse,
  NormalizedQuote,
  ProviderHealth,
  HistoricalPriceBar,
  EpistemicStatus
} from '../../src/types';

export const US_BASELINE_PRICES: Record<
  string,
  { price: number; change: number; changePercent: number; volume: string; marketCap: string; exchange: string }
> = {
  NVDA: { price: 128.60, change: 3.52, changePercent: 2.81, volume: '58.4M', marketCap: '$3.16T', exchange: 'NASDAQ' },
  MSFT: { price: 421.40, change: 2.15, changePercent: 0.51, volume: '18.2M', marketCap: '$3.13T', exchange: 'NASDAQ' },
  ASML: { price: 812.50, change: -8.20, changePercent: -1.00, volume: '1.4M', marketCap: '$324.8B', exchange: 'NASDAQ' },
  TSM: { price: 172.80, change: 3.80, changePercent: 2.25, volume: '12.8M', marketCap: '$896.2B', exchange: 'NYSE' },
  AVGO: { price: 152.20, change: -1.80, changePercent: -1.17, volume: '4.6M', marketCap: '$708.5B', exchange: 'NASDAQ' },
  AMZN: { price: 177.50, change: 1.45, changePercent: 0.82, volume: '34.1M', marketCap: '$1.85T', exchange: 'NASDAQ' },
  AAPL: { price: 220.80, change: 0.90, changePercent: 0.41, volume: '42.6M', marketCap: '$3.38T', exchange: 'NASDAQ' },
  PLTR: { price: 32.40, change: 1.15, changePercent: 3.68, volume: '68.9M', marketCap: '$72.1B', exchange: 'NYSE' },
  LLY: { price: 945.00, change: 7.90, changePercent: 0.85, volume: '2.8M', marketCap: '$898.4B', exchange: 'NYSE' },
  JPM: { price: 216.50, change: 1.20, changePercent: 0.56, volume: '9.2M', marketCap: '$621.5B', exchange: 'NYSE' }
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export type CustomFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class USMarketProvider implements RegionalMarketProvider {
  public readonly market = 'US' as const;
  public readonly supportedExchanges = ['NASDAQ', 'NYSE'];
  public readonly baseUrl = 'https://api.twelvedata.com';

  private lastError: string | null = null;
  private lastSuccessfulRetrieval: string | null = null;
  private customFetch?: CustomFetchFn;
  private overrideApiKey?: string | null;

  // In-memory caches to respect Twelve Data free-tier rate limits (8/min)
  private quoteCache = new Map<string, CacheEntry<NormalizedQuote>>();
  private historyCache = new Map<string, CacheEntry<HistoricalPricesResponse>>();
  private healthCache: CacheEntry<ProviderHealth> | null = null;

  constructor(customFetch?: CustomFetchFn, overrideApiKey?: string | null) {
    this.customFetch = customFetch;
    this.overrideApiKey = overrideApiKey;
  }

  /**
   * Set custom fetch handler (useful for testing & offline sandboxes)
   */
  public setFetchHandler(customFetch?: CustomFetchFn) {
    this.customFetch = customFetch;
  }

  /**
   * Override API key (set to null to simulate unconfigured state)
   */
  public setApiKeyOverride(overrideApiKey?: string | null): void {
    this.overrideApiKey = overrideApiKey;
    this.clearCache();
  }

  /**
   * Safe getter for API key (never exposes or logs the key)
   */
  private getApiKey(): string | null {
    if (this.overrideApiKey !== undefined) {
      return this.overrideApiKey;
    }
    const key = process.env.TWELVE_DATA_API_KEY || process.env.MARKET_DATA_API_KEY;
    if (key && key.trim().length > 0) {
      return key.trim();
    }
    return null;
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Clear in-memory caches
   */
  public clearCache(): void {
    this.quoteCache.clear();
    this.historyCache.clear();
    this.healthCache = null;
  }

  /**
   * Provider health check
   */
  public getHealthStatus(): ProviderHealth {
    const apiKey = this.getApiKey();
    const now = new Date().toISOString();

    if (!apiKey) {
      return {
        name: 'US Market Data (Twelve Data)',
        status: 'UNCONFIGURED',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Simulated Baseline (TWELVE_DATA_API_KEY Unconfigured)',
        details: 'Twelve Data API key is not configured. Quotes operate in simulated baseline fallback with explicit SIMULATED provenance.',
        isSimulated: true
      };
    }

    if (this.lastError) {
      return {
        name: 'US Market Data (Twelve Data)',
        status: 'Error',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Provider Error Reported',
        details: `Twelve Data error: ${this.lastError}`,
        isSimulated: false
      };
    }

    if (this.lastSuccessfulRetrieval) {
      return {
        name: 'US Market Data (Twelve Data)',
        status: 'Connected',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Live Twelve Data Connected',
        details: 'Twelve Data API connected and actively providing verified US market quotes.',
        isSimulated: false
      };
    }

    return {
      name: 'US Market Data (Twelve Data)',
      status: 'Connected',
      lastSuccessfulRetrieval: null,
      dataFreshness: 'Configured & Awaiting First Request',
      details: 'TWELVE_DATA_API_KEY is configured. Ready for authoritative live requests.',
      isSimulated: false
    };
  }

  /**
   * Canonical Twelve Data Symbol Resolution
   * Preserves canonical identity while attaching exchange parameters where required.
   */
  public resolveProviderSymbol(requestSymbol: string, requestedExchange?: string): { symbol: string; exchange?: string } {
    const sym = requestSymbol.toUpperCase().trim();
    // Default exchanges for known canonical assets
    const knownExchanges: Record<string, string> = {
      NVDA: 'NASDAQ',
      MSFT: 'NASDAQ',
      AAPL: 'NASDAQ',
      AMZN: 'NASDAQ',
      AVGO: 'NASDAQ',
      ASML: 'NASDAQ',
      TSM: 'NYSE',
      PLTR: 'NYSE',
      LLY: 'NYSE',
      JPM: 'NYSE'
    };

    const exchange = requestedExchange || knownExchanges[sym] || 'NASDAQ';
    return { symbol: sym, exchange };
  }

  /**
   * Fetch Live Quote from Twelve Data
   */
  public async getQuote(request: MarketDataRequest): Promise<NormalizedQuote> {
    const sym = request.symbol.toUpperCase().trim();
    const { symbol: twelveSymbol, exchange } = this.resolveProviderSymbol(sym, request.exchange);
    const securityId = request.securityId || `us-${sym.toLowerCase()}`;
    const apiKey = this.getApiKey();
    const now = new Date().toISOString();

    // 1. Unconfigured Fallback
    if (!apiKey) {
      const baseline = US_BASELINE_PRICES[sym] || {
        price: 100.0,
        change: 0.0,
        changePercent: 0.0,
        volume: '1.0M',
        marketCap: '$10.0B',
        exchange
      };

      return {
        ticker: sym,
        symbol: sym,
        securityId,
        price: baseline.price,
        change: baseline.change,
        changePercent: baseline.changePercent,
        volume: baseline.volume,
        marketCap: baseline.marketCap,
        currency: 'USD',
        market: 'US',
        exchange: baseline.exchange,
        asOf: now,
        retrievedAt: now,
        provider: 'US Simulated Pricing Engine (Unconfigured Provider)',
        isSimulated: true,
        epistemicCategory: 'SIMULATED',
        epistemicStatus: 'SIMULATED',
        status: 'available'
      };
    }

    // 2. Check Quote Cache (TTL: 45 seconds to conserve Twelve Data free-tier calls)
    const cacheKey = `${twelveSymbol}:${exchange}`;
    const cached = this.quoteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 3. Make Live Request to Twelve Data /quote
    const fetchImpl = this.customFetch || fetch;
    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set('symbol', twelveSymbol);
    url.searchParams.set('apikey', apiKey);
    if (exchange) {
      url.searchParams.set('exchange', exchange);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = `Twelve Data HTTP ${res.status}: ${res.statusText}`;
        this.lastError = errorText;
        return {
          ticker: sym,
          symbol: sym,
          securityId,
          price: 0,
          change: 0,
          changePercent: 0,
          currency: 'USD',
          market: 'US',
          exchange,
          asOf: now,
          retrievedAt: now,
          provider: 'Twelve Data',
          isSimulated: false,
          epistemicCategory: 'REAL',
          epistemicStatus: 'UNAVAILABLE',
          status: 'unavailable',
          reason: errorText
        };
      }

      const data = await res.json();

      // Check for Twelve Data error objects (e.g. invalid symbol, limit exceeded, bad API key)
      if (data.status === 'error' || data.code) {
        const errMsg = data.message || `Twelve Data API returned code ${data.code}`;
        this.lastError = errMsg;
        return {
          ticker: sym,
          symbol: sym,
          securityId,
          price: 0,
          change: 0,
          changePercent: 0,
          currency: 'USD',
          market: 'US',
          exchange,
          asOf: now,
          retrievedAt: now,
          provider: 'Twelve Data',
          isSimulated: false,
          epistemicCategory: 'REAL',
          epistemicStatus: 'UNAVAILABLE',
          status: 'unavailable',
          reason: errMsg
        };
      }

      // Valid Quote Response
      const price = parseFloat(data.close || data.price || '0');
      const change = parseFloat(data.change || '0');
      const changePercent = parseFloat(data.percent_change || '0');
      const rawVol = data.volume;
      const volumeFormatted = rawVol ? `${(parseFloat(rawVol) / 1e6).toFixed(1)}M` : undefined;

      const normalized: NormalizedQuote = {
        ticker: sym,
        symbol: sym,
        securityId,
        price,
        change,
        changePercent,
        volume: volumeFormatted,
        currency: data.currency || 'USD',
        market: 'US',
        exchange: data.exchange || exchange,
        asOf: data.datetime || now,
        retrievedAt: now,
        provider: 'Twelve Data',
        isSimulated: false,
        epistemicCategory: 'REAL',
        epistemicStatus: 'REAL',
        status: 'available'
      };

      this.lastError = null;
      this.lastSuccessfulRetrieval = now;
      this.quoteCache.set(cacheKey, {
        data: normalized,
        expiresAt: Date.now() + 45000 // 45 seconds TTL
      });

      return normalized;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.lastError = errMsg;
      return {
        ticker: sym,
        symbol: sym,
        securityId,
        price: 0,
        change: 0,
        changePercent: 0,
        currency: 'USD',
        market: 'US',
        exchange,
        asOf: now,
        retrievedAt: now,
        provider: 'Twelve Data',
        isSimulated: false,
        epistemicCategory: 'REAL',
        epistemicStatus: 'UNAVAILABLE',
        status: 'unavailable',
        reason: `Network/connection failure communicating with Twelve Data: ${errMsg}`
      };
    }
  }

  /**
   * Fetch Historical OHLCV from Twelve Data /time_series
   */
  public async getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse> {
    const sym = request.symbol.toUpperCase().trim();
    const { symbol: twelveSymbol, exchange } = this.resolveProviderSymbol(sym, request.exchange);
    const securityId = request.securityId || `us-${sym.toLowerCase()}`;
    const apiKey = this.getApiKey();
    const now = new Date().toISOString();

    // 1. Unconfigured Fallback -> UNAVAILABLE (never synthesize fake bars)
    if (!apiKey) {
      return {
        securityId,
        symbol: sym,
        market: 'US',
        exchange,
        currency: 'USD',
        interval: request.interval || '1d',
        bars: [],
        provider: 'US Simulated Pricing Engine (Unconfigured Provider)',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: true,
        status: 'unavailable',
        reason: 'Historical OHLCV data is UNAVAILABLE because Twelve Data API key is unconfigured. Simulated baseline engine does not fabricate fake historical bars.'
      };
    }

    // 2. Map Interval to Twelve Data format
    let twelveInterval = '1day';
    switch (request.interval) {
      case '1m': twelveInterval = '1min'; break;
      case '5m': twelveInterval = '5min'; break;
      case '15m': twelveInterval = '15min'; break;
      case '1h': twelveInterval = '1h'; break;
      case '1d': twelveInterval = '1day'; break;
      case '1wk': twelveInterval = '1week'; break;
      case '1mo': twelveInterval = '1month'; break;
      default: twelveInterval = '1day'; break;
    }

    // Output size estimation
    let outputSize = 30;
    if (request.period === '1W') outputSize = 7;
    else if (request.period === '1M') outputSize = 30;
    else if (request.period === '3M') outputSize = 90;
    else if (request.period === '1Y') outputSize = 252;
    else if (request.period === '5Y') outputSize = 1260;

    const cacheKey = `${twelveSymbol}:${twelveInterval}:${outputSize}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const fetchImpl = this.customFetch || fetch;
    const url = new URL(`${this.baseUrl}/time_series`);
    url.searchParams.set('symbol', twelveSymbol);
    url.searchParams.set('interval', twelveInterval);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('outputsize', String(outputSize));
    if (exchange) {
      url.searchParams.set('exchange', exchange);
    }
    if (request.startDate) {
      url.searchParams.set('start_date', request.startDate);
    }
    if (request.endDate) {
      url.searchParams.set('end_date', request.endDate);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = `Twelve Data HTTP ${res.status}: ${res.statusText}`;
        return {
          securityId,
          symbol: sym,
          market: 'US',
          exchange,
          currency: 'USD',
          interval: request.interval || '1d',
          bars: [],
          provider: 'Twelve Data',
          retrievedAt: now,
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          status: 'unavailable',
          reason: errorText
        };
      }

      const data = await res.json();

      if (data.status === 'error' || data.code || !Array.isArray(data.values)) {
        const errMsg = data.message || 'Twelve Data returned no historical values';
        return {
          securityId,
          symbol: sym,
          market: 'US',
          exchange,
          currency: 'USD',
          interval: request.interval || '1d',
          bars: [],
          provider: 'Twelve Data',
          retrievedAt: now,
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          status: 'unavailable',
          reason: errMsg
        };
      }

      // Map Twelve Data values to HistoricalPriceBar[]
      interface TwelveValue {
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume?: string;
      }

      const bars: HistoricalPriceBar[] = (data.values as TwelveValue[])
        .map((v) => {
          const c = parseFloat(v.close);
          return {
            timestamp: v.datetime,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: c,
            adjustedClose: c,
            volume: parseInt(v.volume || '0', 10),
            currency: data.meta?.currency || 'USD',
            securityId,
            market: 'US' as const,
            exchange: data.meta?.exchange || exchange,
            provider: 'Twelve Data',
            epistemicStatus: 'REAL' as const
          };
        })
        .filter((b) => !isNaN(b.close) && !isNaN(b.open) && b.close > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const response: HistoricalPricesResponse = {
        securityId,
        symbol: sym,
        market: 'US',
        exchange: data.meta?.exchange || exchange,
        currency: data.meta?.currency || 'USD',
        interval: request.interval || '1d',
        bars,
        provider: 'Twelve Data',
        retrievedAt: now,
        epistemicStatus: 'REAL',
        isSimulated: false,
        status: 'available'
      };

      this.historyCache.set(cacheKey, {
        data: response,
        expiresAt: Date.now() + 300000 // 5 minutes TTL
      });

      return response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        securityId,
        symbol: sym,
        market: 'US',
        exchange,
        currency: 'USD',
        interval: request.interval || '1d',
        bars: [],
        provider: 'Twelve Data',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        status: 'unavailable',
        reason: `Failed to retrieve historical bars from Twelve Data: ${errMsg}`
      };
    }
  }

  /**
   * Session status
   */
  public async getMarketStatus(exchange?: string): Promise<MarketStatusResponse> {
    const now = new Date();
    const isConfigured = this.isConfigured();

    // Calculate US market hours in America/New_York
    const nyTimeStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyDate = new Date(nyTimeStr);
    const day = nyDate.getDay(); // 0 = Sun, 6 = Sat
    const hour = nyDate.getHours();
    const minute = nyDate.getMinutes();
    const timeMinutes = hour * 60 + minute;

    const isWeekday = day >= 1 && day <= 5;
    const isRegular = isWeekday && timeMinutes >= 9 * 60 + 30 && timeMinutes < 16 * 60;
    const isPre = isWeekday && timeMinutes >= 4 * 60 && timeMinutes < 9 * 60 + 30;
    const isPost = isWeekday && timeMinutes >= 16 * 60 && timeMinutes < 20 * 60;

    let session: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' = 'CLOSED';
    if (isRegular) session = 'REGULAR';
    else if (isPre) session = 'PRE';
    else if (isPost) session = 'POST';

    let status: 'CONNECTED' | 'SIMULATED' | 'UNCONFIGURED' | 'ERROR' = 'UNCONFIGURED';
    let epistemicStatus: EpistemicStatus = 'SIMULATED';
    let provider = 'US Simulated Pricing Engine (Unconfigured Provider)';
    let isSimulated = true;

    if (!isConfigured) {
      status = 'UNCONFIGURED';
      epistemicStatus = 'SIMULATED';
      provider = 'US Simulated Pricing Engine (Unconfigured Provider)';
      isSimulated = true;
    } else if (this.lastError) {
      status = 'ERROR';
      epistemicStatus = 'UNAVAILABLE';
      provider = 'Twelve Data';
      isSimulated = false;
    } else {
      status = 'CONNECTED';
      epistemicStatus = 'REAL';
      provider = 'Twelve Data';
      isSimulated = false;
    }

    return {
      market: 'US',
      exchange: exchange || 'NASDAQ',
      isOpen: isRegular,
      timezone: 'America/New_York',
      session,
      status,
      retrievedAt: now.toISOString(),
      provider,
      epistemicStatus,
      isSimulated
    };
  }
}

export const usMarketProvider = new USMarketProvider();
