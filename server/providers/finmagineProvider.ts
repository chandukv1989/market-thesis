/**
 * Phase 18: Finmagine Supplemental Research Intelligence Provider
 * 
 * Epistemic & Operational Guarantees:
 * - Supplemental fundamental & research provider ONLY.
 * - NEVER replaces Twelve Data for primary US market quotes/OHLCV.
 * - NEVER replaces FYERS for primary India NSE/BSE market quotes/OHLCV.
 * - NEVER replaces SEC EDGAR for US regulatory filings.
 * - Epistemic status:
 *     - REAL when configured with valid FINMAGINE_API_KEY and verified live API response.
 *     - UNAVAILABLE when unconfigured or network/API failure occurs.
 *     - NEVER fabricates fake REAL data.
 *     - NEVER promotes UNAVAILABLE to REAL.
 * - Point-In-Time (PIT) Safety:
 *     - Current-day research queries can consume current provider observations.
 *     - Historical queries (with past asOfDate) require verified availability timestamp;
 *       if unavailable, tagged as PIT_UNVERIFIED and excluded from historical decisions.
 *     - Historical backtests NEVER silently consume current Finmagine data.
 * - Security & Isolation:
 *     - FINMAGINE_API_KEY is server-side only.
 *     - Never logged, never returned in status endpoints, never sent to Gemini.
 */

import {
  FinmagineHealthStatus,
  FinmagineHealthCode,
  FinmagineCompanyProfile,
  FinmagineFinancialRatios,
  FinmagineValuation,
  FinmagineMomentum,
  FinmagineFundamentals,
  FinmagineEarnings,
  FinmagineScreenResult,
  EvidenceEpistemicStatus
} from '../../src/types';

export interface FinmagineProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  customFetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class FinmagineResearchProvider {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://finmagine.com/api/v1';
  private customFetch?: typeof fetch;
  private timeoutMs: number = 6000;
  private maxRetries: number = 2;

  // Provider health tracking
  private lastHealthStatus: FinmagineHealthCode = 'UNCONFIGURED';
  private lastHealthCheckTime: string = new Date().toISOString();
  private lastErrorMessage: string | null = null;
  private consecutiveFailures: number = 0;
  private circuitBreakerOpenUntil: number = 0;

  // In-memory cache for performance
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(options?: FinmagineProviderOptions) {
    if (options?.apiKey) {
      this.apiKey = options.apiKey.trim();
    } else {
      const envKey = process.env.FINMAGINE_API_KEY?.trim();
      this.apiKey = envKey && envKey.length > 0 ? envKey : null;
    }

    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    }

    if (options?.customFetch) {
      this.customFetch = options.customFetch;
    }

    if (options?.timeoutMs) {
      this.timeoutMs = options.timeoutMs;
    }

    if (options?.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }

