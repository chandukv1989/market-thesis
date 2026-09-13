/**
 * Watchlist & Alert Intelligence Service (Phase 10)
 * 
 * Manages in-memory watchlist items, deterministic alert rules, and alert events.
 * Coordinates batch market data retrieval, deterministic rule evaluation via AlertEvaluator,
 * cooldown enforcement, deduplication, and optional cautious Gemini commentary.
 * 
 * Strict Architectural Invariants:
 * 1. Alerts are triggered DETERMINISTICALLY. Gemini NEVER determines triggers.
 * 2. Real provider responses (FYERS, Twelve Data) yield REAL alerts.
 * 3. Unavailable provider responses yield UNAVAILABLE status and NEVER trigger REAL alerts.
 * 4. Portfolio alerts yield CALCULATED status from Phase 9 portfolio engine.
 * 5. Batch queries are used to minimize provider network requests.
 * 6. No credentials, tokens, or authorization headers are ever logged or serialized.
 */

import { GoogleGenAI } from '@google/genai';
import {
  CanonicalWatchlistItem,
  AlertRule,
  AlertEvent,
  AlertEvaluation,
  NormalizedQuote,
  PortfolioMetrics,
  AlertRuleType,
  AlertPriority,
  AlertComparison
} from '../../../src/types';
import { alertEvaluator } from './alertEvaluator';
import { financialDataService } from '../financialDataService';
import { portfolioIntelligenceService } from '../portfolio/portfolioIntelligenceService';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';
import { CANONICAL_SECURITIES_MAP } from '../../../src/data/mockData';

export class WatchlistAlertService {
  private watchlist: Map<string, CanonicalWatchlistItem> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private events: AlertEvent[] = [];
  private lastEvaluatedAt: string | null = null;
  private aiClient: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-2.5-flash';

  constructor() {
    this.seedDefaultData();
  }

