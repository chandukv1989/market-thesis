/**
 * India Market Data Provider (TrueData Market Data API - NSE / BSE)
 * 
 * Epistemic Model:
 * - When TRUEDATA_USERNAME and TRUEDATA_PASSWORD are configured and response is verified:
 *     provider: 'TrueData'
 *     epistemicStatus: 'REAL'
 *     isSimulated: false
 * - When unconfigured:
 *     provider: 'India Simulated Pricing Engine (Unconfigured Provider)'
 *     epistemicStatus: 'SIMULATED'
 *     isSimulated: true
 * - Historical OHLCV:
 *     Returns REAL bars when TrueData succeeds.
 *     Returns UNAVAILABLE when unconfigured or subscription limits occur.
 *     NEVER fabricates fake historical bars.
 * 
 * Security:
 * - TRUEDATA_USERNAME and TRUEDATA_PASSWORD are accessed strictly server-side.
 * - Credentials and tokens are NEVER logged, exposed to client bundles, or returned in API payloads.
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
import { FYERSMarketProvider, fyersMarketProvider } from './fyersMarketProvider';
export { INDIA_BASELINE_PRICES };
export type { CustomFetchFn } from './indiaMarketConstants';
import { INDIA_BASELINE_PRICES, type CustomFetchFn } from './indiaMarketConstants';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface TrueDataToken {
  token: string;
  expiresAt: number;
}

export class IndiaMarketProvider implements RegionalMarketProvider {
  public readonly market = 'INDIA' as const;
  public readonly supportedExchanges = ['NSE', 'BSE'];
  public readonly authUrl = 'https://auth.truedata.in/token';
  public readonly historyUrl = 'https://history.truedata.in';

  private lastError: string | null = null;
  private lastSuccessfulRetrieval: string | null = null;
  private customFetch?: CustomFetchFn;
  private overrideCredentials?: { username: string; password: string } | null;

  // Cached TrueData authentication bearer token
  private cachedToken: TrueDataToken | null = null;

  // In-memory caches to respect TrueData API request limits
  private quoteCache = new Map<string, CacheEntry<NormalizedQuote>>();
  private historyCache = new Map<string, CacheEntry<HistoricalPricesResponse>>();

  public fyersProvider: FYERSMarketProvider;

  constructor(
    customFetch?: CustomFetchFn,
    overrideCredentials?: { username: string; password: string } | null,
    fyersProviderInstance?: FYERSMarketProvider
  ) {
    this.customFetch = customFetch;
    this.overrideCredentials = overrideCredentials;
    this.fyersProvider = fyersProviderInstance || new FYERSMarketProvider(customFetch);
  }

  /**
   * Set custom fetch handler (useful for testing & offline sandboxes)
   */
  public setFetchHandler(customFetch?: CustomFetchFn) {
    this.customFetch = customFetch;
    this.fyersProvider.setFetchHandler(customFetch);
  }

  /**
   * Set or replace the FYERS provider instance
   */
  public setFyersProvider(provider: FYERSMarketProvider): void {
    this.fyersProvider = provider;
  }

  /**
   * Get the underlying FYERS provider instance
   */
  public getFyersProvider(): FYERSMarketProvider {
    return this.fyersProvider;
  }

  /**
   * Determine the active Indian equity provider
   * Priority: Explicit request > FYERS (if configured) > TrueData (if configured) > SIMULATED
   */
  public getActiveProvider(requestedProvider?: string): 'FYERS' | 'TrueData' | 'SIMULATED' {
    if (requestedProvider?.toUpperCase() === 'FYERS') return 'FYERS';
    if (requestedProvider?.toUpperCase() === 'TRUEDATA') return 'TrueData';
    if (this.overrideCredentials) return 'TrueData';
    if (this.fyersProvider.isConfigured()) return 'FYERS';
    if (this.isTrueDataConfigured()) return 'TrueData';
    return 'SIMULATED';
  }

  public isTrueDataConfigured(): boolean {
    return Boolean(this.getCredentials());
  }

  /**
   * Override credentials (set to null to simulate unconfigured state)
   */
  public setCredentialsOverride(overrideCredentials?: { username: string; password: string } | null): void {
    this.overrideCredentials = overrideCredentials;
    this.clearCache();
  }

  /**
   * Safe getter for TrueData credentials (never logs or exposes credentials)
   */
  private getCredentials(): { username: string; password: string } | null {
    if (this.overrideCredentials !== undefined) {
      return this.overrideCredentials;
    }
    const username = process.env.TRUEDATA_USERNAME || process.env.TRUEDATA_USER_ID;
    const password = process.env.TRUEDATA_PASSWORD || process.env.TRUEDATA_PASS;
    if (username && username.trim() && password && password.trim()) {
      return { username: username.trim(), password: password.trim() };
    }
    return null;
  }

  public isConfigured(): boolean {
    return Boolean(this.getCredentials()) || this.fyersProvider.isConfigured();
  }

  /**
   * Clear in-memory caches and tokens
   */
  public clearCache(): void {
    this.quoteCache.clear();
    this.historyCache.clear();
    this.cachedToken = null;
    this.fyersProvider.clearCache();
  }

  /**
   * Provider health check
   */
  public getHealthStatus(): ProviderHealth {
    const active = this.getActiveProvider();
    if (active === 'FYERS') {
      return this.fyersProvider.getHealthStatus();
    }

    const creds = this.getCredentials();
    const now = new Date().toISOString();

    if (!creds) {
      return {
        name: 'India Market Data (FYERS & TrueData)',
        status: 'UNCONFIGURED',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Simulated Baseline (FYERS/TRUEDATA Unconfigured)',
        details: 'India market data credentials (FYERS_APP_ID/FYERS_ACCESS_TOKEN or TRUEDATA_USERNAME/PASSWORD) are not configured. Indian equity quotes operate in simulated baseline fallback with explicit SIMULATED provenance.',
        isSimulated: true,
        provider: 'India Simulated Pricing Engine (Unconfigured Provider)',
        market: 'INDIA',
        checkedAt: now
      };
    }

    if (this.lastError) {
      return {
        name: 'India Market Data (TrueData)',
        status: 'Error',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Provider Error Reported',
        details: `TrueData error: ${this.lastError}`,
        isSimulated: false,
        provider: 'TrueData',
        market: 'INDIA',
        checkedAt: now,
        lastErrorCategory: 'ERROR'
      };
    }

    if (this.lastSuccessfulRetrieval) {
      return {
        name: 'India Market Data (TrueData)',
        status: 'Connected',
        lastSuccessfulRetrieval: this.lastSuccessfulRetrieval,
        dataFreshness: 'Live TrueData Connected',
        details: 'TrueData Market Data API connected and actively providing verified NSE/BSE quotes.',
        isSimulated: false,
        provider: 'TrueData',
        market: 'INDIA',
        checkedAt: now
      };
    }

    return {
      name: 'India Market Data (TrueData)',
      status: 'Connected',
      lastSuccessfulRetrieval: null,
      dataFreshness: 'Configured & Awaiting First Request',
      details: 'TRUEDATA credentials configured. Ready for authoritative live requests.',
      isSimulated: false,
      provider: 'TrueData',
      market: 'INDIA',
      checkedAt: now
    };
  }

  /**
   * Obtain TrueData Bearer Token via official OAuth2 password grant
   * POST https://auth.truedata.in/token
   */
  public async getAuthToken(): Promise<string | null> {
    const creds = this.getCredentials();
    if (!creds) return null;

    // Check cached token
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const fetchImpl = this.customFetch || fetch;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const params = new URLSearchParams();
      params.set('username', creds.username);
      params.set('password', creds.password);
      params.set('grant_type', 'password');

      const res = await fetchImpl(this.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const errData = await res.json();
          if (errData && errData.error_description) {
            detail = errData.error_description;
          } else if (errData && errData.error) {
            detail = errData.error;
          }
        } catch {}
        const errText = `TrueData authentication failed: HTTP ${res.status} - ${detail}`;
        this.lastError = errText;
        return null;
      }

      const data = await res.json();
      if (!data || !data.access_token) {
        this.lastError = 'TrueData auth response did not include access_token';
        return null;
      }

      const token = String(data.access_token);
      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 86400;
      // Expire cache 5 minutes early to avoid boundary race conditions
      const expiresAt = Date.now() + Math.max(60, expiresInSec - 300) * 1000;

      this.cachedToken = { token, expiresAt };
      this.lastError = null;
      return token;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.lastError = `TrueData authentication network error: ${errMsg}`;
      return null;
    }
  }

  /**
   * Format symbol for TrueData REST API
   * TrueData NSE equities are standard ticker names (e.g. RELIANCE, TCS, INFY)
   */
  public resolveProviderSymbol(requestSymbol: string, requestedExchange?: string): { symbol: string; exchange: string } {
    const sym = requestSymbol.toUpperCase().trim();
    const exchange = (requestedExchange?.toUpperCase() === 'BSE') ? 'BSE' : 'NSE';
    return { symbol: sym, exchange };
  }

  /**
   * Fetch Live Quote from TrueData or FYERS
   */
  public async getQuote(request: MarketDataRequest): Promise<NormalizedQuote> {
    const active = this.getActiveProvider(request.provider);
    if (active === 'FYERS') {
      return this.fyersProvider.getQuote(request);
    }

    const sym = request.symbol.toUpperCase().trim();
    const { symbol: tdSymbol, exchange } = this.resolveProviderSymbol(sym, request.exchange);
    const securityId = request.securityId || `in-${sym.toLowerCase()}`;
    const creds = this.getCredentials();
    const now = new Date().toISOString();

    const baseline = INDIA_BASELINE_PRICES[sym] || {
      price: 1000.0,
      change: 0.0,
      changePercent: 0.0,
      volume: '1.0M',
      marketCap: '₹5.0T',
      exchange
    };

    // 1. Unconfigured Fallback
    if (!creds) {
      return {
        ticker: sym,
        symbol: sym,
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
        provider: 'India Simulated Pricing Engine (Unconfigured Provider)',
        isSimulated: true,
        epistemicCategory: 'SIMULATED',
        epistemicStatus: 'SIMULATED',
        status: 'available'
      };
    }

    // 2. Check Quote Cache (TTL: 45 seconds)
    const cacheKey = `${tdSymbol}:${exchange}`;
    const cached = this.quoteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // 3. Acquire Token
    const token = await this.getAuthToken();
    if (!token) {
      return {
        ticker: sym,
        symbol: sym,
        securityId,
        price: baseline.price,
        change: baseline.change,
        changePercent: baseline.changePercent,
        marketCap: baseline.marketCap,
        currency: 'INR',
        market: 'INDIA',
        exchange: baseline.exchange,
        asOf: now,
        retrievedAt: now,
        provider: 'India Simulated Pricing Engine (TrueData Auth Fallback)',
        isSimulated: true,
        epistemicCategory: 'SIMULATED',
        epistemicStatus: 'SIMULATED',
        status: 'available',
        reason: this.lastError || 'TrueData authentication failed. Using simulated baseline.'
      };
    }

    // 4. Request latest bar/quote from TrueData
    const fetchImpl = this.customFetch || fetch;
    const url = new URL(`${this.historyUrl}/getlastbar`);
    url.searchParams.set('symbol', tdSymbol);
    url.searchParams.set('interval', '1min');
    url.searchParams.set('response', 'json');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = `TrueData HTTP ${res.status}: ${res.statusText}`;
        this.lastError = errorText;
        return {
          ticker: sym,
          symbol: sym,
          securityId,
          price: 0,
          change: 0,
          changePercent: 0,
          currency: 'INR',
          market: 'INDIA',
          exchange,
          asOf: now,
          retrievedAt: now,
          provider: 'TrueData',
          isSimulated: false,
          epistemicCategory: 'REAL',
          epistemicStatus: 'UNAVAILABLE',
          status: 'unavailable',
          reason: errorText
        };
      }

      const data = await res.json();

      // Parse TrueData record response
      // Handles records as array of arrays [time, open, high, low, close, volume, oi] or object
      let open = 0;
      let high = 0;
      let low = 0;
      let close = 0;
      let volume = 0;
      let timestamp = now;

      let record: any = null;
      if (Array.isArray(data) && data.length > 0) {
        record = data[0];
      } else if (data.Records && Array.isArray(data.Records) && data.Records.length > 0) {
        record = data.Records[0];
      } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        record = data.data[0];
      } else if (typeof data === 'object' && (data.close !== undefined || data.ltp !== undefined)) {
        record = data;
      }

      if (!record) {
        const reason = 'TrueData returned no quote data for symbol ' + sym;
        this.lastError = reason;
        return {
          ticker: sym,
          symbol: sym,
          securityId,
          price: 0,
          change: 0,
          changePercent: 0,
          currency: 'INR',
          market: 'INDIA',
          exchange,
          asOf: now,
          retrievedAt: now,
          provider: 'TrueData',
          isSimulated: false,
          epistemicCategory: 'REAL',
          epistemicStatus: 'UNAVAILABLE',
          status: 'unavailable',
          reason
        };
      }

      if (Array.isArray(record)) {
        // [time, open, high, low, close, volume, oi]
        timestamp = record[0] || now;
        open = parseFloat(record[1]) || 0;
        high = parseFloat(record[2]) || 0;
        low = parseFloat(record[3]) || 0;
        close = parseFloat(record[4]) || 0;
        volume = parseInt(record[5], 10) || 0;
      } else {
        timestamp = record.time || record.timestamp || now;
        open = parseFloat(record.open) || 0;
        high = parseFloat(record.high) || 0;
        low = parseFloat(record.low) || 0;
        close = parseFloat(record.close || record.ltp || record.price) || 0;
        volume = parseInt(record.volume, 10) || 0;
      }

      const change = open > 0 ? close - open : 0;
      const changePercent = open > 0 ? (change / open) * 100 : 0;
      const volFormatted = volume > 0 ? `${(volume / 1e6).toFixed(1)}M` : undefined;

      const normalized: NormalizedQuote = {
        ticker: sym,
        symbol: sym,
        securityId,
        price: close,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        volume: volFormatted,
        currency: 'INR',
        market: 'INDIA',
        exchange,
        asOf: String(timestamp),
        retrievedAt: now,
        provider: 'TrueData',
        isSimulated: false,
        epistemicCategory: 'REAL',
        epistemicStatus: 'REAL',
        status: 'available'
      };

      this.lastError = null;
      this.lastSuccessfulRetrieval = now;
      this.quoteCache.set(cacheKey, {
        data: normalized,
        expiresAt: Date.now() + 45000 // 45s TTL
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
        currency: 'INR',
        market: 'INDIA',
        exchange,
        asOf: now,
        retrievedAt: now,
        provider: 'TrueData',
        isSimulated: false,
        epistemicCategory: 'REAL',
        epistemicStatus: 'UNAVAILABLE',
        status: 'unavailable',
        reason: `Network/connection failure communicating with TrueData: ${errMsg}`
      };
    }
  }

  /**
   * Batch Quotes for Indian Equities
   */
  public async getQuotes(requests: (MarketDataRequest | string)[]): Promise<NormalizedQuote[]> {
    const active = this.getActiveProvider();
    if (active === 'FYERS') {
      return this.fyersProvider.getQuotes(requests);
    }
    return Promise.all(requests.map(r => this.getQuote(typeof r === 'string' ? { symbol: r } : r)));
  }

  /**
   * Fetch Historical OHLCV from TrueData or FYERS
   */
  public async getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse> {
    const active = this.getActiveProvider();
    if (active === 'FYERS') {
      return this.fyersProvider.getHistoricalPrices(request);
    }

    const sym = request.symbol.toUpperCase().trim();
    const { symbol: tdSymbol, exchange } = this.resolveProviderSymbol(sym, request.exchange);
    const securityId = request.securityId || `in-${sym.toLowerCase()}`;
    const creds = this.getCredentials();
    const now = new Date().toISOString();

    // 1. Unconfigured Fallback -> UNAVAILABLE (never synthesize fake bars)
    if (!creds) {
      return {
        securityId,
        symbol: sym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars: [],
        provider: 'India Simulated Pricing Engine (Unconfigured Provider)',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: true,
        status: 'unavailable',
        reason: 'Historical OHLCV data is UNAVAILABLE because TrueData credentials are unconfigured. Simulated baseline engine does not fabricate fake historical bars.'
      };
    }

    // 2. Map interval to TrueData supported values ('eod', '1min', '5min', '15min', 'week', 'month')
    let tdInterval = 'eod';
    switch (request.interval) {
      case '1m': tdInterval = '1min'; break;
      case '5m': tdInterval = '5min'; break;
      case '15m': tdInterval = '15min'; break;
      case '1h': tdInterval = '60min'; break;
      case '1d': tdInterval = 'eod'; break;
      case '1wk': tdInterval = 'week'; break;
      case '1mo': tdInterval = 'month'; break;
      default: tdInterval = 'eod'; break;
    }

    // 3. Format Date parameters in YYMMDDTHH:mm:ss
    const toDate = new Date();
    const fromDate = new Date();
    if (request.period === '1W') fromDate.setDate(toDate.getDate() - 7);
    else if (request.period === '1M') fromDate.setMonth(toDate.getMonth() - 1);
    else if (request.period === '3M') fromDate.setMonth(toDate.getMonth() - 3);
    else if (request.period === '1Y') fromDate.setFullYear(toDate.getFullYear() - 1);
    else if (request.period === '5Y') fromDate.setFullYear(toDate.getFullYear() - 5);
    else fromDate.setMonth(toDate.getMonth() - 1);

    const formatTdDate = (d: Date): string => {
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${yy}${mm}${dd}T${hh}:${min}:${ss}`;
    };

    const fromParam = formatTdDate(fromDate);
    const toParam = formatTdDate(toDate);

    const cacheKey = `${tdSymbol}:${tdInterval}:${fromParam}:${toParam}`;
    const cached = this.historyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const token = await this.getAuthToken();
    if (!token) {
      return {
        securityId,
        symbol: sym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars: [],
        provider: 'TrueData',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        status: 'unavailable',
        reason: this.lastError || 'TrueData authentication failed.'
      };
    }

    const fetchImpl = this.customFetch || fetch;
    const url = new URL(`${this.historyUrl}/getbars`);
    url.searchParams.set('symbol', tdSymbol);
    url.searchParams.set('interval', tdInterval);
    url.searchParams.set('from', fromParam);
    url.searchParams.set('to', toParam);
    url.searchParams.set('response', 'json');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = `TrueData HTTP ${res.status}: ${res.statusText}`;
        return {
          securityId,
          symbol: sym,
          market: 'INDIA',
          exchange,
          currency: 'INR',
          interval: request.interval || '1d',
          bars: [],
          provider: 'TrueData',
          retrievedAt: now,
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          status: 'unavailable',
          reason: errorText
        };
      }

      const data = await res.json();
      let records: any[] = [];
      if (Array.isArray(data)) {
        records = data;
      } else if (data.Records && Array.isArray(data.Records)) {
        records = data.Records;
      } else if (data.data && Array.isArray(data.data)) {
        records = data.data;
      }

      if (records.length === 0) {
        return {
          securityId,
          symbol: sym,
          market: 'INDIA',
          exchange,
          currency: 'INR',
          interval: request.interval || '1d',
          bars: [],
          provider: 'TrueData',
          retrievedAt: now,
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          status: 'unavailable',
          reason: 'No historical bars returned from TrueData for ' + sym
        };
      }

      const bars: HistoricalPriceBar[] = records
        .map((r) => {
          if (Array.isArray(r)) {
            // [timestamp, open, high, low, close, volume]
            const close = parseFloat(r[4]) || 0;
            return {
              timestamp: String(r[0]),
              open: parseFloat(r[1]) || 0,
              high: parseFloat(r[2]) || 0,
              low: parseFloat(r[3]) || 0,
              close,
              adjustedClose: close,
              volume: parseInt(r[5], 10) || 0,
              currency: 'INR',
              securityId,
              market: 'INDIA' as const,
              exchange,
              provider: 'TrueData',
              epistemicStatus: 'REAL' as const
            };
          } else {
            const close = parseFloat(r.close) || 0;
            return {
              timestamp: String(r.time || r.timestamp),
              open: parseFloat(r.open) || 0,
              high: parseFloat(r.high) || 0,
              low: parseFloat(r.low) || 0,
              close,
              adjustedClose: close,
              volume: parseInt(r.volume, 10) || 0,
              currency: 'INR',
              securityId,
              market: 'INDIA' as const,
              exchange,
              provider: 'TrueData',
              epistemicStatus: 'REAL' as const
            };
          }
        })
        .filter((b) => !isNaN(b.close) && b.close > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const response: HistoricalPricesResponse = {
        securityId,
        symbol: sym,
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars,
        provider: 'TrueData',
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
        market: 'INDIA',
        exchange,
        currency: 'INR',
        interval: request.interval || '1d',
        bars: [],
        provider: 'TrueData',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        status: 'unavailable',
        reason: `Failed to retrieve historical bars from TrueData: ${errMsg}`
      };
    }
  }

  /**
   * Session status for Indian Equities (NSE / BSE)
   * Standard trading hours: 9:15 AM - 3:30 PM IST (Monday - Friday)
   */
  public async getMarketStatus(exchange?: string): Promise<MarketStatusResponse> {
    const active = this.getActiveProvider();
    if (active === 'FYERS') {
      return this.fyersProvider.getMarketStatus(exchange);
    }

    const now = new Date();
    const isConfigured = this.isConfigured();

    // Calculate Indian Standard Time (Asia/Kolkata)
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
    let provider = 'India Simulated Pricing Engine (Unconfigured Provider)';
    let isSimulated = true;

    if (!isConfigured) {
      status = 'UNCONFIGURED';
      epistemicStatus = 'SIMULATED';
      provider = 'India Simulated Pricing Engine (Unconfigured Provider)';
      isSimulated = true;
    } else if (this.lastError) {
      status = 'ERROR';
      epistemicStatus = 'UNAVAILABLE';
      provider = 'TrueData';
      isSimulated = false;
    } else if (this.lastSuccessfulRetrieval) {
      status = 'CONNECTED';
      epistemicStatus = 'REAL';
      provider = 'TrueData';
      isSimulated = false;
    } else {
      // Validate connectivity before declaring live
      const token = await this.getAuthToken();
      if (!token) {
        status = 'ERROR';
        epistemicStatus = 'UNAVAILABLE';
        provider = 'TrueData';
        isSimulated = false;
      } else {
        status = 'CONNECTED';
        epistemicStatus = 'REAL';
        provider = 'TrueData';
        isSimulated = false;
      }
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

export const indiaMarketProvider = new IndiaMarketProvider();
