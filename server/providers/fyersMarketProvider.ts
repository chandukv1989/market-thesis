/**
 * FYERS India Market Data Provider (API v3 - NSE / BSE)
 * 
 * Epistemic Model:
 * - When FYERS credentials and access token are configured and live responses are verified:
 *     provider: 'FYERS'
 *     epistemicStatus: 'REAL'
 *     isSimulated: false
 * - When unconfigured or authentication required:
 *     provider: 'India Simulated Pricing Engine (FYERS Unconfigured)'
 *     epistemicStatus: 'SIMULATED' (Quotes) / 'UNAVAILABLE' (Historical OHLCV)
 *     isSimulated: true
 * - Historical OHLCV:
 *     Returns verified REAL candles when FYERS succeeds.
 *     Returns UNAVAILABLE when unconfigured or subscription limits occur.
 *     NEVER fabricates fake historical bars.
 * 
 * Security:
 * - Credentials and tokens are managed strictly server-side by FYERSAuthService.
 * - Credentials are NEVER logged, exposed to client bundles, or returned in API payloads.
 * 
 * Scope:
 * - READ-ONLY market data access (Quotes, Batch Quotes, Historical OHLCV, Market Status, Provider Health, Symbol Resolution).
 * - No order placement, no trading, no broker execution, no rebalancing.
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
import { fyersAuthService, FYERSAuthService } from '../services/auth/fyersAuthService';
import { INDIA_BASELINE_PRICES, CustomFetchFn } from './indiaMarketConstants';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class FYERSMarketProvider implements RegionalMarketProvider {
  public readonly market = 'INDIA' as const;
  public readonly supportedExchanges = ['NSE', 'BSE'];
  public readonly dataApiUrl = 'https://api-t1.fyers.in/data';
  public readonly fallbackApiUrl = 'https://api.fyers.in/data-rest/v3';

  private authService: FYERSAuthService;
  private customFetch?: CustomFetchFn;
  private lastSuccessfulRetrieval: string | null = null;
  private lastError: string | null = null;

  // In-memory caching to respect FYERS rate limits
  private quoteCache = new Map<string, CacheEntry<NormalizedQuote>>();
  private historyCache = new Map<string, CacheEntry<HistoricalPricesResponse>>();

  constructor(customFetch?: CustomFetchFn, authService?: FYERSAuthService) {
    this.customFetch = customFetch;
    this.authService = authService || fyersAuthService;
  }

  public setFetchHandler(customFetch?: CustomFetchFn): void {
    this.customFetch = customFetch;
  }

  public setAuthService(authService: FYERSAuthService): void {
    this.authService = authService;
  }

  public getAuthService(): FYERSAuthService {
    return this.authService;
  }

  public isConfigured(): boolean {
    return this.authService.isConfigured();
  }

  public isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  public clearCache(): void {
    this.quoteCache.clear();
    this.historyCache.clear();
    this.authService.clearCache();
  }

  /**
   * Deterministic FYERS Symbol Resolution (NSE / BSE)
   * 
   * Formats:
   * - NSE Equities: `NSE:${symbol}-EQ` (e.g. `NSE:RELIANCE-EQ`, `NSE:TCS-EQ`)
   * - BSE Equities: `BSE:${symbol}-A` or `BSE:${symbol}`
   * - Indices: `NSE:NIFTY50-INDEX`, `NSE:NIFTYBANK-INDEX`, `BSE:SENSEX-INDEX`
   */
  public resolveProviderSymbol(requestSymbol: string, requestedExchange?: string): {
    symbol: string;
    exchange: string;
    fyersSymbol: string;
  } {
    const raw = requestSymbol.toUpperCase().trim();
    let exchange = (requestedExchange?.toUpperCase() === 'BSE') ? 'BSE' : 'NSE';

    // Already in FYERS exchange:symbol format
    if (raw.includes(':')) {
      const parts = raw.split(':');
      exchange = parts[0].toUpperCase() === 'BSE' ? 'BSE' : 'NSE';
      const symPart = parts[1];
      const baseSym = symPart.replace(/-EQ$/, '').replace(/-INDEX$/, '').replace(/-A$/, '').replace(/-B$/, '');
      return {
        symbol: baseSym,
        exchange,
        fyersSymbol: raw
      };
    }

    // Special index tickers
    if (raw === 'NIFTY' || raw === 'NIFTY50' || raw === 'NIFTY 50') {
      return { symbol: 'NIFTY50', exchange: 'NSE', fyersSymbol: 'NSE:NIFTY50-INDEX' };
    }
    if (raw === 'BANKNIFTY' || raw === 'NIFTYBANK') {
      return { symbol: 'NIFTYBANK', exchange: 'NSE', fyersSymbol: 'NSE:NIFTYBANK-INDEX' };
    }
    if (raw === 'SENSEX' || raw === 'BSESENSEX') {
      return { symbol: 'SENSEX', exchange: 'BSE', fyersSymbol: 'BSE:SENSEX-INDEX' };
    }

    // Standard equity mapping
    if (exchange === 'BSE') {
      return {
        symbol: raw,
        exchange: 'BSE',
        fyersSymbol: `BSE:${raw}-A`
      };
    }

    return {
      symbol: raw,
      exchange: 'NSE',
      fyersSymbol: `NSE:${raw}-EQ`
    };
  }

  /**
   * Reverse mapping from FYERS Symbol string to canonical ticker
   */
  public parseFyersSymbol(fyersSymbol: string): { symbol: string; exchange: string } {
    const sym = fyersSymbol.toUpperCase().trim();
    if (!sym.includes(':')) {
      return { symbol: sym, exchange: 'NSE' };
    }
    const [exchangePart, rest] = sym.split(':');
    const exchange = exchangePart === 'BSE' ? 'BSE' : 'NSE';
    const cleanSym = rest.replace(/-EQ$/, '').replace(/-INDEX$/, '').replace(/-A$/, '').replace(/-B$/, '');
    return { symbol: cleanSym, exchange };
  }

  /**
   * Provider health check adhering to extended health contract
   */
  public getHealthStatus(): ProviderHealth {
    const authHealth = this.authService.getHealthStatus();
    const checkedAt = new Date().toISOString();

    if (authHealth.status === 'UNCONFIGURED') {
      return {
        name: 'India Market Data (FYERS)',
        status: 'UNCONFIGURED',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Simulated Baseline (FYERS_APP_ID / FYERS_ACCESS_TOKEN Unconfigured)',
        details: 'FYERS credentials are not configured. Indian equities operate in simulated baseline fallback with explicit SIMULATED provenance.',
        isSimulated: true,
        provider: 'FYERS',
        market: 'INDIA',
        checkedAt,
        lastErrorCategory: null
      };
    }

    if (authHealth.status === 'AUTHENTICATION_REQUIRED') {
      return {
        name: 'India Market Data (FYERS)',
        status: 'AUTHENTICATION_REQUIRED',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Authentication Required (FYERS_ACCESS_TOKEN Missing or Expired)',
        details: 'FYERS App ID is configured, but active access token is missing or expired. Operates in fallback simulated quotes.',
        isSimulated: true,
        provider: 'FYERS',
        market: 'INDIA',
        checkedAt,
        lastErrorCategory: 'AUTHENTICATION_REQUIRED'
      };
    }

    if (authHealth.status === 'RATE_LIMITED') {
      return {
        name: 'India Market Data (FYERS)',
        status: 'RATE_LIMITED',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Rate Limited (HTTP 429)',
        details: 'FYERS API request limit reached. Throttling requests to protect account integrity.',
        isSimulated: false,
        provider: 'FYERS',
        market: 'INDIA',
        checkedAt,
        lastErrorCategory: 'RATE_LIMITED'
      };
    }

    if (authHealth.status === 'ERROR') {
      return {
        name: 'India Market Data (FYERS)',
        status: 'Error',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Provider Error Reported',
        details: `FYERS error: ${this.lastError || authHealth.details}`,
        isSimulated: false,
        provider: 'FYERS',
        market: 'INDIA',
        checkedAt,
        lastErrorCategory: 'ERROR'
      };
    }

    if (this.lastSuccessfulRetrieval) {
      return {
        name: 'India Market Data (FYERS)',
        status: 'Connected',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Live FYERS API v3 Connected',
        details: 'FYERS Market Data API v3 actively streaming verified real quotes for Indian equities (NSE/BSE).',
        isSimulated: false,
        provider: 'FYERS',
        market: 'INDIA',
        checkedAt,
        lastErrorCategory: null
      };
    }

    return {
      name: 'India Market Data (FYERS)',
      status: 'Connected',
      lastSuccessfulRetrieval: null,
      dataFreshness: 'Configured & Ready for Queries',
      details: 'FYERS credentials and token configured. Ready for authoritative live requests.',
      isSimulated: false,
      provider: 'FYERS',
      market: 'INDIA',
      checkedAt,
      lastErrorCategory: null
    };
  }

  /**
   * Fetch a Single Live Quote from FYERS
   */
  public async getQuote(request: MarketDataRequest): Promise<NormalizedQuote> {
    const sym = request.symbol.toUpperCase().trim();
    const { symbol: baseSym, exchange, fyersSymbol } = this.resolveProviderSymbol(sym, request.exchange);
    const securityId = request.securityId || `in-${baseSym.toLowerCase()}`;
    const now = new Date().toISOString();

    const baseline = INDIA_BASELINE_PRICES[baseSym] || {
      price: 1000.0,
      change: 0.0,
      changePercent: 0.0,
      volume: '1.0M',
      marketCap: '₹5.0T',
      exchange
    };

    // 1. Unconfigured Fallback -> Explicit SIMULATED
    if (!this.isConfigured()) {
      return {
        ticker: baseSym,
        symbol: baseSym,
        securityId,
        price: baseline.price,
        change: baseline.change,
        changePercent: baseline.changePercent,
        volume: baseline.volume,
        marketCap: baseline.marketCap,
        currency: 'INR',
        market: 'INDIA',
        exchange: baseline.exchange,
        asOf: now,
        retrievedAt: now,
        provider: 'India Simulated Pricing Engine (FYERS Unconfigured)',
        isSimulated: true,
        epistemicCategory: 'SIMULATED',
        epistemicStatus: 'SIMULATED',
        status: 'available'
      };
    }

    // 2. Authentication Required Fallback
    if (!this.isAuthenticated()) {
      return {
        ticker: baseSym,
        symbol: baseSym,
        securityId,
        price: baseline.price,
        change: baseline.change,
        changePercent: baseline.changePercent,
        volume: baseline.volume,
        marketCap: baseline.marketCap,
        currency: 'INR',
        market: 'INDIA',
        exchange: baseline.exchange,
        asOf: now,
        retrievedAt: now,
        provider: 'India Simulated Pricing Engine (FYERS Auth Required)',
        isSimulated: true,
        epistemicCategory: 'SIMULATED',
        epistemicStatus: 'SIMULATED',
        status: 'available',
        reason: 'FYERS_ACCESS_TOKEN is missing or expired. Quote is operating in simulated fallback.'
      };
    }

    // 3. Cache Check (TTL: 45 seconds)
    const cacheKey = fyersSymbol;
    const cached = this.quoteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 4. Batch query of 1 symbol via official FYERS API v3 quotes endpoint
    const batchQuotes = await this.fetchQuotesFromFyers([fyersSymbol]);
    const matched = batchQuotes.find(q => q.symbol === baseSym || q.ticker === baseSym);

    if (matched) {
      this.quoteCache.set(cacheKey, {
        data: matched,
        expiresAt: Date.now() + 45000 // 45s TTL
      });
      return matched;
    }

    // Fallback if quote failed
    return {
      ticker: baseSym,
      symbol: baseSym,
      securityId,
      price: baseline.price,
      change: baseline.change,
      changePercent: baseline.changePercent,
      currency: 'INR',
      market: 'INDIA',
      exchange,
      asOf: now,
      retrievedAt: now,
      provider: 'India Simulated Pricing Engine (FYERS Fallback)',
      isSimulated: true,
      epistemicCategory: 'SIMULATED',
      epistemicStatus: 'SIMULATED',
      status: 'available',
      reason: this.lastError || `FYERS returned no quote data for ${fyersSymbol}`
    };
  }

  /**
   * Fetch Batch Quotes from FYERS API v3
   * Supports querying multiple NSE/BSE securities in a single request.
   */
  public async getQuotes(requests: (MarketDataRequest | string)[]): Promise<NormalizedQuote[]> {
    if (requests.length === 0) return [];

    const normalizedReqs: MarketDataRequest[] = requests.map(r =>
      typeof r === 'string' ? { symbol: r } : r
    );

    const fyersSymbolsMap = new Map<string, MarketDataRequest>();
    const fyersSymbolList: string[] = [];

    for (const req of normalizedReqs) {
      const { fyersSymbol } = this.resolveProviderSymbol(req.symbol, req.exchange);
      fyersSymbolsMap.set(fyersSymbol, req);
      fyersSymbolList.push(fyersSymbol);
    }

    // Check if unconfigured
    if (!this.isConfigured() || !this.isAuthenticated()) {
      return Promise.all(normalizedReqs.map(req => this.getQuote(req)));
    }

    return this.fetchQuotesFromFyers(fyersSymbolList, fyersSymbolsMap);
  }

  /**
   * Internal HTTP caller for FYERS API v3 Quotes
   */
  private async fetchQuotesFromFyers(
    fyersSymbols: string[],
    requestsMap?: Map<string, MarketDataRequest>
  ): Promise<NormalizedQuote[]> {
    const fetchImpl = this.customFetch || fetch;
    const authHeader = this.authService.getAuthHeader();
    const now = new Date().toISOString();

    if (!authHeader) {
      this.authService.recordError('AUTHENTICATION_REQUIRED', 'No auth header generated');
      return [];
    }

    const symbolsParam = fyersSymbols.join(',');
    const url = `${this.dataApiUrl}/quotes?symbols=${encodeURIComponent(symbolsParam)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetchImpl(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Handle Rate Limiting (429)
      if (res.status === 429) {
        this.lastError = 'FYERS API rate limit exceeded (HTTP 429)';
        this.authService.recordError('RATE_LIMITED', this.lastError);
        return [];
      }

      // Handle Authentication Failure (401)
      if (res.status === 401 || res.status === 403) {
        this.lastError = `FYERS authentication rejected (HTTP ${res.status})`;
        this.authService.recordError('AUTHENTICATION_REQUIRED', this.lastError);
        return [];
      }

      if (!res.ok) {
        this.lastError = `FYERS HTTP error ${res.status}: ${res.statusText}`;
        this.authService.recordError('ERROR', this.lastError);
        return [];
      }

      const body = await res.json();

      // Check FYERS response envelope
      // FYERS format: { s: "ok", d: [ { n: "NSE:RELIANCE-EQ", s: "ok", v: { ... } } ] }
      if (!body || body.s !== 'ok' || !Array.isArray(body.d)) {
        if (body && (body.code === -15 || body.code === -16)) {
          this.authService.recordError('AUTHENTICATION_REQUIRED', body.message || 'Token expired');
        } else if (body && body.code === -99) {
          this.authService.recordError('RATE_LIMITED', body.message || 'Rate limit hit');
        } else {
          this.authService.recordError('ERROR', body?.message || 'Invalid response from FYERS');
        }
        return [];
      }

      this.lastSuccessfulRetrieval = now;
      this.authService.recordSuccess();

      const normalizedQuotes: NormalizedQuote[] = [];

      for (const item of body.d) {
        if (!item || item.s !== 'ok' || !item.v) continue;

        const fyersSymbol = item.n || '';
        const { symbol: baseSym, exchange } = this.parseFyersSymbol(fyersSymbol);
        const req = requestsMap?.get(fyersSymbol);
        const securityId = req?.securityId || `in-${baseSym.toLowerCase()}`;

        const v = item.v;
        const lastPrice = parseFloat(v.lp ?? v.cmd?.c ?? v.close_price ?? 0);
        const change = parseFloat(v.ch ?? (lastPrice - (v.prev_close_price || lastPrice)));
        const changePercent = parseFloat(v.chp ?? (v.prev_close_price ? (change / v.prev_close_price) * 100 : 0));
        const rawVol = parseInt(v.volume ?? v.cmd?.v ?? 0, 10);
        const formattedVol = rawVol > 0 ? `${(rawVol / 1e6).toFixed(1)}M` : undefined;

        // Parse timestamp (epoch seconds or ISO)
        let asOfStr = now;
        if (v.tt) {
          const epochSec = parseInt(v.tt, 10);
          if (!isNaN(epochSec) && epochSec > 0) {
            asOfStr = new Date(epochSec * 1000).toISOString();
          }
        }

        const quote: NormalizedQuote = {
          ticker: baseSym,
          symbol: baseSym,
          securityId,
          price: lastPrice,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          volume: formattedVol,
          currency: 'INR',
          market: 'INDIA',
          exchange,
          asOf: asOfStr,
          retrievedAt: now,
          provider: 'FYERS',
          isSimulated: false,
          epistemicCategory: 'REAL',
          epistemicStatus: 'REAL',
          status: 'available'
        };

        normalizedQuotes.push(quote);
        // Cache individual quote
        this.quoteCache.set(fyersSymbol, {
          data: quote,
          expiresAt: Date.now() + 45000
        });
      }

      return normalizedQuotes;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.lastError = errMsg;
      this.authService.recordError('ERROR', errMsg);
      return [];
    }
  }

  /**
   * Fetch Historical OHLCV from FYERS API v3 /history
   * 
   * NEVER fabricates fake bars. If unconfigured or failed, returns UNAVAILABLE.
   */
  public async getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse> {
    const sym = request.symbol.toUpperCase().trim();
    const { symbol: baseSym, exchange, fyersSymbol } = this.resolveProviderSymbol(sym, request.exchange);
    const securityId = request.securityId || `in-${baseSym.toLowerCase()}`;
    const now = new Date().toISOString();

    // 1. Unconfigured Fallback -> UNAVAILABLE
    if (!this.isConfigured() || !this.isAuthenticated()) {
      return {
        securityId,
        symbol: baseSym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars: [],
        provider: 'India Simulated Pricing Engine (FYERS Unconfigured)',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: true,
        status: 'unavailable',
        reason: 'Historical OHLCV data is UNAVAILABLE because FYERS credentials/token are unconfigured. The engine NEVER fabricates synthetic historical bars.'
      };
    }

    // 2. Map Interval to FYERS Resolution
    // FYERS supported resolutions: '1', '2', '3', '5', '10', '15', '20', '30', '60', '120', '240', 'D', 'W', 'M'
    let resolution = 'D';
    switch (request.interval) {
      case '1m': resolution = '1'; break;
      case '5m': resolution = '5'; break;
      case '15m': resolution = '15'; break;
      case '1h': resolution = '60'; break;
      case '1d': resolution = 'D'; break;
      case '1wk': resolution = 'W'; break;
      case '1mo': resolution = 'M'; break;
      default: resolution = 'D'; break;
    }

    // 3. Compute Epoch Timestamp Ranges
    const toDate = new Date();
    const fromDate = new Date();
    if (request.period === '1W') fromDate.setDate(toDate.getDate() - 7);
    else if (request.period === '1M') fromDate.setMonth(toDate.getMonth() - 1);
    else if (request.period === '3M') fromDate.setMonth(toDate.getMonth() - 3);
    else if (request.period === '1Y') fromDate.setFullYear(toDate.getFullYear() - 1);
    else if (request.period === '5Y') fromDate.setFullYear(toDate.getFullYear() - 5);
    else fromDate.setMonth(toDate.getMonth() - 1);

    const rangeFromEpoch = Math.floor(fromDate.getTime() / 1000);
    const rangeToEpoch = Math.floor(toDate.getTime() / 1000);

    const cacheKey = `${fyersSymbol}:${resolution}:${rangeFromEpoch}:${rangeToEpoch}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const authHeader = this.authService.getAuthHeader();
    if (!authHeader) {
      return {
        securityId,
        symbol: baseSym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars: [],
        provider: 'FYERS',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        status: 'unavailable',
        reason: 'Authentication token missing for FYERS historical data'
      };
    }

    const fetchImpl = this.customFetch || fetch;
    const url = new URL(`${this.dataApiUrl}/history`);
    url.searchParams.set('symbol', fyersSymbol);
    url.searchParams.set('resolution', resolution);
    url.searchParams.set('date_format', '0'); // 0 = epoch seconds
    url.searchParams.set('range_from', String(rangeFromEpoch));
    url.searchParams.set('range_to', String(rangeToEpoch));
    url.searchParams.set('cont_flag', '1');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = `FYERS HTTP error ${res.status}: ${res.statusText}`;
        this.lastError = errorText;
        return {
          securityId,
          symbol: baseSym,
          market: 'INDIA',
          exchange,
          currency: 'INR',
          interval: request.interval || '1d',
          bars: [],
          provider: 'FYERS',
          retrievedAt: now,
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          status: 'unavailable',
          reason: errorText
        };
      }

      const data = await res.json();

      // FYERS candles response format:
      // { s: "ok", candles: [ [1694336400, 2960.0, 2990.0, 2955.0, 2985.4, 6400000], ... ] }
      if (!data || data.s !== 'ok' || !Array.isArray(data.candles) || data.candles.length === 0) {
        return {
          securityId,
          symbol: baseSym,
          market: 'INDIA',
          exchange,
          currency: 'INR',
          interval: request.interval || '1d',
          bars: [],
          provider: 'FYERS',
          retrievedAt: now,
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          status: 'unavailable',
          reason: data?.message || `No historical candles returned from FYERS for ${fyersSymbol}`
        };
      }

      const bars: HistoricalPriceBar[] = data.candles
        .map((c: any) => {
          // candle format: [timestamp, open, high, low, close, volume]
          const epochSec = typeof c[0] === 'number' ? c[0] : parseInt(c[0], 10);
          const timestamp = !isNaN(epochSec)
            ? new Date(epochSec * 1000).toISOString()
            : String(c[0]);
          const close = parseFloat(c[4]) || 0;

          return {
            timestamp,
            open: parseFloat(c[1]) || 0,
            high: parseFloat(c[2]) || 0,
            low: parseFloat(c[3]) || 0,
            close,
            adjustedClose: close,
            volume: parseInt(c[5], 10) || 0,
            currency: 'INR',
            securityId,
            market: 'INDIA' as const,
            exchange,
            provider: 'FYERS',
            epistemicStatus: 'REAL' as const
          };
        })
        .filter((b: HistoricalPriceBar) => !isNaN(b.close) && b.close > 0)
        .sort((a: HistoricalPriceBar, b: HistoricalPriceBar) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const response: HistoricalPricesResponse = {
        securityId,
        symbol: baseSym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars,
        provider: 'FYERS',
        retrievedAt: now,
        epistemicStatus: 'REAL',
        isSimulated: false,
        status: 'available'
      };

      this.historyCache.set(cacheKey, {
        data: response,
        expiresAt: Date.now() + 300000 // 5m TTL
      });

      return response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.lastError = errMsg;
      return {
        securityId,
        symbol: baseSym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars: [],
        provider: 'FYERS',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        status: 'unavailable',
        reason: `Failed to retrieve historical bars from FYERS: ${errMsg}`
      };
    }
  }

  /**
   * Session status for Indian Equities (NSE / BSE)
   * Standard trading hours: 9:15 AM - 3:30 PM IST (Monday - Friday)
   */
  public async getMarketStatus(exchange?: string): Promise<MarketStatusResponse> {
    const now = new Date();
    const isConfigured = this.isConfigured();
    const isAuthenticated = this.isAuthenticated();

    // Indian Standard Time calculation (Asia/Kolkata)
    const istTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istTimeStr);
    const day = istDate.getDay(); // 0 = Sun, 6 = Sat
    const hour = istDate.getHours();
    const minute = istDate.getMinutes();
    const timeMinutes = hour * 60 + minute;

    const isWeekday = day >= 1 && day <= 5;
    const isRegular = isWeekday && timeMinutes >= 9 * 60 + 15 && timeMinutes < 15 * 60 + 30;
    const isPre = isWeekday && timeMinutes >= 9 * 60 && timeMinutes < 9 * 60 + 15;
    const isPost = isWeekday && timeMinutes >= 15 * 60 + 30 && timeMinutes < 16 * 60;

    let session: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' = 'CLOSED';
    if (isRegular) session = 'REGULAR';
    else if (isPre) session = 'PRE';
    else if (isPost) session = 'POST';

    let status: 'CONNECTED' | 'SIMULATED' | 'UNCONFIGURED' | 'ERROR' = 'UNCONFIGURED';
    let epistemicStatus: EpistemicStatus = 'SIMULATED';
    let provider = 'India Simulated Pricing Engine (FYERS Unconfigured)';
    let isSimulated = true;

    if (!isConfigured) {
      status = 'UNCONFIGURED';
      epistemicStatus = 'SIMULATED';
      provider = 'India Simulated Pricing Engine (FYERS Unconfigured)';
      isSimulated = true;
    } else if (!isAuthenticated) {
      status = 'UNCONFIGURED';
      epistemicStatus = 'SIMULATED';
      provider = 'India Simulated Pricing Engine (FYERS Auth Required)';
      isSimulated = true;
    } else if (this.lastError) {
      status = 'ERROR';
      epistemicStatus = 'UNAVAILABLE';
      provider = 'FYERS';
      isSimulated = false;
    } else {
      status = 'CONNECTED';
      epistemicStatus = 'REAL';
      provider = 'FYERS';
      isSimulated = false;
    }

    return {
      market: 'INDIA',
      exchange: exchange || 'NSE',
      isOpen: isRegular,
      timezone: 'Asia/Kolkata',
      session,
      status,
      retrievedAt: now.toISOString(),
      provider,
      epistemicStatus,
      isSimulated
    };
  }
}

export const fyersMarketProvider = new FYERSMarketProvider();
