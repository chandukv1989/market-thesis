/**
 * Phase 16: Persistence Layer Repository Interfaces & Domain Contracts
 * 
 * Strict architectural boundaries:
 * - Domain services depend on repository interfaces, never directly on SQL.
 * - Historical artifacts (Evidence, Snapshots, Decisions, Backtests) are immutable.
 * - Point-in-time timestamps and epistemic provenance are preserved.
 */

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
} from '../../src/types';

export interface ISecurityRepository {
  get(id: string): Promise<CanonicalSecurity | null>;
  getByTicker(ticker: string, market?: string): Promise<CanonicalSecurity | null>;
  getAll(): Promise<CanonicalSecurity[]>;
  save(security: CanonicalSecurity): Promise<CanonicalSecurity>;
  saveMany(securities: CanonicalSecurity[]): Promise<number>;
  count(): Promise<number>;
}

export interface IResearchDocumentRepository {
  get(documentId: string): Promise<ResearchDocument | null>;
  getByHash(contentHash: string): Promise<ResearchDocument | null>;
  getAll(filter?: { securityId?: string; documentType?: string }): Promise<ResearchDocument[]>;
  save(doc: ResearchDocument): Promise<{ saved: boolean; isDuplicate: boolean; document: ResearchDocument }>;
  updateStatus(documentId: string, status: DocumentProcessingStatus, metadata?: any): Promise<boolean>;
  count(): Promise<number>;
}

export interface IPersistentEvidenceRepository {
  addEvidence(item: EvidenceItem): Promise<boolean>;
  getEvidence(evidenceId: string): Promise<EvidenceItem | null>;
  get?(evidenceId: string): Promise<EvidenceItem | null>;
  queryEvidence(filter: EvidenceFilter): Promise<EvidenceItem[]>;
  getHistoricalEvidence(evidenceId: string, asOfDate?: string): Promise<EvidenceItem | null>;
  getEvidenceLineage(evidenceId: string): Promise<EvidenceItem[]>;
  count(): Promise<number>;
  getAll(): Promise<EvidenceItem[]>;
}

export interface IResearchNotebookRepository {
  get(notebookId: string): Promise<ResearchNotebook | null>;
  getBySecurityId(securityId: string): Promise<ResearchNotebook | null>;
  save(notebook: ResearchNotebook): Promise<ResearchNotebook>;
  getAll(): Promise<ResearchNotebook[]>;
  count(): Promise<number>;
}

export interface IResearchSnapshotRepository {
  get(snapshotId: string): Promise<ResearchSnapshot | null>;
  getByNotebookId(notebookId: string): Promise<ResearchSnapshot[]>;
  getBySecurityId(securityId: string): Promise<ResearchSnapshot[]>;
  getLatest(securityId: string, asOfDate?: string): Promise<ResearchSnapshot | null>;
  save(snapshot: ResearchSnapshot): Promise<ResearchSnapshot>; // IMMUTABLE
  getAll(): Promise<ResearchSnapshot[]>;
  count(): Promise<number>;
}

export interface IDecisionRepository {
  get(decisionId: string): Promise<InvestmentDecisionAssessment | null>;
  getLatest(securityId: string, asOfDate?: string): Promise<InvestmentDecisionAssessment | null>;
  getHistory(securityId: string): Promise<InvestmentDecisionAssessment[]>;
  save(decision: InvestmentDecisionAssessment): Promise<InvestmentDecisionAssessment>; // IMMUTABLE
  getAll(): Promise<InvestmentDecisionAssessment[]>;
  count(): Promise<number>;
}

export interface IStrategyRepository {
  get(strategyId: string, version?: string): Promise<Strategy | null>;
  getAll(): Promise<Strategy[]>;
  save(strategy: Strategy): Promise<Strategy>;
  count(): Promise<number>;
}

export interface IBacktestRepository {
  get(backtestId: string): Promise<BacktestResult | null>;
  getByStrategyId(strategyId: string): Promise<BacktestResult[]>;
  getAll(): Promise<BacktestResult[]>;
  save(backtest: BacktestResult): Promise<BacktestResult>; // IMMUTABLE
  count(): Promise<number>;
}

export interface IWatchlistRepository {
  getWatchlist(id?: string): Promise<string[]>;
  saveWatchlist(tickers: string[], id?: string): Promise<void>;
  addTicker(ticker: string, id?: string): Promise<void>;
  removeTicker(ticker: string, id?: string): Promise<void>;
}

export interface IAlertRepository {
  get(alertId: string): Promise<AlertItem | null>;
  getAll(): Promise<AlertItem[]>;
  save(alert: AlertItem): Promise<AlertItem>;
  saveMany(alerts: AlertItem[]): Promise<number>;
  update(alertId: string, updates: Partial<AlertItem>): Promise<boolean>;
  count(): Promise<number>;
}

export interface IPortfolioRepository {
  getPositions(portfolioId?: string): Promise<HoldingPosition[]>;
  savePositions(positions: HoldingPosition[], portfolioId?: string): Promise<void>;
  updatePosition(ticker: string, shares: number, avgCost: number, portfolioId?: string): Promise<void>;
}

export interface IResearchQueryRepository {
  get(queryId: string): Promise<ResearchQueryItem | null>;
  getAll(): Promise<ResearchQueryItem[]>;
  save(query: ResearchQueryItem): Promise<ResearchQueryItem>;
  count(): Promise<number>;
}

export interface IPersistenceAdapter {
  readonly status: PersistenceStatusCode;
  readonly provider: PersistenceProviderType;
  readonly isConnected: boolean;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;

  runTransaction<T>(work: () => Promise<T>): Promise<T>;

  getSecurityRepository(): ISecurityRepository;
  getDocumentRepository(): IResearchDocumentRepository;
  getEvidenceRepository(): IPersistentEvidenceRepository;
  getNotebookRepository(): IResearchNotebookRepository;
  getSnapshotRepository(): IResearchSnapshotRepository;
  getDecisionRepository(): IDecisionRepository;
  getStrategyRepository(): IStrategyRepository;
  getBacktestRepository(): IBacktestRepository;
  getWatchlistRepository(): IWatchlistRepository;
  getAlertRepository(): IAlertRepository;
  getPortfolioRepository(): IPortfolioRepository;
  getQueryRepository(): IResearchQueryRepository;

  getStatus(): Promise<PersistenceStatusResponse>;
}