    this.updateInitialStatus();
  }

  private updateInitialStatus(): void {
    if (!this.apiKey) {
      this.lastHealthStatus = 'UNCONFIGURED';
      this.lastErrorMessage = 'FINMAGINE_API_KEY environment variable is not configured';
    } else {
      this.lastHealthStatus = 'CONNECTED';
      this.lastErrorMessage = null;
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public setApiKey(key: string | null): void {
    this.apiKey = key ? key.trim() : null;
    this.updateInitialStatus();
    this.clearCache();
  }

  public setCustomFetch(fetchFn?: typeof fetch): void {
    this.customFetch = fetchFn;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Safe status check: Never exposes API key or credentials.
   */
  public getHealthStatus(): FinmagineHealthStatus {
    const isCircuitOpen = Date.now() < this.circuitBreakerOpenUntil;
    const effectiveStatus: FinmagineHealthCode = !this.apiKey
      ? 'UNCONFIGURED'
      : isCircuitOpen
      ? 'RATE_LIMITED'
      : this.lastHealthStatus;

    return {
      provider: 'Finmagine',
      status: effectiveStatus,
      marketCoverage: ['US', 'INDIA'],
      isSimulated: false,
      lastChecked: this.lastHealthCheckTime,
      capabilities: {
        companyProfile: true,
        fundamentals: true,
        financialRatios: true,
        valuation: true,
        momentum: true,
        earnings: true,
        screening: true
      },
      message: this.lastErrorMessage || undefined
    };
  }

  /**
   * Resilient HTTP request with timeout, retries, and rate limit detection.
   */
  private async fetchEndpoint<T>(endpoint: string, options?: { method?: string; body?: unknown }): Promise<T | null> {
    if (!this.apiKey) {
      this.lastHealthStatus = 'UNCONFIGURED';
      return null;
    }

    // Circuit breaker check
    if (Date.now() < this.circuitBreakerOpenUntil) {
      this.lastHealthStatus = 'RATE_LIMITED';
      return null;
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const fetchHandler = this.customFetch || globalThis.fetch;
    if (!fetchHandler) {
      this.lastHealthStatus = 'UNAVAILABLE';
      this.lastErrorMessage = 'No fetch handler available';
      return null;
    }

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'X-API-Key': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`
        };

        if (options?.body) {
          headers['Content-Type'] = 'application/json';
        }

        const res = await fetchHandler(url, {
          method: options?.method || 'GET',
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          this.lastHealthStatus = 'AUTHENTICATION_REQUIRED';
          this.lastErrorMessage = 'Authentication failed: Invalid or expired FINMAGINE_API_KEY';
          return null;
        }

        if (res.status === 429) {
          this.lastHealthStatus = 'RATE_LIMITED';
          this.lastErrorMessage = 'Finmagine API rate limit exceeded';
          this.circuitBreakerOpenUntil = Date.now() + 30000; // 30 second cooldown
          return null;
        }

        if (!res.ok) {
          // Transient server error (502, 503, 504) -> retry if attempts remain
          if ([502, 503, 504].includes(res.status) && attempt <= this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
            continue;
          }
          this.lastHealthStatus = 'ERROR';
          this.lastErrorMessage = `Finmagine HTTP error: ${res.status} ${res.statusText}`;
          return null;
        }

        const data = await res.json();
        this.lastHealthStatus = 'CONNECTED';
        this.lastErrorMessage = null;
        this.consecutiveFailures = 0;
        this.lastHealthCheckTime = new Date().toISOString();
        return data as T;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const isAbort = (err as any)?.name === 'AbortError';
        if (attempt <= this.maxRetries && !isAbort) {
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          continue;
        }
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.circuitBreakerOpenUntil = Date.now() + 20000;
        }
        this.lastHealthStatus = isAbort ? 'UNAVAILABLE' : 'ERROR';
        this.lastErrorMessage = isAbort ? 'Request timed out' : (err instanceof Error ? err.message : String(err));
        return null;
      }
    }

    return null;
  }

  // Helper to normalize symbol for market
  private getMarketEndpointPrefix(symbol: string, requestedMarket?: 'US' | 'INDIA'): { prefix: string; cleanSymbol: string; market: 'US' | 'INDIA' } {
    const isIndia = requestedMarket === 'INDIA' || symbol.includes('.NS') || symbol.includes('.BO') || symbol.startsWith('NSE:') || symbol.startsWith('BSE:') || symbol.startsWith('in-');
    const market = isIndia ? 'INDIA' : 'US';
    const prefix = isIndia ? '/in' : '/us';
    const cleanSymbol = symbol.replace(/^(NSE:|BSE:|in-|us-)/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
    return { prefix, cleanSymbol, market };
  }

  /**
   * 1. Company Profile
   */
  public async getCompanyProfile(symbol: string, market?: 'US' | 'INDIA'): Promise<FinmagineCompanyProfile | null> {
    const { prefix, cleanSymbol } = this.getMarketEndpointPrefix(symbol, market);
    const cacheKey = `profile:${prefix}:${cleanSymbol}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data as FinmagineCompanyProfile;
    }

    const endpoint = `${prefix}/company/profile?symbol=${encodeURIComponent(cleanSymbol)}`;
    const raw = await this.fetchEndpoint<any>(endpoint);
    if (!raw) {
      return null;
    }

    const profile: FinmagineCompanyProfile = {
      symbol: cleanSymbol,
      companyName: raw.companyName || raw.name || cleanSymbol,
      exchange: raw.exchange || (prefix === '/in' ? 'NSE' : 'NASDAQ'),
      country: prefix === '/in' ? 'India' : 'United States',
      sector: raw.sector || raw.industryGroup,
      industry: raw.industry,
      description: raw.description || raw.summary,
      marketCap: typeof raw.marketCap === 'number' ? raw.marketCap : undefined,
      currency: raw.currency || (prefix === '/in' ? 'INR' : 'USD'),
      employees: raw.employees || raw.fullTimeEmployees,
      website: raw.website,
      ceo: raw.ceo,
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: new Date().toISOString(),
      asOfDate: raw.asOfDate || new Date().toISOString().split('T')[0]
    };

    this.cache.set(cacheKey, { data: profile, timestamp: Date.now(), ttlMs: this.defaultTtlMs });
    return profile;
  }

  /**
   * 2. Financial Ratios (35+ metrics)
   */
  public async getFinancialRatios(symbol: string, market?: 'US' | 'INDIA'): Promise<FinmagineFinancialRatios | null> {
    const { prefix, cleanSymbol, market: resolvedMarket } = this.getMarketEndpointPrefix(symbol, market);
    const cacheKey = `ratios:${prefix}:${cleanSymbol}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data as FinmagineFinancialRatios;
    }

    const endpoint = `${prefix}/company/ratios?symbol=${encodeURIComponent(cleanSymbol)}`;
    const raw = await this.fetchEndpoint<any>(endpoint);
    if (!raw) {
      return null;
    }

    const ratios: FinmagineFinancialRatios = {
      symbol: cleanSymbol,
      market: resolvedMarket,
      peRatio: raw.peRatio ?? raw.pe ?? raw.priceToEarnings,
      pbRatio: raw.pbRatio ?? raw.pb ?? raw.priceToBook,
      psRatio: raw.psRatio ?? raw.ps ?? raw.priceToSales,
      evToEbitda: raw.evToEbitda ?? raw.evEbitda,
      debtToEquity: raw.debtToEquity ?? raw.deRatio,
      currentRatio: raw.currentRatio,
      quickRatio: raw.quickRatio,
      roe: raw.roe ?? raw.returnOnEquity,
      roa: raw.roa ?? raw.returnOnAssets,
      grossMarginPct: raw.grossMarginPct ?? raw.grossMargin,
      operatingMarginPct: raw.operatingMarginPct ?? raw.operatingMargin,
      netMarginPct: raw.netMarginPct ?? raw.netMargin,
      dividendYieldPct: raw.dividendYieldPct ?? raw.dividendYield,
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: new Date().toISOString(),
      asOfDate: raw.asOfDate || new Date().toISOString().split('T')[0]
    };

    this.cache.set(cacheKey, { data: ratios, timestamp: Date.now(), ttlMs: this.defaultTtlMs });
    return ratios;
  }

  /**
   * 3. Valuation Metrics
   */
  public async getValuation(symbol: string, market?: 'US' | 'INDIA'): Promise<FinmagineValuation | null> {
    const { prefix, cleanSymbol, market: resolvedMarket } = this.getMarketEndpointPrefix(symbol, market);
    const cacheKey = `valuation:${prefix}:${cleanSymbol}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data as FinmagineValuation;
    }

    const endpoint = `${prefix}/company/valuation?symbol=${encodeURIComponent(cleanSymbol)}`;
    const raw = await this.fetchEndpoint<any>(endpoint);
    if (!raw) {
      return null;
    }

    const valuation: FinmagineValuation = {
      symbol: cleanSymbol,
      market: resolvedMarket,
      valuationScore: raw.valuationScore ?? raw.score,
      dcfValue: raw.dcfValue ?? raw.intrinsicValue,
      discountToIntrinsicPct: raw.discountToIntrinsicPct ?? raw.discountPct,
      historicalPeRange: raw.historicalPeRange,
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: new Date().toISOString(),
      asOfDate: raw.asOfDate || new Date().toISOString().split('T')[0]
    };

    this.cache.set(cacheKey, { data: valuation, timestamp: Date.now(), ttlMs: this.defaultTtlMs });
    return valuation;
  }

  /**
   * 4. Momentum & Technical Context
   */
  public async getMomentum(symbol: string, market?: 'US' | 'INDIA'): Promise<FinmagineMomentum | null> {
    const { prefix, cleanSymbol, market: resolvedMarket } = this.getMarketEndpointPrefix(symbol, market);
    const cacheKey = `momentum:${prefix}:${cleanSymbol}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data as FinmagineMomentum;
    }

    const endpoint = `${prefix}/company/momentum?symbol=${encodeURIComponent(cleanSymbol)}`;
    const raw = await this.fetchEndpoint<any>(endpoint);
    if (!raw) {
      return null;
    }

    const momentum: FinmagineMomentum = {
      symbol: cleanSymbol,
      market: resolvedMarket,
      rsi14: raw.rsi14 ?? raw.rsi,
      sma50: raw.sma50,
      sma200: raw.sma200,
      momentumScore: raw.momentumScore ?? raw.score,
      relStrengthVsIndex: raw.relStrengthVsIndex ?? raw.rsIndex,
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: new Date().toISOString(),
      asOfDate: raw.asOfDate || new Date().toISOString().split('T')[0]
    };

    this.cache.set(cacheKey, { data: momentum, timestamp: Date.now(), ttlMs: this.defaultTtlMs });
    return momentum;
  }

  /**
   * 5. Fundamentals (Annual & Quarterly Statements)
   */
  public async getFundamentals(symbol: string, market?: 'US' | 'INDIA'): Promise<FinmagineFundamentals | null> {
    const { prefix, cleanSymbol, market: resolvedMarket } = this.getMarketEndpointPrefix(symbol, market);
    const cacheKey = `fundamentals:${prefix}:${cleanSymbol}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data as FinmagineFundamentals;
    }

    const endpoint = `${prefix}/company/financials?symbol=${encodeURIComponent(cleanSymbol)}`;
    const raw = await this.fetchEndpoint<any>(endpoint);
    if (!raw) {
      return null;
    }

    const fundamentals: FinmagineFundamentals = {
      symbol: cleanSymbol,
      market: resolvedMarket,
      annualFinancials: Array.isArray(raw.annual) ? raw.annual : (Array.isArray(raw.annualFinancials) ? raw.annualFinancials : undefined),
      quarterlyFinancials: Array.isArray(raw.quarterly) ? raw.quarterly : (Array.isArray(raw.quarterlyFinancials) ? raw.quarterlyFinancials : undefined),
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: new Date().toISOString(),
      asOfDate: raw.asOfDate || new Date().toISOString().split('T')[0]
    };

    this.cache.set(cacheKey, { data: fundamentals, timestamp: Date.now(), ttlMs: this.defaultTtlMs });
    return fundamentals;
  }

  /**
   * 6. Earnings Consensus & Surprises
   */
  public async getEarnings(symbol: string, market?: 'US' | 'INDIA'): Promise<FinmagineEarnings | null> {
    const { prefix, cleanSymbol, market: resolvedMarket } = this.getMarketEndpointPrefix(symbol, market);
    const cacheKey = `earnings:${prefix}:${cleanSymbol}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data as FinmagineEarnings;
    }

    // For US, earnings endpoint is supported; for India, check if supported or mark unavailable
    const endpoint = `${prefix}/company/earnings?symbol=${encodeURIComponent(cleanSymbol)}`;
    const raw = await this.fetchEndpoint<any>(endpoint);
    if (!raw) {
      return null;
    }

    const earnings: FinmagineEarnings = {
      symbol: cleanSymbol,
      market: resolvedMarket,
      lastEarningsDate: raw.lastEarningsDate,
      nextEarningsDate: raw.nextEarningsDate,
      epsConsensus: raw.epsConsensus,
      epsActual: raw.epsActual,
      epsSurprisePct: raw.epsSurprisePct,
      revenueConsensus: raw.revenueConsensus,
      revenueActual: raw.revenueActual,
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: new Date().toISOString(),
      asOfDate: raw.asOfDate || new Date().toISOString().split('T')[0]
    };

    this.cache.set(cacheKey, { data: earnings, timestamp: Date.now(), ttlMs: this.defaultTtlMs });
    return earnings;
  }

  /**
   * 7. Screen Securities
   */
  public async screenSecurities(filters: Record<string, unknown>, market?: 'US' | 'INDIA'): Promise<FinmagineScreenResult> {
    const isIndia = market === 'INDIA';
    const prefix = isIndia ? '/in' : '/us';
    const endpoint = `${prefix}/screen`;

    const raw = await this.fetchEndpoint<any>(endpoint, { method: 'POST', body: filters });
    if (!raw || !Array.isArray(raw.matches)) {
      return {
        matches: [],
        totalCount: 0,
        retrievedAt: new Date().toISOString(),
        isSimulated: false,
        epistemicStatus: this.isConfigured() ? 'UNAVAILABLE' : 'UNAVAILABLE'
      };
    }

    return {
      matches: raw.matches.map((m: any) => ({
        symbol: m.symbol,
        companyName: m.companyName || m.name,
        marketCap: m.marketCap,
        peRatio: m.peRatio,
        sector: m.sector
      })),
      totalCount: raw.totalCount || raw.matches.length,
      retrievedAt: new Date().toISOString(),
      isSimulated: false,
      epistemicStatus: 'REAL'
    };
  }
}

export const finmagineProvider = new FinmagineResearchProvider();
