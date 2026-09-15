/**
 * Phase 16: PostgreSQL Database Client Wrapper
 * 
 * Safely wraps pg.Pool with:
 * - Credential protection
 * - Automatic query execution & parameterization
 * - Safe transaction boundaries with automatic ROLLBACK on failure
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseConfig, getDatabaseConfig } from '../databaseConfig';

export class PostgresClient {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this.config = config || getDatabaseConfig();
  }

  public async connect(): Promise<boolean> {
    if (!this.config.isConfigured || !this.config.databaseUrl) {
      return false;
    }

    try {
      this.pool = new Pool({
        connectionString: this.config.databaseUrl,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
        max: this.config.maxConnections,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis
      });

      // Smoke test query
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1 AS health_check;');
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[PostgresClient] Connection failed:', err instanceof Error ? err.message : String(err));
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }
      return false;
    }
  }

  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('PostgresClient is not connected. Call connect() first or verify DATABASE_URL.');
    }
    return this.pool;
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      await this.query('SELECT 1 AS health;');
      return true;
    } catch {
      return false;
    }
  }

  public async query<R extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
    if (!this.pool) {
      throw new Error('Cannot execute query: PostgreSQL pool is not connected.');
    }
    return this.pool.query<R>(text, params);
  }

  public async runTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Cannot run transaction: PostgreSQL pool is not connected.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
