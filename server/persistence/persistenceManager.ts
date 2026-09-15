/**
 * Phase 16: Persistence Manager (Central Facade)
 * 
 * Manages database initialization, adapter selection (PostgreSQL vs Development Adapter),
 * seeding of canonical assets, and repository access.
 * 
 * Strict Guarantees:
 * - Credentials never leak.
 * - Always accurately reports adapter state in status endpoint.
 * - Seamless fallback to disk-backed DevelopmentPersistenceAdapter when PostgreSQL is unconfigured.
 */

import { IPersistenceAdapter } from './types';
import { getDatabaseConfig } from './databaseConfig';
import { PostgresPersistenceAdapter } from './postgres/postgresAdapter';
import { DevelopmentPersistenceAdapter } from './devAdapter/developmentPersistenceAdapter';
import { CANONICAL_SECURITIES } from '../../src/data/canonicalSecurities';
import { PersistenceStatusResponse } from '../../src/types';

export class PersistenceManager {
  private static instance: PersistenceManager;
  private adapter: IPersistenceAdapter | null = null;
  private isInitialized = false;

  public static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.adapter) {
      return;
    }

    const config = getDatabaseConfig();

    if (config.isConfigured) {
      try {
        console.log('[PersistenceManager] Attempting to connect to PostgreSQL database...');
        const pgAdapter = new PostgresPersistenceAdapter();
        await pgAdapter.initialize();
        this.adapter = pgAdapter;
        console.log('[PersistenceManager] Successfully connected to PostgreSQL.');
      } catch (err) {
        console.warn('[PersistenceManager] PostgreSQL connection failed, falling back to disk-backed Development Adapter:', err instanceof Error ? err.message : String(err));
        const devAdapter = new DevelopmentPersistenceAdapter();
        await devAdapter.initialize();
        this.adapter = devAdapter;
      }
    } else {
      console.log('[PersistenceManager] DATABASE_URL not configured. Initializing disk-backed Development Persistence Adapter.');
      const devAdapter = new DevelopmentPersistenceAdapter();
      await devAdapter.initialize();
      this.adapter = devAdapter;
    }

    this.isInitialized = true;

    // Seed canonical securities if repository is empty
    await this.seedInitialSecurities();
  }

  /**
   * Seed canonical securities from the canonical dataset if repo is empty
   */
  public async seedInitialSecurities(): Promise<void> {
    try {
      const secRepo = this.getAdapter().getSecurityRepository();
      const count = await secRepo.count();
      if (count === 0) {
        console.log(`[PersistenceManager] Seeding ${CANONICAL_SECURITIES.length} canonical securities into persistence...`);
        await secRepo.saveMany(CANONICAL_SECURITIES);
      }
    } catch (err) {
      console.error('[PersistenceManager] Error seeding canonical securities:', err);
    }
  }

  public getAdapter(): IPersistenceAdapter {
    if (!this.adapter) {
      // Auto-initialize development adapter synchronously in emergency
      const devAdapter = new DevelopmentPersistenceAdapter();
      devAdapter.initialize();
      this.adapter = devAdapter;
    }
    return this.adapter;
  }

  /**
   * Set custom adapter (primarily for testing)
   */
  public setAdapter(adapter: IPersistenceAdapter): void {
    this.adapter = adapter;
    this.isInitialized = true;
  }

  public async getStatus(): Promise<PersistenceStatusResponse> {
    return this.getAdapter().getStatus();
  }

  public async healthCheck(): Promise<boolean> {
    return this.getAdapter().healthCheck();
  }

  public async shutdown(): Promise<void> {
    if (this.adapter) {
      await this.adapter.shutdown();
      this.isInitialized = false;
    }
  }

  // Repository Accessors
  public getSecurityRepository() { return this.getAdapter().getSecurityRepository(); }
  public getDocumentRepository() { return this.getAdapter().getDocumentRepository(); }
  public getEvidenceRepository() { return this.getAdapter().getEvidenceRepository(); }
  public getNotebookRepository() { return this.getAdapter().getNotebookRepository(); }
  public getSnapshotRepository() { return this.getAdapter().getSnapshotRepository(); }
  public getDecisionRepository() { return this.getAdapter().getDecisionRepository(); }
  public getStrategyRepository() { return this.getAdapter().getStrategyRepository(); }
  public getBacktestRepository() { return this.getAdapter().getBacktestRepository(); }
  public getWatchlistRepository() { return this.getAdapter().getWatchlistRepository(); }
  public getAlertRepository() { return this.getAdapter().getAlertRepository(); }
  public getPortfolioRepository() { return this.getAdapter().getPortfolioRepository(); }
  public getQueryRepository() { return this.getAdapter().getQueryRepository(); }
  public runTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.getAdapter().runTransaction(work);
  }
}

export const persistenceManager = PersistenceManager.getInstance();
