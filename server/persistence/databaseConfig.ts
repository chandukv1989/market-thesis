/**
 * Phase 16: Database Configuration & Credential Isolation
 * 
 * Rules:
 * - DATABASE_URL is strictly server-side.
 * - Never logged.
 * - Never exposed via status endpoints or client bundles.
 */

export interface DatabaseConfig {
  databaseUrl: string | null;
  isConfigured: boolean;
  ssl: boolean;
  maxConnections: number;
  connectionTimeoutMillis: number;
}

export function getDatabaseConfig(): DatabaseConfig {
  const rawUrl = process.env.DATABASE_URL?.trim();
  const isConfigured = Boolean(rawUrl && rawUrl.startsWith('postgres'));

  return {
    databaseUrl: isConfigured ? (rawUrl as string) : null,
    isConfigured,
    ssl: rawUrl?.includes('sslmode=require') || process.env.NODE_ENV === 'production',
    maxConnections: 10,
    connectionTimeoutMillis: 5000
  };
}

/**
 * Returns safe connection metadata without password or credentials
 */
export function getSafeConnectionSummary(config: DatabaseConfig): {
  configured: boolean;
  host?: string;
  database?: string;
  ssl: boolean;
} {
  if (!config.isConfigured || !config.databaseUrl) {
    return { configured: false, ssl: false };
  }

  try {
    const parsed = new URL(config.databaseUrl);
    return {
      configured: true,
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, ''),
      ssl: config.ssl
    };
  } catch {
    return { configured: true, ssl: config.ssl };
  }
}
