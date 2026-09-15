/**
 * Phase 16: PostgreSQL Persistence Adapter
 * 
 * Production adapter for real PostgreSQL database connections.
 * Automatically runs idempotent versioned migrations on initialization.
 */

import {
  IPersistenceAdapter,
  ISecurityRepository,
  IResearchDocumentRepository,
  IPersistentEvidenceRepository,
  IResearchNotebookRepository,
  IResearchSnapshotRepository,
  IDecisionRepository,
  IStrategyRepository,
  IBacktestRepository,
  IWatchlistRepository,
  IAlertRepository,
  IPortfolioRepository,
  IResearchQueryRepository
} from '../types';
import {
  PersistenceStatusResponse,
  PersistenceStatusCode,
  PersistenceProviderType
} from '../../../src/types';
import { PostgresClient } from './postgresClient';
import { MigrationRunner } from '../migrations/migrationRunner';
import {
  PostgresSecurityRepository,
  PostgresResearchDocumentRepository,
  PostgresEvidenceRepository,
  PostgresResearchNotebookRepository,
  PostgresResearchSnapshotRepository,
  PostgresDecisionRepository,
  PostgresStrategyRepository,
  PostgresBacktestRepository,
  PostgresWatchlistRepository,
  PostgresAlertRepository,
  PostgresPortfolioRepository,
  PostgresResearchQueryRepository
} from './postgresRepositories';
import { getDatabaseConfig } from '../databaseConfig';

export class PostgresPersistenceAdapter implements IPersistenceAdapter {
  public readonly status: PersistenceStatusCode = 'CONNECTED';
  public readonly provider: PersistenceProviderType = 'POSTGRES';

  private client: PostgresClient;
  private migrationRunner: MigrationRunner | null = null;
  private currentMigrationVersion = 0;

  private securityRepo!: ISecurityRepository;
  private documentRepo!: IResearchDocumentRepository;
  private evidenceRepo!: IPersistentEvidenceRepository;
  private notebookRepo!: IResearchNotebookRepository;
  private snapshotRepo!: IResearchSnapshotRepository;
  private decisionRepo!: IDecisionRepository;
  private strategyRepo!: IStrategyRepository;
  private backtestRepo!: IBacktestRepository;
  private watchlistRepo!: IWatchlistRepository;
  private alertRepo!: IAlertRepository;
  private portfolioRepo!: IPortfolioRepository;
  private queryRepo!: IResearchQueryRepository;

  constructor(client?: PostgresClient) {
    this.client = client || new PostgresClient();
  }

  public get isConnected(): boolean {
    return this.client.isConnected();
  }

  public async initialize(): Promise<void> {
    const connected = await this.client.connect();
    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL database.');
    }

    // Run migrations
    this.migrationRunner = new MigrationRunner(this.client.getPool());
    const migrationResult = await this.migrationRunner.runMigrations();
    this.currentMigrationVersion = migrationResult.currentVersion;

    // Instantiate repositories
    this.securityRepo = new PostgresSecurityRepository(this.client);
    this.documentRepo = new PostgresResearchDocumentRepository(this.client);
    this.evidenceRepo = new PostgresEvidenceRepository(this.client);
    this.notebookRepo = new PostgresResearchNotebookRepository(this.client);
    this.snapshotRepo = new PostgresResearchSnapshotRepository(this.client);
    this.decisionRepo = new PostgresDecisionRepository(this.client);
    this.strategyRepo = new PostgresStrategyRepository(this.client);
    this.backtestRepo = new PostgresBacktestRepository(this.client);
    this.watchlistRepo = new PostgresWatchlistRepository(this.client);
    this.alertRepo = new PostgresAlertRepository(this.client);
    this.portfolioRepo = new PostgresPortfolioRepository(this.client);
    this.queryRepo = new PostgresResearchQueryRepository(this.client);
  }

  public async shutdown(): Promise<void> {
    await this.client.close();
  }

  public async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }

  public async runTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.client.runTransaction(async () => {
      return work();
    });
  }

  public getSecurityRepository(): ISecurityRepository { return this.securityRepo; }
  public getDocumentRepository(): IResearchDocumentRepository { return this.documentRepo; }
  public getEvidenceRepository(): IPersistentEvidenceRepository { return this.evidenceRepo; }
  public getNotebookRepository(): IResearchNotebookRepository { return this.notebookRepo; }
  public getSnapshotRepository(): IResearchSnapshotRepository { return this.snapshotRepo; }
  public getDecisionRepository(): IDecisionRepository { return this.decisionRepo; }
  public getStrategyRepository(): IStrategyRepository { return this.strategyRepo; }
  public getBacktestRepository(): IBacktestRepository { return this.backtestRepo; }
  public getWatchlistRepository(): IWatchlistRepository { return this.watchlistRepo; }
  public getAlertRepository(): IAlertRepository { return this.alertRepo; }
  public getPortfolioRepository(): IPortfolioRepository { return this.portfolioRepo; }
  public getQueryRepository(): IResearchQueryRepository { return this.queryRepo; }

  public async getStatus(): Promise<PersistenceStatusResponse> {
    const config = getDatabaseConfig();

    let counts = {
      securities: 0,
      documents: 0,
      evidence: 0,
      notebooks: 0,
      snapshots: 0,
      decisions: 0,
      strategies: 0,
      backtests: 0,
      alerts: 0,
      queries: 0
    };

    if (this.isConnected) {
      try {
        const [
          securities,
          documents,
          evidence,
          notebooks,
          snapshots,
          decisions,
          strategies,
          backtests,
          alerts,
          queries
        ] = await Promise.all([
          this.securityRepo.count(),
          this.documentRepo.count(),
          this.evidenceRepo.count(),
          this.notebookRepo.count(),
          this.snapshotRepo.count(),
          this.decisionRepo.count(),
          this.strategyRepo.count(),
          this.backtestRepo.count(),
          this.alertRepo.count(),
          this.queryRepo.count()
        ]);
        counts = { securities, documents, evidence, notebooks, snapshots, decisions, strategies, backtests, alerts, queries };
      } catch (err) {
        console.error('[PostgresPersistenceAdapter] Failed to gather counts:', err);
      }
    }

    return {
      status: this.isConnected ? 'CONNECTED' : 'ERROR',
      provider: 'POSTGRES',
      environment: process.env.NODE_ENV || 'development',
      isPostgresConfigured: config.isConfigured,
      migrationVersion: this.currentMigrationVersion,
      entityCounts: counts,
      details: {
        diskBacked: true,
        schemaVersion: '1.0.0'
      }
    };
  }
}