  private getClient(): GoogleGenAI | null {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey.trim().length > 0) {
        this.aiClient = new GoogleGenAI({ apiKey });
      }
    }
    return this.aiClient;
  }

  /**
   * Seed initial canonical watchlist items and sample deterministic rules
   */
  private seedDefaultData() {
    const defaultWatchlist: CanonicalWatchlistItem[] = [
      {
        watchlistItemId: 'wl-nvda',
        securityId: 'us-nvda',
        symbol: 'NVDA',
        companyName: 'NVIDIA Corporation',
        market: 'US',
        exchange: 'NASDAQ',
        currency: 'USD',
        provider: 'Twelve Data',
        addedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        enabled: true,
        alertRuleIds: ['rule-nvda-price', 'rule-nvda-pct'],
        ticker: 'NVDA',
        notes: 'Semiconductor / AI infrastructure core position'
      },
      {
        watchlistItemId: 'wl-msft',
        securityId: 'us-msft',
        symbol: 'MSFT',
        companyName: 'Microsoft Corporation',
        market: 'US',
        exchange: 'NASDAQ',
        currency: 'USD',
        provider: 'Twelve Data',
        addedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        enabled: true,
        alertRuleIds: [],
        ticker: 'MSFT'
      },
      {
        watchlistItemId: 'wl-reliance',
        securityId: 'in-reliance',
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Limited',
        market: 'INDIA',
        exchange: 'NSE',
        currency: 'INR',
        provider: 'FYERS',
        addedAt: new Date(Date.now() - 86400000).toISOString(),
        enabled: true,
        alertRuleIds: ['rule-reliance-price'],
        ticker: 'RELIANCE',
        notes: 'Indian conglomerate core monitoring'
      },
      {
        watchlistItemId: 'wl-tcs',
        securityId: 'in-tcs',
        symbol: 'TCS',
        companyName: 'Tata Consultancy Services Limited',
        market: 'INDIA',
        exchange: 'NSE',
        currency: 'INR',
        provider: 'FYERS',
        addedAt: new Date(Date.now() - 86400000).toISOString(),
        enabled: true,
        alertRuleIds: [],
        ticker: 'TCS'
      }
    ];

    defaultWatchlist.forEach(w => this.watchlist.set(w.watchlistItemId, w));

    const defaultRules: AlertRule[] = [
      {
        alertRuleId: 'rule-nvda-price',
        securityId: 'us-nvda',
        symbol: 'NVDA',
        alertType: 'PRICE_ABOVE',
        threshold: 150,
        comparison: '>',
        enabled: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        cooldownMinutes: 60,
        lastTriggeredAt: null,
        lastObservedValue: 140.25,
        previousObservedValue: 138.5,
        priority: 'WARNING'
      },
      {
        alertRuleId: 'rule-nvda-pct',
        securityId: 'us-nvda',
        symbol: 'NVDA',
        alertType: 'DAILY_CHANGE_ABSOLUTE_ABOVE',
        threshold: 4.0,
        comparison: '>',
        enabled: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        cooldownMinutes: 60,
        lastTriggeredAt: null,
        lastObservedValue: 2.15,
        previousObservedValue: 1.1,
        priority: 'INFO'
      },
      {
        alertRuleId: 'rule-reliance-price',
        securityId: 'in-reliance',
        symbol: 'RELIANCE',
        alertType: 'PRICE_ABOVE',
        threshold: 3000,
        comparison: '>',
        enabled: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        cooldownMinutes: 60,
        lastTriggeredAt: null,
        lastObservedValue: 2950.0,
        previousObservedValue: 2920.0,
        priority: 'WARNING'
      },
      {
        alertRuleId: 'rule-portfolio-loss',
        portfolioId: 'primary-portfolio',
        alertType: 'PORTFOLIO_DAILY_LOSS_ABOVE',
        threshold: 2.5,
        comparison: '>=',
        enabled: true,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        cooldownMinutes: 120,
        lastTriggeredAt: null,
        lastObservedValue: 0.8,
        priority: 'CRITICAL'
      },
      {
        alertRuleId: 'rule-portfolio-weight-nvda',
        portfolioId: 'primary-portfolio',
        securityId: 'us-nvda',
        symbol: 'NVDA',
        alertType: 'POSITION_WEIGHT_ABOVE',
        threshold: 25.0,
        comparison: '>=',
        enabled: true,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        cooldownMinutes: 1440,
        lastTriggeredAt: null,
        lastObservedValue: 19.5,
        priority: 'WARNING'
      }
    ];

    defaultRules.forEach(r => this.rules.set(r.alertRuleId, r));
  }

  // ==========================================
  // WATCHLIST OPERATIONS
  // ==========================================

  public getWatchlist(): CanonicalWatchlistItem[] {
    return Array.from(this.watchlist.values());
  }

  public getWatchlistItem(idOrSymbol: string): CanonicalWatchlistItem | undefined {
    if (this.watchlist.has(idOrSymbol)) {
      return this.watchlist.get(idOrSymbol);
    }
    const upper = idOrSymbol.toUpperCase();
    return Array.from(this.watchlist.values()).find(
      w => w.symbol.toUpperCase() === upper || w.securityId.toUpperCase() === upper || w.watchlistItemId === idOrSymbol
    );
  }

  public addWatchlistItem(item: {
    symbol: string;
    securityId?: string;
    market?: 'US' | 'INDIA' | 'GLOBAL';
    exchange?: string;
    currency?: string;
    notes?: string;
  }): CanonicalWatchlistItem {
    const rawSym = item.symbol.trim();
    const resolved = resolveSecurity(rawSym);

    const canonicalSym = resolved ? resolved.symbol.toUpperCase() : rawSym.toUpperCase();
    const securityId = resolved?.id || item.securityId || (resolved?.market === 'INDIA' ? `in-${canonicalSym.toLowerCase()}` : `us-${canonicalSym.toLowerCase()}`);
    const market = resolved?.market || item.market || 'US';
    const exchange = resolved?.exchange || item.exchange || (market === 'INDIA' ? 'NSE' : 'NASDAQ');
    const currency = resolved?.currency || item.currency || (market === 'INDIA' ? 'INR' : 'USD');
    const provider = market === 'INDIA' ? 'FYERS' : 'Twelve Data';
    const companyName = (resolved as any)?.name || CANONICAL_SECURITIES_MAP[canonicalSym]?.name || canonicalSym;

    // Check if already in watchlist
    const existing = Array.from(this.watchlist.values()).find(
      w => w.securityId.toLowerCase() === securityId.toLowerCase() || (w.symbol.toUpperCase() === canonicalSym && w.exchange.toUpperCase() === exchange.toUpperCase())
    );
    if (existing) {
      if (item.notes) existing.notes = item.notes;
      existing.enabled = true;
      return existing;
    }

    const watchlistItemId = `wl-${securityId.replace(/[^a-zA-Z0-9-]/g, '')}-${Date.now().toString(36)}`;
    const newItem: CanonicalWatchlistItem = {
      watchlistItemId,
      securityId,
      symbol: canonicalSym,
      companyName,
      market,
      exchange,
      currency,
      provider,
      addedAt: new Date().toISOString(),
      enabled: true,
      notes: item.notes,
      alertRuleIds: [],
      ticker: canonicalSym
    };

    this.watchlist.set(watchlistItemId, newItem);
    return newItem;
  }

  public removeWatchlistItem(idOrSymbol: string): boolean {
    const target = this.getWatchlistItem(idOrSymbol);
    if (!target) return false;

    // Remove associated rules
    target.alertRuleIds.forEach(ruleId => {
      this.rules.delete(ruleId);
    });

    return this.watchlist.delete(target.watchlistItemId);
  }

  public toggleWatchlistItem(idOrSymbol: string, enabled?: boolean): CanonicalWatchlistItem | undefined {
    const target = this.getWatchlistItem(idOrSymbol);
    if (!target) return undefined;

    target.enabled = enabled !== undefined ? enabled : !target.enabled;
    return target;
  }

  // ==========================================
  // ALERT RULES OPERATIONS
  // ==========================================

  public getAlertRules(filter?: { securityId?: string; symbol?: string; enabled?: boolean; alertType?: AlertRuleType }): AlertRule[] {
    let result = Array.from(this.rules.values());
    if (filter) {
      if (filter.securityId) {
        result = result.filter(r => r.securityId?.toLowerCase() === filter.securityId?.toLowerCase());
      }
      if (filter.symbol) {
        const symUpper = filter.symbol.toUpperCase();
        result = result.filter(r => r.symbol?.toUpperCase() === symUpper);
      }
      if (filter.enabled !== undefined) {
        result = result.filter(r => r.enabled === filter.enabled);
      }
      if (filter.alertType) {
        result = result.filter(r => r.alertType === filter.alertType);
      }
    }
    return result;
  }

  public getAlertRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  public createAlertRule(ruleData: {
    securityId?: string;
    portfolioId?: string;
    symbol?: string;
    alertType: AlertRuleType;
    threshold: number | string;
    comparison?: AlertComparison;
    priority?: AlertPriority;
    cooldownMinutes?: number;
    enabled?: boolean;
    metadata?: Record<string, unknown>;
  }): AlertRule {
    const alertRuleId = `rule-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    let comparison: AlertComparison = ruleData.comparison || '>';
    if (!ruleData.comparison) {
      if (ruleData.alertType.includes('BELOW')) comparison = '<';
      else if (ruleData.alertType.includes('CROSSES_ABOVE')) comparison = 'CROSSES_ABOVE';
      else if (ruleData.alertType.includes('CROSSES_BELOW')) comparison = 'CROSSES_BELOW';
      else comparison = '>';
    }

    const newRule: AlertRule = {
      alertRuleId,
      securityId: ruleData.securityId,
      portfolioId: ruleData.portfolioId,
      symbol: ruleData.symbol ? ruleData.symbol.toUpperCase() : undefined,
      alertType: ruleData.alertType,
      threshold: typeof ruleData.threshold === 'number' ? ruleData.threshold : parseFloat(String(ruleData.threshold)) || ruleData.threshold,
      comparison,
      enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
      createdAt: now,
      updatedAt: now,
      cooldownMinutes: ruleData.cooldownMinutes ?? 60,
      lastTriggeredAt: null,
      lastObservedValue: null,
      previousObservedValue: null,
      priority: ruleData.priority || 'WARNING',
      metadata: ruleData.metadata
    };

    this.rules.set(alertRuleId, newRule);

    // Link to watchlist item if securityId matches
    if (newRule.securityId || newRule.symbol) {
      const match = this.getWatchlistItem(newRule.securityId || newRule.symbol!);
      if (match && !match.alertRuleIds.includes(alertRuleId)) {
        match.alertRuleIds.push(alertRuleId);
      }
    }

    return newRule;
  }

  public updateAlertRule(id: string, updates: Partial<AlertRule>): AlertRule | undefined {
    const existing = this.rules.get(id);
    if (!existing) return undefined;

    const updated: AlertRule = {
      ...existing,
      ...updates,
      alertRuleId: existing.alertRuleId, // immutable
      updatedAt: new Date().toISOString()
    };

    this.rules.set(id, updated);
    return updated;
  }

  public deleteAlertRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    // Unlink from watchlist
    this.watchlist.forEach(w => {
      w.alertRuleIds = w.alertRuleIds.filter(rId => rId !== id);
    });

    return this.rules.delete(id);
  }

  // ==========================================
  // ALERT EVENTS OPERATIONS
  // ==========================================

  public getAlertEvents(filter?: {
    isRead?: boolean;
    priority?: AlertPriority;
    securityId?: string;
    limit?: number;
  }): AlertEvent[] {
    let result = [...this.events];
    if (filter) {
      if (filter.isRead !== undefined) {
        result = result.filter(e => e.isRead === filter.isRead);
      }
      if (filter.priority) {
        result = result.filter(e => e.priority === filter.priority);
      }
      if (filter.securityId) {
        result = result.filter(e => e.securityId?.toLowerCase() === filter.securityId?.toLowerCase());
      }
      if (filter.limit && filter.limit > 0) {
        result = result.slice(0, filter.limit);
      }
    }
    return result;
  }

  public markAlertRead(eventId: string): AlertEvent | undefined {
    const event = this.events.find(e => e.eventId === eventId);
    if (event) {
      event.isRead = true;
    }
    return event;
  }

  public markAllRead(): void {
    this.events.forEach(e => {
      e.isRead = true;
    });
  }

  public acknowledgeAlert(eventId: string): AlertEvent | undefined {
    const event = this.events.find(e => e.eventId === eventId);
    if (event) {
      event.isAcknowledged = true;
      event.isRead = true;
    }
    return event;
  }

  public clearAlerts(): void {
    this.events = [];
  }

  // ==========================================
  // CORE EVALUATION PIPELINE
  // ==========================================

  /**
   * Evaluates all enabled alert rules deterministically.
   * Utilizes batch market data retrieval to optimize provider calls.
   */
  public async evaluateAll(options?: { force?: boolean; asOfDate?: string }): Promise<{
    evaluatedCount: number;
    triggeredCount: number;
    newEvents: AlertEvent[];
    evaluations: AlertEvaluation[];
    timestamp: string;
  }> {
    const now = options?.asOfDate || new Date().toISOString();
    const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled);

    if (enabledRules.length === 0) {
      return {
        evaluatedCount: 0,
        triggeredCount: 0,
        newEvents: [],
        evaluations: [],
        timestamp: now
      };
    }

    // 1. Group symbols needed for market quotes
    const symbolsToQuery = new Set<string>();
    enabledRules.forEach(r => {
      if (r.symbol) symbolsToQuery.add(r.symbol.toUpperCase());
    });

    // Also include symbols from enabled watchlist items
    this.watchlist.forEach(w => {
      if (w.enabled && w.symbol) symbolsToQuery.add(w.symbol.toUpperCase());
    });

    // 2. Batch retrieve quotes from marketDataProvider via financialDataService
    const quotesMap: Record<string, NormalizedQuote> = {};
    if (symbolsToQuery.size > 0) {
      try {
        const symbolList = Array.from(symbolsToQuery);
        // Execute batch quotes
        const quotes = await financialDataService.getQuotes(symbolList);
        quotes.forEach(q => {
          if (q && q.symbol) {
            quotesMap[q.symbol.toUpperCase()] = q;
          }
        });
      } catch (err) {
        console.warn('[WatchlistAlertService] Batch market data retrieval partial error:', err);
      }
    }

    // 3. Compute Phase 9 deterministic portfolio metrics
    let portfolioMetrics: PortfolioMetrics | null = null;
    try {
      portfolioMetrics = portfolioIntelligenceService.getPortfolioMetrics();
    } catch (err) {
      console.warn('[WatchlistAlertService] Portfolio metrics calculation error:', err);
    }

    // 4. Deterministic Rule Evaluation Loop
    const evaluations: AlertEvaluation[] = [];
    const newEvents: AlertEvent[] = [];

    for (const rule of enabledRules) {
      const targetSymbol = (rule.symbol || '').toUpperCase();
      const quote = quotesMap[targetSymbol] || null;

      // Evaluate via pure deterministic logic
      const evalResult = alertEvaluator.evaluate({
        rule,
        quote,
        portfolioMetrics,
        previousObservation: {
          observedValue: rule.lastObservedValue,
          observedAt: rule.lastTriggeredAt || undefined
        },
        asOfDate: options?.asOfDate
      });

      evaluations.push(evalResult);

      // Advance observed value tracking
      rule.previousObservedValue = rule.lastObservedValue;
      if (evalResult.observedValue !== null && evalResult.observedValue !== undefined) {
        rule.lastObservedValue = evalResult.observedValue;
      }

      // Check trigger conditions
      if (evalResult.triggered) {
        // Cooldown enforcement:
        // If the rule has triggered previously, ensure enough time has passed
        let isSuppressedByCooldown = false;
        if (rule.lastTriggeredAt && !options?.force) {
          const lastTime = new Date(rule.lastTriggeredAt).getTime();
          const currentTime = new Date(now).getTime();
          const cooldownMs = (rule.cooldownMinutes || 60) * 60 * 1000;
          if (currentTime - lastTime < cooldownMs) {
            isSuppressedByCooldown = true;
          }
        }

        if (!isSuppressedByCooldown) {
          // Deduplication fingerprint: ruleId + securityId + hourBucket
          const hourBucket = now.slice(0, 13);
          const fingerprint = `${rule.alertRuleId}_${rule.securityId || rule.portfolioId}_${evalResult.observedValue}_${hourBucket}`;

          const isDuplicate = this.events.some(
            e => e.fingerprint === fingerprint && (new Date(now).getTime() - new Date(e.triggeredAt).getTime() < 3600000)
          );

          if (!isDuplicate || options?.force) {
            rule.lastTriggeredAt = now;

            const resolvedSec = rule.symbol ? resolveSecurity(rule.symbol) : undefined;
            const companyName = (resolvedSec as any)?.name || (rule.symbol ? CANONICAL_SECURITIES_MAP[rule.symbol]?.name : undefined) || rule.symbol || 'Portfolio';

            // Epistemic status: if STALE, treat as UNAVAILABLE
            const epistemicStatus = evalResult.epistemicStatus === 'STALE'
              ? 'UNAVAILABLE'
              : (evalResult.epistemicStatus as 'REAL' | 'SIMULATED' | 'CALCULATED' | 'UNAVAILABLE');

            const event: AlertEvent = {
              eventId: `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
              alertRuleId: rule.alertRuleId,
              securityId: rule.securityId,
              portfolioId: rule.portfolioId,
              symbol: rule.symbol,
              companyName,
              alertType: rule.alertType,
              priority: rule.priority,
              observedValue: evalResult.observedValue ?? 0,
              threshold: rule.threshold,
              triggeredAt: now,
              epistemicStatus,
              isSimulated: evalResult.isSimulated,
              provider: evalResult.provider,
              market: evalResult.market,
              exchange: evalResult.exchange,
              currency: evalResult.currency,
              reason: evalResult.reason,
              provenance: evalResult.provenance,
              contextualAnalysis: null,
              isRead: false,
              isAcknowledged: false,
              fingerprint
            };

            this.events.unshift(event);
            newEvents.push(event);

            // Cap stored events
            if (this.events.length > 200) {
              this.events = this.events.slice(0, 200);
            }
          }
        }
      }
    }

    this.lastEvaluatedAt = now;

    return {
      evaluatedCount: enabledRules.length,
      triggeredCount: newEvents.length,
      newEvents,
      evaluations,
      timestamp: now
    };
  }

  // ==========================================
  // OPTIONAL GEMINI CONTEXTUAL ANALYSIS
  // ==========================================

  /**
   * Generates cautious, evidence-grounded AI commentary for an alert event.
   * Mandate: Gemini NEVER determines whether an alert fires. It only adds context after the fact.
   * If Gemini fails or is unconfigured, the alert remains intact with fallback messaging.
   */
  public async generateContextForAlert(eventId: string): Promise<string> {
    const event = this.events.find(e => e.eventId === eventId);
    if (!event) {
      throw new Error(`Alert event ${eventId} not found`);
    }

    if (event.contextualAnalysis) {
      return event.contextualAnalysis;
    }

    const client = this.getClient();
    if (!client) {
      const fallback = `Deterministic trigger from ${event.provider}. Provider verification: ${event.epistemicStatus}. AI contextual analysis engine currently unconfigured.`;
      event.contextualAnalysis = fallback;
      return fallback;
    }

    try {
      const prompt = `You are an expert investment intelligence assistant providing cautious, grounded commentary on an automated market alert.
CRITICAL INSTRUCTIONS:
- The alert was triggered deterministically by a mathematical rule: ${event.reason}.
- You must NOT claim causality (e.g. do not say "The stock rose because of X" unless verified evidence is directly provided).
- State clearly that the underlying observation is ${event.epistemicStatus} from provider ${event.provider}.
- Provide 2 to 3 concise, highly professional analytical sentences offering balanced context and monitoring considerations for an analyst.
- Keep tone objective and factual.

ALERT DETAILS:
- Asset: ${event.symbol || 'Portfolio'} (${event.companyName || ''})
- Condition: ${event.alertType} (Threshold: ${event.threshold}, Observed: ${event.observedValue})
- Epistemic Status: ${event.epistemicStatus} (Simulated: ${event.isSimulated})
- Provider: ${event.provider} (${event.exchange || ''})
- Trigger Reason: ${event.reason}
- Timestamp: ${event.triggeredAt}
`;

      const response = await client.models.generateContent({
        model: this.modelName,
        contents: prompt
      });

      const analysis = response.text?.trim() || `Deterministic trigger from ${event.provider} (${event.epistemicStatus}).`;
      event.contextualAnalysis = analysis;
      return analysis;
    } catch (err) {
      console.warn('[WatchlistAlertService] Gemini contextual analysis error:', err);
      const fallback = `Observed ${event.alertType} on ${event.symbol || 'Portfolio'}. Verified via ${event.provider} (${event.epistemicStatus}). Contextual AI generation temporarily unavailable.`;
      event.contextualAnalysis = fallback;
      return fallback;
    }
  }
}

export const watchlistAlertService = new WatchlistAlertService();
