/**
 * FYERS Authentication & Token Lifecycle Service (Server-Side Only)
 * 
 * Manages FYERS API v3 credentials and access token state.
 * 
 * Security:
 * - Credentials (FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_ACCESS_TOKEN) are strictly server-side.
 * - Sensitive values are NEVER logged, exposed to client bundles, or returned in API responses.
 * 
 * Supported Health States:
 * - CONNECTED: Valid credentials, active token, successful connectivity
 * - AUTHENTICATION_REQUIRED: App ID configured but access token is missing, expired, or invalid
 * - RATE_LIMITED: API rate limit encountered (HTTP 429 / code -99)
 * - UNAVAILABLE: Upstream FYERS service unreachable
 * - ERROR: Network or API failure
 * - UNCONFIGURED: FYERS environment variables are not set
 */

export type FyersHealthStatus =
  | 'CONNECTED'
  | 'AUTHENTICATION_REQUIRED'
  | 'UNCONFIGURED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'ERROR';

export interface FyersCredentials {
  appId: string;
  secretKey?: string;
  accessToken?: string;
}

export interface FyersAuthHealth {
  provider: 'FYERS';
  market: 'INDIA';
  status: FyersHealthStatus;
  isSimulated: boolean;
  lastSuccessfulRequest: string | null;
  lastErrorCategory: string | null;
  checkedAt: string;
  details: string;
}

export class FYERSAuthService {
  private overrideCredentials?: FyersCredentials | null;
  private lastSuccessfulRequest: string | null = null;
  private lastErrorCategory: string | null = null;
  private lastErrorMessage: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(overrideCredentials?: FyersCredentials | null) {
    this.overrideCredentials = overrideCredentials;
  }

  /**
   * Set credential override (useful for testing, mocking, or sandbox runtime)
   */
  public setCredentialsOverride(override: FyersCredentials | null | undefined): void {
    this.overrideCredentials = override;
    if (override === null) {
      this.tokenExpiresAt = null;
      this.lastErrorCategory = null;
      this.lastErrorMessage = null;
    }
  }

  /**
   * Manually supply or rotate an active access token
   */
  public setAccessToken(token: string, expiresInSeconds: number = 86400): void {
    const creds = this.getRawCredentials();
    if (creds) {
      this.overrideCredentials = {
        ...creds,
        accessToken: token.trim()
      };
    } else {
      this.overrideCredentials = {
        appId: 'OVERRIDE-100',
        accessToken: token.trim()
      };
    }
    this.tokenExpiresAt = Date.now() + Math.max(60, expiresInSeconds - 300) * 1000;
    this.lastErrorCategory = null;
    this.lastErrorMessage = null;
  }

  /**
   * Internal reader for server-side credentials
   */
  private getRawCredentials(): FyersCredentials | null {
    if (this.overrideCredentials !== undefined) {
      return this.overrideCredentials;
    }

    const appId = (process.env.FYERS_APP_ID || process.env.FYERS_CLIENT_ID || '').trim();
    const secretKey = (process.env.FYERS_SECRET_KEY || process.env.FYERS_APP_SECRET || '').trim();
    const accessToken = (process.env.FYERS_ACCESS_TOKEN || '').trim();

    if (!appId && !accessToken) {
      return null;
    }

    return {
      appId,
      secretKey: secretKey || undefined,
      accessToken: accessToken || undefined
    };
  }

  /**
   * Checks whether FYERS base credentials (App ID) are configured
   */
  public isConfigured(): boolean {
    const creds = this.getRawCredentials();
    return Boolean(creds && (creds.appId || creds.accessToken));
  }

