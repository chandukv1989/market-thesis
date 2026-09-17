/**
 * Phase 17: Authorization Service
 * 
 * Enforces strict server-side resource ownership verification,
 * preventing Insecure Direct Object References (IDOR) across all private assets.
 */

import { persistenceManager } from '../persistence/persistenceManager';
import { watchlistAlertService } from '../services/alerts/watchlistAlertService';
import { quantStrategyEngine } from '../services/quant/quantStrategyEngine';
import { backtestService } from '../services/backtest/backtestService';
import { ResearchDocument, ResearchNotebook, ResearchSnapshot, InvestmentDecisionAssessment, Strategy, QuantStrategy, BacktestResult, AlertItem, CanonicalWatchlistItem, AlertRule, AlertEvent } from '../../src/types';

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied: You do not own this resource', public statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthorizationService {
  private static instance: AuthorizationService;

  public static getInstance(): AuthorizationService {
    if (!AuthorizationService.instance) {
      AuthorizationService.instance = new AuthorizationService();
    }
    return AuthorizationService.instance;
  }

  /**
   * Verify document access.
   * Public/system documents (no ownerUserId) are readable by any authenticated user.
   * Private user documents require ownerUserId matching the authenticated userId.
   */
  public async authorizeDocument(documentId: string, userId: string): Promise<ResearchDocument> {
    const docRepo = persistenceManager.getDocumentRepository();
    const doc = await docRepo.get(documentId);

    if (!doc) {
      throw new AuthorizationError('Document not found', 404);
    }

    const docOwner = (doc as any).ownerUserId || (doc as any).userId;
    if (docOwner && docOwner !== userId) {
      throw new AuthorizationError('Access denied: You do not have permission to access this document', 403);
    }

    return doc;
  }

  /**
   * Verify research notebook ownership.
   */
  public async authorizeNotebook(notebookId: string, userId: string): Promise<ResearchNotebook> {
    const notebookRepo = persistenceManager.getNotebookRepository();
    const notebook = await notebookRepo.get(notebookId);

    if (!notebook) {
      throw new AuthorizationError('Research notebook not found', 404);
    }

    const owner = (notebook as any).ownerUserId || (notebook as any).userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this notebook', 403);
    }

    return notebook;
  }

  /**
   * Verify snapshot ownership.
   */
  public async authorizeSnapshot(snapshotId: string, userId: string): Promise<ResearchSnapshot> {
    const snapshotRepo = persistenceManager.getSnapshotRepository();
    const snapshot = await snapshotRepo.get(snapshotId);

    if (!snapshot) {
      throw new AuthorizationError('Research snapshot not found', 404);
    }

    const owner = (snapshot as any).ownerUserId || (snapshot as any).userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this snapshot', 403);
    }

    return snapshot;
  }

  /**
   * Verify investment decision assessment ownership.
   */
  public async authorizeDecision(decisionId: string, userId: string): Promise<InvestmentDecisionAssessment> {
    const decisionRepo = persistenceManager.getDecisionRepository();
    const decision = await decisionRepo.get(decisionId);

    if (!decision) {
      throw new AuthorizationError('Decision assessment not found', 404);
    }

    const owner = (decision as any).ownerUserId || (decision as any).userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this decision assessment', 403);
    }

    return decision;
  }

  /**
   * Verify strategy access.
   * Built-in default strategies are accessible to all users.
   * Custom created strategies require ownerUserId matching userId.
   */
  public async authorizeStrategy(strategyId: string, userId: string): Promise<Strategy | QuantStrategy> {
    const strategyRepo = persistenceManager.getStrategyRepository();
    let strategy: Strategy | QuantStrategy | null = await strategyRepo.get(strategyId);

    if (!strategy) {
      const qStrat = quantStrategyEngine.getStrategy(strategyId);
      if (qStrat) {
        const isBuiltin = qStrat.isBuiltIn ?? (!qStrat.ownerUserId);
        strategy = { ...qStrat, isBuiltIn: isBuiltin };
      }
    }

    if (!strategy) {
      throw new AuthorizationError('Strategy not found', 404);
    }

    if (strategy.isBuiltIn) {
      return strategy;
    }

    const owner = strategy.ownerUserId || (strategy as any).userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this strategy', 403);
    }

    return strategy;
  }

  /**
   * Verify backtest result access.
   */
  public async authorizeBacktest(backtestId: string, userId: string): Promise<BacktestResult> {
    const backtestRepo = persistenceManager.getBacktestRepository();
    let backtest = await backtestRepo.get(backtestId);

    if (!backtest) {
      backtest = backtestService.getBacktest(backtestId);
    }

    if (!backtest) {
      throw new AuthorizationError('Backtest result not found', 404);
    }

    const owner = backtest.ownerUserId || (backtest as any).userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this backtest result', 403);
    }

    return backtest;
  }

  /**
   * Verify alert ownership.
   */
  public async authorizeAlert(alertId: string, userId: string): Promise<AlertItem> {
    const alertRepo = persistenceManager.getAlertRepository();
    const alert = await alertRepo.get(alertId);

    if (!alert) {
      throw new AuthorizationError('Alert not found', 404);
    }

    const owner = alert.ownerUserId || alert.userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this alert', 403);
    }

    return alert;
  }

  /**
   * Verify watchlist item ownership.
   */
  public async authorizeWatchlistItem(itemId: string, userId: string): Promise<CanonicalWatchlistItem> {
    const item = watchlistAlertService.getWatchlistItem(itemId);
    if (!item) {
      throw new AuthorizationError('Watchlist item not found', 404);
    }

    const owner = item.ownerUserId || item.userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this watchlist item', 403);
    }

    return item;
  }

  /**
   * Verify alert rule ownership.
   */
  public async authorizeAlertRule(ruleId: string, userId: string): Promise<AlertRule> {
    const rule = watchlistAlertService.getAlertRule(ruleId);
    if (!rule) {
      throw new AuthorizationError('Alert rule not found', 404);
    }

    const owner = rule.ownerUserId || rule.userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this alert rule', 403);
    }

    return rule;
  }

  /**
   * Verify alert event ownership.
   */
  public async authorizeAlertEvent(eventId: string, userId: string): Promise<AlertEvent> {
    const event = watchlistAlertService.getAlertEvent(eventId);
    if (!event) {
      throw new AuthorizationError('Alert event not found', 404);
    }

    const owner = event.ownerUserId || event.userId;
    if (owner && owner !== userId) {
      throw new AuthorizationError('Access denied: You do not own this alert event', 403);
    }

    return event;
  }
}

export const authorizationService = AuthorizationService.getInstance();
