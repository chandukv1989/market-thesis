/**
 * Phase 18: Production Environment Configuration & Diagnostics
 * 
 * Rules:
 * - Validates required and optional configuration keys for development, test, and production.
 * - Credential Isolation: NEVER exposes raw secret values in summaries or diagnostic responses.
 * - Server-side only.
 */

export type EnvironmentMode = 'development' | 'test' | 'production';
export type ConfigKeyStatus = 'CONFIGURED' | 'NOT_CONFIGURED' | 'INVALID';

export interface EnvironmentConfigSummary {
  nodeEnv: EnvironmentMode;
  appUrl: string;
  isProduction: boolean;
  keys: {
    DATABASE_URL: ConfigKeyStatus;
    GEMINI_API_KEY: ConfigKeyStatus;
    TWELVE_DATA_API_KEY: ConfigKeyStatus;
    FYERS_APP_ID: ConfigKeyStatus;
    FYERS_SECRET_KEY: ConfigKeyStatus;
    FYERS_ACCESS_TOKEN: ConfigKeyStatus;
    FINMAGINE_API_KEY: ConfigKeyStatus;
    SEC_API_USER_AGENT: ConfigKeyStatus;
    APP_URL: ConfigKeyStatus;
    SESSION_SECRET: ConfigKeyStatus;
  };
  providers: {
    gemini: { configured: boolean };
    secEdgar: { configured: boolean; userAgentDeclared: boolean };
    twelveData: { configured: boolean };
    fyers: { configured: boolean; tokenConfigured: boolean };
    finmagine: { configured: boolean };
    postgres: { configured: boolean };
  };
  validationErrors: string[];
}

export class EnvironmentConfigService {
  private static instance: EnvironmentConfigService;

  public static getInstance(): EnvironmentConfigService {
    if (!EnvironmentConfigService.instance) {
      EnvironmentConfigService.instance = new EnvironmentConfigService();
    }
    return EnvironmentConfigService.instance;
  }

  public getEnvironmentMode(): EnvironmentMode {
    const env = process.env.NODE_ENV?.toLowerCase() || 'development';
    if (env === 'production' || env === 'prod') return 'production';
    if (env === 'test') return 'test';
    return 'development';
  }

  private evaluateStatus(val: string | undefined, validator?: (v: string) => boolean): ConfigKeyStatus {
    if (!val || !val.trim()) return 'NOT_CONFIGURED';
    if (validator && !validator(val.trim())) return 'INVALID';
    return 'CONFIGURED';
  }

  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const isProd = this.getEnvironmentMode() === 'production';

    // Gemini API Key validation
    if (!process.env.GEMINI_API_KEY?.trim()) {
      errors.push('GEMINI_API_KEY is not configured');
    }

    // SEC User Agent validation
    if (!process.env.SEC_API_USER_AGENT?.trim()) {
      errors.push('SEC_API_USER_AGENT is not declared (SEC requires contact email)');
    } else if (!process.env.SEC_API_USER_AGENT.includes('@')) {
      errors.push('SEC_API_USER_AGENT is invalid (must include a valid contact email)');
    }

    // In production, warn if database is not set
    if (isProd && !process.env.DATABASE_URL?.trim()) {
      errors.push('Production environment detected but DATABASE_URL is not configured (using development disk fallback)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Returns safe environment diagnostics without leaking secret strings.
   */
  public getSafeSummary(): EnvironmentConfigSummary {
    const validation = this.validateConfiguration();

    return {
      nodeEnv: this.getEnvironmentMode(),
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      isProduction: this.getEnvironmentMode() === 'production',
      keys: {
        DATABASE_URL: this.evaluateStatus(process.env.DATABASE_URL, (u) => u.startsWith('postgres://') || u.startsWith('postgresql://')),
        GEMINI_API_KEY: this.evaluateStatus(process.env.GEMINI_API_KEY, (k) => k.length >= 10),
        TWELVE_DATA_API_KEY: this.evaluateStatus(process.env.TWELVE_DATA_API_KEY),
        FYERS_APP_ID: this.evaluateStatus(process.env.FYERS_APP_ID),
        FYERS_SECRET_KEY: this.evaluateStatus(process.env.FYERS_SECRET_KEY),
        FYERS_ACCESS_TOKEN: this.evaluateStatus(process.env.FYERS_ACCESS_TOKEN),
        FINMAGINE_API_KEY: this.evaluateStatus(process.env.FINMAGINE_API_KEY),
        SEC_API_USER_AGENT: this.evaluateStatus(process.env.SEC_API_USER_AGENT, (u) => u.includes('@')),
        APP_URL: this.evaluateStatus(process.env.APP_URL),
        SESSION_SECRET: this.evaluateStatus(process.env.SESSION_SECRET)
      },
      providers: {
        gemini: { configured: Boolean(process.env.GEMINI_API_KEY?.trim()) },
        secEdgar: {
          configured: Boolean(process.env.SEC_API_USER_AGENT?.trim()),
          userAgentDeclared: Boolean(process.env.SEC_API_USER_AGENT?.includes('@'))
        },
        twelveData: { configured: Boolean(process.env.TWELVE_DATA_API_KEY?.trim()) },
        fyers: {
          configured: Boolean(process.env.FYERS_APP_ID?.trim() && process.env.FYERS_SECRET_KEY?.trim()),
          tokenConfigured: Boolean(process.env.FYERS_ACCESS_TOKEN?.trim())
        },
        finmagine: { configured: Boolean(process.env.FINMAGINE_API_KEY?.trim()) },
        postgres: { configured: Boolean(process.env.DATABASE_URL?.trim()) }
      },
      validationErrors: validation.errors
    };
  }
}

export const environmentConfigService = EnvironmentConfigService.getInstance();
