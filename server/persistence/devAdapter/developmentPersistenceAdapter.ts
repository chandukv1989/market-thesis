/**
 * Phase 16: Disk-Backed Development Persistence Adapter
 * 
 * Provides robust persistence for the development environment.
 * Backed by atomic disk serialization to survive server restarts and process reinitializations.
 * 
 * Strict invariants:
 * - Accurately reports status: 'DEVELOPMENT_ADAPTER', provider: 'DISK_STORAGE'.
 * - NEVER claims to be PostgreSQL.
 * - Historical artifacts (Evidence, Snapshots, Decisions, Backtests) are immutable.
 * - Point-in-time filtering strictly respected.
 */

import fs from 'fs';
import path from 'path';
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
  CanonicalSecurity,
  ResearchDocument,
  EvidenceItem,
  EvidenceFilter,
  ResearchNotebook,
  ResearchSnapshot,
  InvestmentDecisionAssessment,
  Strategy,
  BacktestResult,
  AlertItem,
  HoldingPosition,
  ResearchQueryItem,
  DocumentProcessingStatus,
  PersistenceStatusResponse,
  PersistenceStatusCode,
  PersistenceProviderType
} from '../../../src/types';

interface PersistentStoreState {
  version: number;
  lastPersistedAt: string;
  securities: Record<string, CanonicalSecurity>;
  documents: Record<string, ResearchDocument>;
  evidence: Record<string, EvidenceItem>;
  notebooks: Record<string, ResearchNotebook>;
  snapshots: Record<string, ResearchSnapshot>;
  decisions: Record<string, InvestmentDecisionAssessment>;
  strategies: Record<string, Strategy>;
  backtests: Record<string, BacktestResult>;
  watchlists: Record<string, string[]>;
  alerts: Record<string, AlertItem>;
  portfolio: Record<string, HoldingPosition[]>;
  queries: Record<string, ResearchQueryItem>;
}

export class DevelopmentPersistenceAdapter implements IPersistenceAdapter {
  public readonly status: PersistenceStatusCode = 'DEVELOPMENT_ADAPTER';
  public readonly provider: PersistenceProviderType = 'DISK_STORAGE';
  public isConnected = true;

  private storageDir: string;
  private storageFile: string;
  private state: PersistentStoreState;

  private securityRepo: ISecurityRepository;
  private documentRepo: IResearchDocumentRepository;
  private evidenceRepo: IPersistentEvidenceRepository;
  private notebookRepo: IResearchNotebookRepository;
  private snapshotRepo: IResearchSnapshotRepository;
  private decisionRepo: IDecisionRepository;
  private strategyRepo: IStrategyRepository;
  private backtestRepo: IBacktestRepository;
  private watchlistRepo: IWatchlistRepository;
  private alertRepo: IAlertRepository;
  private portfolioRepo: IPortfolioRepository;
  private queryRepo: IResearchQueryRepository;

  constructor(customStorageDir?: string) {
    this.storageDir = customStorageDir || path.resolve(process.cwd(), 'data', 'persistence');
    this.storageFile = path.join(this.storageDir, 'store.json');

    this.state = this.createEmptyState();

    // Initialize repositories
    this.securityRepo = this.createSecurityRepo();
    this.documentRepo = this.createDocumentRepo();
    this.evidenceRepo = this.createEvidenceRepo();
    this.notebookRepo = this.createNotebookRepo();
    this.snapshotRepo = this.createSnapshotRepo();
    this.decisionRepo = this.createDecisionRepo();
    this.strategyRepo = this.createStrategyRepo();
    this.backtestRepo = this.createBacktestRepo();
    this.watchlistRepo = this.createWatchlistRepo();
    this.alertRepo = this.createAlertRepo();
    this.portfolioRepo = this.createPortfolioRepo();
    this.queryRepo = this.createQueryRepo();
  }

  private createEmptyState(): PersistentStoreState {
    return {
      version: 1,
      lastPersistedAt: new Date().toISOString(),
      securities: {},
      documents: {},
      evidence: {},
      notebooks: {},
      snapshots: {},
      decisions: {},
      strategies: {},
      backtests: {},
      watchlists: { default: [] },
      alerts: {},
      portfolio: { default: [] },
      queries: {}
    };
  }

