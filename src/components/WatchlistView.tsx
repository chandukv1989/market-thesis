import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Stock, ThesisStatus, ActiveScreen, AlertRule, AlertRuleType } from '../types';
import { ThesisStatusBadge } from './common/ThesisStatusBadge';
import { alertsClient } from '../services/alertsClient';
import { resolveSecurity } from '../data/canonicalSecurities';
import {
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface WatchlistViewProps {
  stocks: Stock[];
  watchlistTickers: string[];
  onRemoveFromWatchlist: (ticker: string) => void;
  onSelectStock: (ticker: string) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  stocks,
  watchlistTickers,
  onRemoveFromWatchlist,
  onSelectStock,
  onNavigate
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'score' | 'change' | 'ticker'>('score');
  const [activeRules, setActiveRules] = useState<AlertRule[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ evaluated: number; triggered: number } | null>(null);

  // New stock ticker input
  const [newTickerInput, setNewTickerInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Modal for creating alert rule on a stock
  const [alertModalStock, setAlertModalStock] = useState<Stock | null>(null);
  const [alertType, setAlertType] = useState<AlertRuleType>('PRICE_ABOVE');
  const [alertThreshold, setAlertThreshold] = useState<string>('');
  const [alertCooldown, setAlertCooldown] = useState<number>(60);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  // Fetch active rules from server
  const loadRules = useCallback(async () => {
    try {
      const rules = await alertsClient.getAlertRules();
      setActiveRules(rules);
    } catch (err) {
      console.warn('Failed to load alert rules:', err);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const watchlistedStocks = useMemo(() => {
    const map = new Map<string, Stock>();
    stocks.forEach(s => {
      if (watchlistTickers.includes(s.ticker) && !map.has(s.ticker)) {
        map.set(s.ticker, s);
      }
    });
    return Array.from(map.values());
  }, [stocks, watchlistTickers]);

  const filtered = watchlistedStocks
    .filter(s => selectedStatus === 'All' || s.thesisStatus === selectedStatus)
    .sort((a, b) => {
      if (sortBy === 'score') return b.overallScore - a.overallScore;
      if (sortBy === 'change') return b.changePercent - a.changePercent;
      return a.ticker.localeCompare(b.ticker);
    });

  const statuses: ('All' | ThesisStatus)[] = [
    'All',
    'Healthy',
    'Improving',
    'Watch',
    'Deteriorating',
    'Thesis Broken'
  ];

  const handleAddSecurity = async () => {
    const clean = newTickerInput.trim().toUpperCase();
    if (!clean) return;

    const resolved = resolveSecurity(clean);
    if (!resolved) {
      setInputError(`Could not identify security "${clean}". Try NVDA, AAPL, RELIANCE, TCS.`);
      return;
    }

    setInputError(null);
    try {
      await alertsClient.addWatchlistItem({
        symbol: resolved.symbol,
        securityId: resolved.id,
        market: resolved.market,
        exchange: resolved.exchange,
        currency: resolved.currency
      });
      // Also notify parent if not in list
      if (!watchlistTickers.includes(resolved.symbol)) {
        onSelectStock(resolved.symbol);
      }
      setNewTickerInput('');
      loadRules();
    } catch (err) {
      setInputError('Failed to add security to watchlist');
    }
  };

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setEvalResult(null);
    try {
      const res = await alertsClient.evaluateAlerts(true);
      if (res) {
        setEvalResult({ evaluated: res.evaluatedCount, triggered: res.triggeredCount });
      }
      loadRules();
    } catch (err) {
      console.error('Failed to evaluate alerts:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCreateRule = async () => {
    if (!alertModalStock || !alertThreshold) return;
    const num = parseFloat(alertThreshold);
    if (isNaN(num)) return;

    setIsCreatingRule(true);
    try {
      await alertsClient.createAlertRule({
        securityId: alertModalStock.id || `sec-${alertModalStock.ticker.toLowerCase()}`,
        symbol: alertModalStock.ticker,
        alertType,
        threshold: num,
        cooldownMinutes: alertCooldown,
        priority: 'WARNING'
      });
      setAlertModalStock(null);
      setAlertThreshold('');
      loadRules();
    } catch (err) {
      console.error('Failed to create alert rule:', err);
    } finally {
      setIsCreatingRule(false);
    }
  };

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              THESIS SURVEILLANCE & ALERT WATCHLIST
            </h1>
            <span className="text-xs font-mono-data text-[#87929a] px-2 py-0.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
              {watchlistedStocks.length} ASSETS MONITORED
            </span>
            <span className="text-xs font-mono-data text-[#38bdf8] px-2 py-0.5 bg-[#0369a1]/20 border border-[#0284c7]/40 rounded-xs">
              {activeRules.filter(r => r.enabled).length} ACTIVE RULES
            </span>
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Continuous provider-aware thesis tracking, deterministic price/volume breakers, and multi-market surveillance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunEvaluation}
            disabled={isEvaluating}
            className="px-3.5 py-1.5 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#38bdf8] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Trigger immediate deterministic evaluation of all active alert rules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Evaluating...' : 'Evaluate Rules'}</span>
          </button>

          <button
            onClick={() => onNavigate('discover')}
            className="px-3.5 py-1.5 bg-[#38bdf8] hover:bg-[#7bd0ff] text-[#051424] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Discover Assets</span>
          </button>
        </div>
      </div>

      {/* Evaluation Feedback Banner */}
      {evalResult && (
        <div className="bg-[#0b1b2b] border border-[#0284c7]/40 p-3 rounded-sm flex items-center justify-between text-xs font-mono-data">
          <div className="flex items-center gap-2 text-[#38bdf8]">
            <CheckCircle2 className="w-4 h-4 text-[#34d399]" />
            <span>
              Deterministic evaluation complete: <strong>{evalResult.evaluated}</strong> rules evaluated.{' '}
              {evalResult.triggered > 0 ? (
                <span className="text-[#f43f5e] font-bold">{evalResult.triggered} alert(s) triggered.</span>
              ) : (
                <span className="text-[#34d399]">All monitored boundaries operating within normal thresholds.</span>
              )}
            </span>
          </div>
          {evalResult.triggered > 0 && (
            <button
              onClick={() => onNavigate('alerts')}
              className="px-2.5 py-1 bg-[#f43f5e] hover:bg-[#fb7185] text-white font-bold rounded-xs transition-colors"
            >
              View Triggered Alerts
            </button>
          )}
        </div>
      )}

      {/* Quick Add Asset Bar */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-data">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <span className="text-[#87929a] uppercase text-[11px] font-bold">Quick Add Symbol:</span>
          <input
            type="text"
            placeholder="e.g. NVDA, MSFT, RELIANCE, TCS..."
            value={newTickerInput}
            onChange={e => {
              setNewTickerInput(e.target.value);
              setInputError(null);
            }}
            onKeyDown={e => e.key === 'Enter' && handleAddSecurity()}
            className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8] flex-1 max-w-xs uppercase"
          />
          <button
            onClick={handleAddSecurity}
            className="px-3 py-1 bg-[#0284c7] hover:bg-[#38bdf8] text-white font-semibold text-xs rounded-xs transition-colors"
          >
            Add
          </button>
        </div>
        {inputError && (
          <span className="text-[#f43f5e] text-[11px] font-medium">{inputError}</span>
        )}
      </div>

      {/* Filter & Metric Bar */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-data">
        {/* Thesis Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[#87929a] text-[11px] uppercase mr-2">Filter Thesis:</span>
          {statuses.map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-xs transition-colors text-[11px] ${
                selectedStatus === st
                  ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                  : 'bg-[#0d1c2d] text-[#87929a] hover:text-[#d4e4fa] border border-[#1c2b3c]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-[#87929a] text-[11px] uppercase">Sort By:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2 py-1 text-xs text-[#d4e4fa] focus:outline-none"
          >
            <option value="score">Decision Score (High to Low)</option>
            <option value="change">Today Change %</option>
            <option value="ticker">Ticker Symbol</option>
          </select>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead>
              <tr className="text-[#87929a] border-b border-[#1c2b3c] text-[11px]">
                <th className="py-2.5 px-2">TICKER / NAME</th>
                <th className="py-2.5 px-2 text-center">MARKET / PROVIDER</th>
                <th className="py-2.5 px-2 text-right">PRICE</th>
                <th className="py-2.5 px-2 text-right">TODAY</th>
                <th className="py-2.5 px-2 text-center">DECISION SCORE</th>
                <th className="py-2.5 px-2 text-center">THESIS STATUS</th>
                <th className="py-2.5 px-2 text-center">ACTIVE RULES</th>
                <th className="py-2.5 px-2 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2b3c]">
              {filtered.map(stock => {
                const stockRules = activeRules.filter(
                  r => r.symbol?.toUpperCase() === stock.ticker.toUpperCase() || r.securityId === stock.id
                );
                return (
                  <tr
                    key={stock.ticker}
                    onClick={() => onSelectStock(stock.ticker)}
                    className="hover:bg-[#0d1c2d] cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#38bdf8] group-hover:underline">
                          {stock.ticker}
                        </span>
                        {stock.market === 'INDIA' ? (
                          <span className="text-[9px] font-mono-data px-1 py-0.2 bg-[#1e1b4b] text-[#818cf8] border border-[#3730a3] rounded-xs font-semibold">
                            NSE
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono-data px-1 py-0.2 bg-[#0d1c2d] text-[#87929a] border border-[#1c2b3c] rounded-xs">
                            US
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#87929a] truncate max-w-[160px]">
                        {stock.name}
                      </div>
                    </td>

                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-[#bdc8d1] font-medium">
                          {stock.market === 'INDIA' ? 'FYERS (India)' : 'Twelve Data (US)'}
                        </span>
                        <span className="text-[9px] text-[#34d399] font-bold">
                          VERIFIED
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-2 text-right font-medium text-[#d4e4fa]">
                      {stock.currency === 'INR' ? '₹' : '$'}{stock.price.toFixed(2)}
                    </td>

                    <td className={`py-3 px-2 text-right font-medium ${
                      stock.changePercent >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'
                    }`}>
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </td>

                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-xs font-bold text-xs bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30">
                        {stock.overallScore}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-center">
                      <ThesisStatusBadge status={stock.thesisStatus} size="sm" />
                    </td>

                    <td className="py-3 px-2 text-center">
                      {stockRules.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-xs font-bold text-[10px] bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/40">
                          {stockRules.length} Rule{stockRules.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#87929a]">None</span>
                      )}
                    </td>

                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setAlertModalStock(stock);
                            setAlertThreshold(stock.price.toString());
                          }}
                          className="px-2 py-1 bg-[#0e2238] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#38bdf8] text-[11px] rounded-xs flex items-center gap-1 transition-colors"
                          title="Set Alert Rule"
                        >
                          <Bell className="w-3 h-3" />
                          <span>Alert</span>
                        </button>
                        <button
                          onClick={() => onSelectStock(stock.ticker)}
                          className="px-2 py-1 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#d4e4fa] text-[11px] rounded-xs transition-colors"
                        >
                          Deep Dive
                        </button>
                        <button
                          onClick={() => onRemoveFromWatchlist(stock.ticker)}
                          className="p-1 text-[#87929a] hover:text-[#f43f5e] hover:bg-[#1c2b3c] rounded-xs transition-colors"
                          title="Remove from Watchlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#87929a] font-mono-data">
                    No watchlist assets matching filter "{selectedStatus}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Rule Creation Modal */}
      {alertModalStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-5 max-w-md w-full space-y-4 font-mono-data text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#38bdf8]" />
                <h3 className="font-bold text-sm text-[#d4e4fa]">
                  SET ALERT: {alertModalStock.ticker}
                </h3>
              </div>
              <button
                onClick={() => setAlertModalStock(null)}
                className="text-[#87929a] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#87929a] mb-1">Alert Condition:</label>
                <select
                  value={alertType}
                  onChange={e => setAlertType(e.target.value as AlertRuleType)}
                  className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs p-2 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
                >
                  <option value="PRICE_ABOVE">Price Above Threshold ({alertModalStock.currency})</option>
                  <option value="PRICE_BELOW">Price Below Threshold ({alertModalStock.currency})</option>
                  <option value="PRICE_CROSSES_ABOVE">Price Crosses Above (Requires Crossing)</option>
                  <option value="PRICE_CROSSES_BELOW">Price Crosses Below (Requires Crossing)</option>
                  <option value="DAILY_CHANGE_ABOVE">Daily Change Above (+X%)</option>
                  <option value="DAILY_CHANGE_BELOW">Daily Change Below (-X%)</option>
                  <option value="DAILY_CHANGE_ABSOLUTE_ABOVE">Absolute Daily Move (|X%|)</option>
                  <option value="VOLUME_ABOVE">Volume Above Absolute Shares</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#87929a] mb-1">
                  Threshold Value (Current: {alertModalStock.currency === 'INR' ? '₹' : '$'}{alertModalStock.price}):
                </label>
                <input
                  type="number"
                  step="any"
                  value={alertThreshold}
                  onChange={e => setAlertThreshold(e.target.value)}
                  placeholder="e.g. 150.00"
                  className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs p-2 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#87929a] mb-1">Cooldown (Minutes):</label>
                <select
                  value={alertCooldown}
                  onChange={e => setAlertCooldown(parseInt(e.target.value, 10))}
                  className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs p-2 text-xs text-[#d4e4fa] focus:outline-none"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={60}>60 Minutes (Default)</option>
                  <option value={240}>4 Hours</option>
                  <option value={1440}>24 Hours</option>
                </select>
              </div>

              <div className="p-2.5 bg-[#051424] border border-[#1c2b3c] rounded-xs text-[11px] text-[#87929a] space-y-1">
                <div className="flex items-center gap-1.5 text-[#38bdf8]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="font-bold">Deterministic Grounding</span>
                </div>
                <p>
                  This rule evaluates directly on verified market quotes from {alertModalStock.market === 'INDIA' ? 'FYERS' : 'Twelve Data'}. Epistemic status will reflect verified provider telemetry.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c2b3c]">
              <button
                onClick={() => setAlertModalStock(null)}
                className="px-3 py-1.5 bg-[#0d1c2d] hover:bg-[#1c2b3c] text-[#87929a] rounded-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                disabled={isCreatingRule || !alertThreshold}
                className="px-4 py-1.5 bg-[#0284c7] hover:bg-[#38bdf8] text-white font-semibold rounded-xs disabled:opacity-50"
              >
                {isCreatingRule ? 'Creating...' : 'Activate Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
