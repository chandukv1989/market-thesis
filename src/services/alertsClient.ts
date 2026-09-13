/**
 * Watchlist and Alerts Client Service (Phase 10)
 * 
 * Provides client-side access to the server-side Watchlist and Alert Intelligence system.
 */

import {
  CanonicalWatchlistItem,
  AlertRule,
  AlertEvent,
  AlertEvaluation,
  AlertRuleType,
  AlertPriority,
  AlertComparison
} from '../types';

export interface EvaluateAlertsResponse {
  evaluatedCount: number;
  triggeredCount: number;
  newEvents: AlertEvent[];
  evaluations: AlertEvaluation[];
  timestamp: string;
}

class AlertsClient {
  public async getWatchlist(): Promise<CanonicalWatchlistItem[]> {
    try {
      const res = await fetch('/api/watchlist');
      if (!res.ok) throw new Error(`Failed to fetch watchlist: ${res.statusText}`);
      const data = await res.json();
      return data.watchlist || [];
    } catch (err) {
      console.warn('[AlertsClient] getWatchlist error:', err);
      return [];
    }
  }

  public async addWatchlistItem(item: {
    symbol: string;
    securityId?: string;
    market?: 'US' | 'INDIA' | 'GLOBAL';
    exchange?: string;
    currency?: string;
    notes?: string;
  }): Promise<CanonicalWatchlistItem | null> {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error(`Failed to add watchlist item: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] addWatchlistItem error:', err);
      return null;
    }
  }

  public async removeWatchlistItem(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.error('[AlertsClient] removeWatchlistItem error:', err);
      return false;
    }
  }

  public async toggleWatchlistItem(id: string, enabled?: boolean): Promise<CanonicalWatchlistItem | null> {
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) throw new Error(`Failed to update watchlist item: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] toggleWatchlistItem error:', err);
      return null;
    }
  }

  public async getAlertRules(filter?: { securityId?: string; symbol?: string }): Promise<AlertRule[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.securityId) params.append('securityId', filter.securityId);
      if (filter?.symbol) params.append('symbol', filter.symbol);
      const res = await fetch(`/api/alerts/rules?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch alert rules: ${res.statusText}`);
      const data = await res.json();
      return data.rules || [];
    } catch (err) {
      console.warn('[AlertsClient] getAlertRules error:', err);
      return [];
    }
  }

  public async createAlertRule(ruleData: {
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
  }): Promise<AlertRule | null> {
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });
      if (!res.ok) throw new Error(`Failed to create alert rule: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] createAlertRule error:', err);
      return null;
    }
  }

  public async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    try {
      const res = await fetch(`/api/alerts/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`Failed to update alert rule: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] updateAlertRule error:', err);
      return null;
    }
  }

  public async deleteAlertRule(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/alerts/rules/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.error('[AlertsClient] deleteAlertRule error:', err);
      return false;
    }
  }

  public async getAlertEvents(filter?: { isRead?: boolean; priority?: string; limit?: number }): Promise<AlertEvent[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.isRead !== undefined) params.append('isRead', String(filter.isRead));
      if (filter?.priority) params.append('priority', filter.priority);
      if (filter?.limit) params.append('limit', String(filter.limit));
      const res = await fetch(`/api/alerts/events?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch alert events: ${res.statusText}`);
      const data = await res.json();
      return data.events || [];
    } catch (err) {
      console.warn('[AlertsClient] getAlertEvents error:', err);
      return [];
    }
  }

  public async evaluateAlerts(force = false): Promise<EvaluateAlertsResponse | null> {
    try {
      const res = await fetch('/api/alerts/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });
      if (!res.ok) throw new Error(`Failed to evaluate alerts: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] evaluateAlerts error:', err);
      return null;
    }
  }

  public async generateAlertContext(eventId: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(eventId)}/analyze`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to generate alert analysis: ${res.statusText}`);
      const data = await res.json();
      return data.contextualAnalysis || null;
    } catch (err) {
      console.error('[AlertsClient] generateAlertContext error:', err);
      return null;
    }
  }

  public async markAlertRead(eventId: string): Promise<AlertEvent | null> {
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(eventId)}/read`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to mark alert as read: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] markAlertRead error:', err);
      return null;
    }
  }

  public async acknowledgeAlert(eventId: string): Promise<AlertEvent | null> {
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(eventId)}/acknowledge`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to acknowledge alert: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('[AlertsClient] acknowledgeAlert error:', err);
      return null;
    }
  }
}

export const alertsClient = new AlertsClient();