  public async initialize(): Promise<void> {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          this.state = {
            ...this.createEmptyState(),
            ...parsed
          };
        }
      } else {
        this.flushToDisk();
      }
      this.isConnected = true;
    } catch (err) {
      console.error('[DevelopmentPersistenceAdapter] Failed to load store:', err);
      this.state = this.createEmptyState();
      this.isConnected = true;
    }
  }

  public async shutdown(): Promise<void> {
    this.flushToDisk();
  }

  public async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }

  public async runTransaction<T>(work: () => Promise<T>): Promise<T> {
    // Development adapter executes work and flushes on success
    const result = await work();
    this.flushToDisk();
    return result;
  }

  public flushToDisk(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      this.state.lastPersistedAt = new Date().toISOString();
      const tmpFile = `${this.storageFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmpFile, this.storageFile);
    } catch (err) {
      console.error('[DevelopmentPersistenceAdapter] Flush failed:', err);
    }
  }

  public clearAll(): void {
    this.state = this.createEmptyState();
    this.flushToDisk();
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
    return {
      status: 'DEVELOPMENT_ADAPTER',
      provider: 'DISK_STORAGE',
      environment: process.env.NODE_ENV || 'development',
      isPostgresConfigured: false,
      migrationVersion: this.state.version,
      entityCounts: {
        securities: Object.keys(this.state.securities).length,
        documents: Object.keys(this.state.documents).length,
        evidence: Object.keys(this.state.evidence).length,
        notebooks: Object.keys(this.state.notebooks).length,
        snapshots: Object.keys(this.state.snapshots).length,
        decisions: Object.keys(this.state.decisions).length,
        strategies: Object.keys(this.state.strategies).length,
        backtests: Object.keys(this.state.backtests).length,
        alerts: Object.keys(this.state.alerts).length,
        queries: Object.keys(this.state.queries).length
      },
      details: {
        diskBacked: true,
        storagePath: this.storageFile,
        schemaVersion: '1.0.0',
        lastPersistedAt: this.state.lastPersistedAt
      }
    };
  }

  // --- REPOSITORY FACTORIES ---

  private createSecurityRepo(): ISecurityRepository {
    return {
      get: async (id: string) => this.state.securities[id] || null,
      getByTicker: async (ticker: string, market?: string) => {
        const t = ticker.toUpperCase();
        const found = Object.values(this.state.securities).find(s =>
          s.ticker.toUpperCase() === t && (!market || s.market.toUpperCase() === market.toUpperCase())
        );
        return found || null;
      },
      getAll: async () => Object.values(this.state.securities),
      save: async (sec: CanonicalSecurity) => {
        this.state.securities[sec.id] = { ...sec };
        this.flushToDisk();
        return this.state.securities[sec.id];
      },
      saveMany: async (securities: CanonicalSecurity[]) => {
        for (const sec of securities) {
          this.state.securities[sec.id] = { ...sec };
        }
        this.flushToDisk();
        return securities.length;
      },
      count: async () => Object.keys(this.state.securities).length
    };
  }

  private createDocumentRepo(): IResearchDocumentRepository {
    return {
      get: async (id: string) => this.state.documents[id] || null,
      getByHash: async (hash: string) => {
        return Object.values(this.state.documents).find(d => d.contentHash === hash) || null;
      },
      getAll: async (filter?: { securityId?: string; documentType?: string }) => {
        let docs = Object.values(this.state.documents);
        if (filter?.documentType) {
          docs = docs.filter(d => d.documentType === filter.documentType);
        }
        if (filter?.securityId) {
          docs = docs.filter(d => d.securityId === filter.securityId || (d as any).securityAssociations?.some((s: any) => s.securityId === filter.securityId));
        }
        return docs;
      },
      save: async (doc: ResearchDocument) => {
        const existing = Object.values(this.state.documents).find(d => d.contentHash === doc.contentHash);
        if (existing) {
          return { saved: false, isDuplicate: true, document: existing };
        }
        this.state.documents[doc.documentId] = { ...doc };
        this.flushToDisk();
        return { saved: true, isDuplicate: false, document: this.state.documents[doc.documentId] };
      },
      updateStatus: async (documentId: string, status: DocumentProcessingStatus, metadata?: any) => {
        if (!this.state.documents[documentId]) return false;
        this.state.documents[documentId].processingStatus = status;
        if (metadata) {
          this.state.documents[documentId].metadata = {
            ...this.state.documents[documentId].metadata,
            ...metadata
          };
        }
        this.flushToDisk();
        return true;
      },
      count: async () => Object.keys(this.state.documents).length
    };
  }

  private createEvidenceRepo(): IPersistentEvidenceRepository {
    return {
      addEvidence: async (item: EvidenceItem) => {
        if (!item || !item.evidenceId) return false;
        if (this.state.evidence[item.evidenceId]) {
          return false; // Immutable
        }
        this.state.evidence[item.evidenceId] = { ...item };
        this.flushToDisk();
        return true;
      },
      getEvidence: async (id: string) => this.state.evidence[id] || null,
      get: async (id: string) => this.state.evidence[id] || null,
      queryEvidence: async (filter: EvidenceFilter) => {
        let items = Object.values(this.state.evidence);
        if (filter.securityId) {
          items = items.filter(e => e.securityId === filter.securityId);
        }
        if (filter.sourceType) {
          const types = Array.isArray(filter.sourceType) ? filter.sourceType : [filter.sourceType];
          items = items.filter(e => types.includes(e.sourceType));
        }
        if (filter.epistemicStatus) {
          const statuses = Array.isArray(filter.epistemicStatus) ? filter.epistemicStatus : [filter.epistemicStatus];
          items = items.filter(e => statuses.includes(e.epistemicStatus));
        }
        if (filter.asOfDate) {
          const asOfStr = typeof filter.asOfDate === 'string' ? filter.asOfDate : (filter.asOfDate as Date).toISOString();
          const target = asOfStr.includes('T')
            ? new Date(asOfStr).getTime()
            : new Date(`${asOfStr}T23:59:59.999Z`).getTime();
          items = items.filter(e => !e.publishedAt || new Date(e.publishedAt).getTime() <= target);
        }
        return items;
      },
      getHistoricalEvidence: async (id: string, asOfDate?: string) => {
        const item = this.state.evidence[id];
        if (!item) return null;
        if (asOfDate && item.publishedAt && new Date(item.publishedAt) > new Date(asOfDate)) {
          return null;
        }
        return item;
      },
      getEvidenceLineage: async (id: string) => {
        const item = this.state.evidence[id];
        return item ? [item] : [];
      },
      count: async () => Object.keys(this.state.evidence).length,
      getAll: async () => Object.values(this.state.evidence)
    };
  }

  private createNotebookRepo(): IResearchNotebookRepository {
    return {
      get: async (id: string) => this.state.notebooks[id] || null,
      getBySecurityId: async (securityId: string) => {
        const found = Object.values(this.state.notebooks).find(nb => nb.securityId === securityId || (nb as any).security?.id === securityId);
        return found || null;
      },
      save: async (notebook: ResearchNotebook) => {
        this.state.notebooks[notebook.notebookId] = { ...notebook };
        this.flushToDisk();
        return this.state.notebooks[notebook.notebookId];
      },
      getAll: async () => Object.values(this.state.notebooks),
      count: async () => Object.keys(this.state.notebooks).length
    };
  }

  private createSnapshotRepo(): IResearchSnapshotRepository {
    return {
      get: async (id: string) => this.state.snapshots[id] || null,
      getByNotebookId: async (notebookId: string) => {
        return Object.values(this.state.snapshots).filter(s => s.notebookId === notebookId);
      },
      getBySecurityId: async (securityId: string) => {
        return Object.values(this.state.snapshots).filter(s => s.securityId === securityId);
      },
      getLatest: async (securityId: string, asOfDate?: string) => {
        let snaps = Object.values(this.state.snapshots).filter(s => s.securityId === securityId);
        if (asOfDate) {
          snaps = snaps.filter(s => (s.researchAsOfDate || (s as any).asOfDate) <= asOfDate);
        }
        snaps.sort((a, b) => ((b.researchAsOfDate || (b as any).asOfDate || '')).localeCompare(a.researchAsOfDate || (a as any).asOfDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
        return snaps[0] || null;
      },
      save: async (snapshot: ResearchSnapshot) => {
        // IMMUTABLE: never overwrite
        if (this.state.snapshots[snapshot.snapshotId]) {
          return this.state.snapshots[snapshot.snapshotId];
        }
        this.state.snapshots[snapshot.snapshotId] = { ...snapshot };
        this.flushToDisk();
        return this.state.snapshots[snapshot.snapshotId];
      },
      getAll: async () => Object.values(this.state.snapshots),
      count: async () => Object.keys(this.state.snapshots).length
    };
  }

  private createDecisionRepo(): IDecisionRepository {
    return {
      get: async (id: string) => this.state.decisions[id] || null,
      getLatest: async (securityId: string, asOfDate?: string) => {
        let decs = Object.values(this.state.decisions).filter(d => d.securityId === securityId);
        if (asOfDate) {
          decs = decs.filter(d => d.asOfDate <= asOfDate);
        }
        decs.sort((a, b) => b.asOfDate.localeCompare(a.asOfDate) || b.generatedAt.localeCompare(a.generatedAt));
        return decs[0] || null;
      },
      getHistory: async (securityId: string) => {
        const decs = Object.values(this.state.decisions).filter(d => d.securityId === securityId);
        decs.sort((a, b) => b.asOfDate.localeCompare(a.asOfDate) || b.generatedAt.localeCompare(a.generatedAt));
        return decs;
      },
      save: async (decision: InvestmentDecisionAssessment) => {
        // IMMUTABLE: never overwrite
        if (this.state.decisions[decision.decisionId]) {
          return this.state.decisions[decision.decisionId];
        }
        this.state.decisions[decision.decisionId] = { ...decision };
        this.flushToDisk();
        return this.state.decisions[decision.decisionId];
      },
      getAll: async () => Object.values(this.state.decisions),
      count: async () => Object.keys(this.state.decisions).length
    };
  }

  private createStrategyRepo(): IStrategyRepository {
    return {
      get: async (id: string) => this.state.strategies[id] || null,
      getAll: async () => Object.values(this.state.strategies),
      save: async (strategy: Strategy) => {
        const id = strategy.id || (strategy as any).strategyId;
        this.state.strategies[id] = { ...strategy };
        this.flushToDisk();
        return this.state.strategies[id];
      },
      count: async () => Object.keys(this.state.strategies).length
    };
  }

  private createBacktestRepo(): IBacktestRepository {
    return {
      get: async (id: string) => this.state.backtests[id] || null,
      getByStrategyId: async (strategyId: string) => {
        return Object.values(this.state.backtests).filter(b => b.strategyId === strategyId || (b as any).configuration?.strategyId === strategyId);
      },
      getAll: async () => Object.values(this.state.backtests),
      save: async (backtest: BacktestResult) => {
        // IMMUTABLE: never rerun or overwrite
        if (this.state.backtests[backtest.backtestId]) {
          return this.state.backtests[backtest.backtestId];
        }
        this.state.backtests[backtest.backtestId] = { ...backtest };
        this.flushToDisk();
        return this.state.backtests[backtest.backtestId];
      },
      count: async () => Object.keys(this.state.backtests).length
    };
  }

  private createWatchlistRepo(): IWatchlistRepository {
    return {
      getWatchlist: async (id = 'default') => this.state.watchlists[id] || [],
      saveWatchlist: async (tickers: string[], id = 'default') => {
        this.state.watchlists[id] = [...tickers];
        this.flushToDisk();
      },
      addTicker: async (ticker: string, id = 'default') => {
        if (!this.state.watchlists[id]) this.state.watchlists[id] = [];
        if (!this.state.watchlists[id].includes(ticker)) {
          this.state.watchlists[id].push(ticker);
          this.flushToDisk();
        }
      },
      removeTicker: async (ticker: string, id = 'default') => {
        if (!this.state.watchlists[id]) return;
        this.state.watchlists[id] = this.state.watchlists[id].filter(t => t !== ticker);
        this.flushToDisk();
      }
    };
  }

  private createAlertRepo(): IAlertRepository {
    return {
      get: async (id: string) => this.state.alerts[id] || null,
      getAll: async () => Object.values(this.state.alerts),
      save: async (alert: AlertItem) => {
        this.state.alerts[alert.id] = { ...alert };
        this.flushToDisk();
        return this.state.alerts[alert.id];
      },
      saveMany: async (alerts: AlertItem[]) => {
        for (const a of alerts) {
          this.state.alerts[a.id] = { ...a };
        }
        this.flushToDisk();
        return alerts.length;
      },
      update: async (alertId: string, updates: Partial<AlertItem>) => {
        if (!this.state.alerts[alertId]) return false;
        this.state.alerts[alertId] = { ...this.state.alerts[alertId], ...updates };
        this.flushToDisk();
        return true;
      },
      count: async () => Object.keys(this.state.alerts).length
    };
  }

  private createPortfolioRepo(): IPortfolioRepository {
    return {
      getPositions: async (portfolioId = 'default') => this.state.portfolio[portfolioId] || [],
      savePositions: async (positions: HoldingPosition[], portfolioId = 'default') => {
        this.state.portfolio[portfolioId] = [...positions];
        this.flushToDisk();
      },
      updatePosition: async (ticker: string, shares: number, avgCost: number, portfolioId = 'default') => {
        if (!this.state.portfolio[portfolioId]) this.state.portfolio[portfolioId] = [];
        const idx = this.state.portfolio[portfolioId].findIndex(p => p.ticker === ticker);
        if (idx >= 0) {
          this.state.portfolio[portfolioId][idx] = { ticker, shares, avgCost };
        } else {
          this.state.portfolio[portfolioId].push({ ticker, shares, avgCost });
        }
        this.flushToDisk();
      }
    };
  }

  private createQueryRepo(): IResearchQueryRepository {
    return {
      get: async (id: string) => this.state.queries[id] || null,
      getAll: async () => Object.values(this.state.queries),
      save: async (query: ResearchQueryItem) => {
        const id = (query as any).queryId || query.id;
        this.state.queries[id] = { ...query };
        this.flushToDisk();
        return this.state.queries[id];
      },
      count: async () => Object.keys(this.state.queries).length
    };
  }
}
