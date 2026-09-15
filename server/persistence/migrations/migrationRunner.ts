/**
 * Phase 16: Database Migration Runner
 * 
 * Executes versioned migrations idempotently against PostgreSQL.
 * Records versions in schema_migrations.
 */

import { Pool } from 'pg';
import { MIGRATIONS, Migration } from './schema';

export class MigrationRunner {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Run pending migrations.
   */
  public async runMigrations(): Promise<{ applied: number; currentVersion: number }> {
    const client = await this.pool.connect();
    try {
      // 1. Ensure schema_migrations exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 2. Fetch applied versions
      const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC;');
      const appliedVersions = new Set<number>(res.rows.map(r => Number(r.version)));

      let appliedCount = 0;

      // 3. Apply pending migrations sequentially in a transaction
      for (const migration of MIGRATIONS) {
        if (!appliedVersions.has(migration.version)) {
          await client.query('BEGIN');
          try {
            for (const sql of migration.up) {
              await client.query(sql);
            }
            await client.query(
              'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW());',
              [migration.version, migration.name]
            );
            await client.query('COMMIT');
            appliedCount++;
          } catch (err) {
            await client.query('ROLLBACK');
            throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // 4. Get current version
      const verRes = await client.query('SELECT COALESCE(MAX(version), 0) AS max_ver FROM schema_migrations;');
      const currentVersion = Number(verRes.rows[0]?.max_ver || 0);

      return { applied: appliedCount, currentVersion };
    } finally {
      client.release();
    }
  }

  /**
   * Inspect current migration version without modifying schema
   */
  public async getCurrentVersion(): Promise<number> {
    try {
      const res = await this.pool.query('SELECT COALESCE(MAX(version), 0) AS max_ver FROM schema_migrations;');
      return Number(res.rows[0]?.max_ver || 0);
    } catch {
      return 0;
    }
  }
}