  /**
   * Checks whether FYERS has an access token available for API requests
   */
  public isAuthenticated(): boolean {
    const creds = this.getRawCredentials();
    if (!creds || !creds.accessToken) return false;
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      return false;
    }
    return true;
  }

  /**
   * Safe getter for sanitised credentials metadata (NEVER returns secretKey or token!)
   */
  public getSafeCredentialsMeta(): { isConfigured: boolean; hasAppId: boolean; hasToken: boolean; appIdMasked?: string } {
    const creds = this.getRawCredentials();
    if (!creds) {
      return { isConfigured: false, hasAppId: false, hasToken: false };
    }
    const hasAppId = Boolean(creds.appId);
    const hasToken = Boolean(creds.accessToken);
    let appIdMasked: string | undefined;
    if (creds.appId) {
      appIdMasked = creds.appId.length > 4
        ? `${creds.appId.slice(0, 2)}***${creds.appId.slice(-3)}`
        : '***';
    }
    return {
      isConfigured: hasAppId || hasToken,
      hasAppId,
      hasToken,
      appIdMasked
    };
  }

  /**
   * Generates official FYERS API v3 Authorization Header:
   * Format: `${appId}:${accessToken}` or `Bearer ${accessToken}`
   */
  public getAuthHeader(): string | null {
    const creds = this.getRawCredentials();
    if (!creds || !creds.accessToken) {
      return null;
    }

    const appId = creds.appId || 'APP_ID';
    return `${appId}:${creds.accessToken}`;
  }

  /**
   * Records a successful network interaction
   */
  public recordSuccess(): void {
    this.lastSuccessfulRequest = new Date().toISOString();
    this.lastErrorCategory = null;
    this.lastErrorMessage = null;
  }

  /**
   * Records an error category and message
   */
  public recordError(category: FyersHealthStatus, message?: string): void {
    this.lastErrorCategory = category;
    this.lastErrorMessage = message || null;
  }

  /**
   * Get health status matching requirements
   */
  public getHealthStatus(): FyersAuthHealth {
    const creds = this.getRawCredentials();
    const checkedAt = new Date().toISOString();

    if (!creds || (!creds.appId && !creds.accessToken)) {
      return {
        provider: 'FYERS',
        market: 'INDIA',
        status: 'UNCONFIGURED',
        isSimulated: true,
        lastSuccessfulRequest: this.lastSuccessfulRequest,
        lastErrorCategory: null,
        checkedAt,
        details: 'FYERS credentials unconfigured (FYERS_APP_ID / FYERS_ACCESS_TOKEN not set). Operating in simulated baseline mode.'
      };
    }

    if (!creds.accessToken) {
      return {
        provider: 'FYERS',
        market: 'INDIA',
        status: 'AUTHENTICATION_REQUIRED',
        isSimulated: true,
        lastSuccessfulRequest: this.lastSuccessfulRequest,
        lastErrorCategory: 'AUTHENTICATION_REQUIRED',
        checkedAt,
        details: 'FYERS App ID configured, but active FYERS_ACCESS_TOKEN is missing. Indian market data operates in simulated fallback until token is set.'
      };
    }

    if (this.lastErrorCategory === 'RATE_LIMITED') {
      return {
        provider: 'FYERS',
        market: 'INDIA',
        status: 'RATE_LIMITED',
        isSimulated: false,
        lastSuccessfulRequest: this.lastSuccessfulRequest,
        lastErrorCategory: 'RATE_LIMITED',
        checkedAt,
        details: `FYERS API rate limit reached: ${this.lastErrorMessage || 'Too many requests'}`
      };
    }

    if (this.lastErrorCategory === 'AUTHENTICATION_REQUIRED') {
      return {
        provider: 'FYERS',
        market: 'INDIA',
        status: 'AUTHENTICATION_REQUIRED',
        isSimulated: true,
        lastSuccessfulRequest: this.lastSuccessfulRequest,
        lastErrorCategory: 'AUTHENTICATION_REQUIRED',
        checkedAt,
        details: `FYERS access token rejected or expired: ${this.lastErrorMessage || 'Authentication required'}`
      };
    }

    if (this.lastErrorCategory === 'UNAVAILABLE') {
      return {
        provider: 'FYERS',
        market: 'INDIA',
        status: 'UNAVAILABLE',
        isSimulated: false,
        lastSuccessfulRequest: this.lastSuccessfulRequest,
        lastErrorCategory: 'UNAVAILABLE',
        checkedAt,
        details: `FYERS market data service unreachable: ${this.lastErrorMessage || 'Service unavailable'}`
      };
    }

    if (this.lastErrorCategory === 'ERROR') {
      return {
        provider: 'FYERS',
        market: 'INDIA',
        status: 'ERROR',
        isSimulated: false,
        lastSuccessfulRequest: this.lastSuccessfulRequest,
        lastErrorCategory: 'ERROR',
        checkedAt,
        details: `FYERS provider error: ${this.lastErrorMessage || 'Unknown error'}`
      };
    }

    return {
      provider: 'FYERS',
      market: 'INDIA',
      status: 'CONNECTED',
      isSimulated: false,
      lastSuccessfulRequest: this.lastSuccessfulRequest || checkedAt,
      lastErrorCategory: null,
      checkedAt,
      details: 'FYERS API v3 connected and authoritative for Indian equities (NSE/BSE).'
    };
  }

  /**
   * Reset internal error state and caches
   */
  public clearCache(): void {
    this.lastErrorCategory = null;
    this.lastErrorMessage = null;
  }
}

export const fyersAuthService = new FYERSAuthService();
