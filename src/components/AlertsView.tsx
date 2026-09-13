import React, { useState, useEffect, useCallback } from 'react';
import { AlertItem, EvidenceSource, ActiveScreen, AlertEvent, AlertRule } from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { alertsClient } from '../services/alertsClient';
import {
  Bell,
  CheckCheck,
  Filter,
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronRight,
  Shield,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  Clock,
  ExternalLink
} from 'lucide-react';

interface AlertsViewProps {
  alerts: AlertItem[];
  onMarkAllRead: () => void;
  onToggleRead: (id: string) => void;
  onSelectStock: (ticker: string) => void;
  onOpenEvidence: (evidence: EvidenceSource) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  onMarkAllRead,
  onToggleRead,
  onSelectStock,
  onOpenEvidence,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'events' | 'disclosures' | 'rules'>('events');
  const [liveEvents, setLiveEvents] = useState<AlertEvent[]>([]);
  const [activeRules, setActiveRules] = useState<AlertRule[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);

  // Filters for Live Events
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [events, rules] = await Promise.all([
        alertsClient.getAlertEvents(),
        alertsClient.getAlertRules()
      ]);
      setLiveEvents(events);
      setActiveRules(rules);
    } catch (err) {
      console.warn('Failed to load live alert events or rules:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      await alertsClient.evaluateAlerts(true);
      await loadData();
    } catch (err) {
      console.error('Evaluation failed:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGenerateAnalysis = async (eventId: string) => {
    setAnalyzingEventId(eventId);
    try {
      const commentary = await alertsClient.generateAlertContext(eventId);
      if (commentary) {
        setLiveEvents(prev =>
          prev.map(e => e.eventId === eventId ? { ...e, contextualAnalysis: commentary } : e)
        );
      }
    } catch (err) {
      console.error('Failed to generate analysis:', err);
    } finally {
      setAnalyzingEventId(null);
    }
  };

  const handleAcknowledge = async (eventId: string) => {
    try {
      await alertsClient.acknowledgeAlert(eventId);
      setLiveEvents(prev =>
        prev.map(e => e.eventId === eventId ? { ...e, isAcknowledged: true, isRead: true } : e)
      );
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const filteredEvents = liveEvents.filter(e => {
    if (selectedPriority !== 'All' && e.priority !== selectedPriority) return false;
    if (showUnreadOnly && e.isRead) return false;
    return true;
  });

  const unreadEventsCount = liveEvents.filter(e => !e.isRead).length;

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              MONITORED INTELLIGENCE & ALERT SURVEILLANCE
            </h1>
            {unreadEventsCount > 0 && (
              <span className="text-xs font-mono-data bg-[#f43f5e] text-white px-2 py-0.5 rounded-full font-bold">
                {unreadEventsCount} UNREAD
              </span>
            )}
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Deterministic surveillance of price boundaries, portfolio covariance, and verified multi-market telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="px-3 py-1.5 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#38bdf8] text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Evaluate active rules against real-time provider data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>{isEvaluating ? 'Evaluating...' : 'Evaluate Rules'}</span>
          </button>

          <button
            onClick={() => {
              onMarkAllRead();
              alertsClient.getAlertEvents().then(events => {
                events.forEach(e => alertsClient.markAlertRead(e.eventId));
                setLiveEvents(prev => prev.map(e => ({ ...e, isRead: true })));
              });
            }}
            className="px-3 py-1.5 bg-[#0d1c2d] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#d4e4fa] text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Mark All As Read</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1c2b3c] pb-2 font-mono-data text-xs">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-3 py-1.5 rounded-xs transition-colors font-semibold flex items-center gap-1.5 ${
            activeTab === 'events'
              ? 'bg-[#38bdf8] text-[#051424]'
              : 'bg-[#090d14] text-[#87929a] hover:text-[#d4e4fa] border border-[#1c2b3c]'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Live Alert Triggers ({liveEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-1.5 rounded-xs transition-colors font-semibold flex items-center gap-1.5 ${
            activeTab === 'rules'
              ? 'bg-[#38bdf8] text-[#051424]'
              : 'bg-[#090d14] text-[#87929a] hover:text-[#d4e4fa] border border-[#1c2b3c]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Active Rules ({activeRules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('disclosures')}
          className={`px-3 py-1.5 rounded-xs transition-colors font-semibold flex items-center gap-1.5 ${
            activeTab === 'disclosures'
              ? 'bg-[#38bdf8] text-[#051424]'
              : 'bg-[#090d14] text-[#87929a] hover:text-[#d4e4fa] border border-[#1c2b3c]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>SEC Disclosures ({alerts.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE DETERMINISTIC EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filter Ribbon */}
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-data">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[#87929a] uppercase text-[11px]">Priority:</span>
                <select
                  value={selectedPriority}
                  onChange={e => setSelectedPriority(e.target.value)}
                  className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2 py-1 text-xs text-[#d4e4fa] focus:outline-none"
                >
                  <option value="All">All Priorities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[#87929a] hover:text-[#d4e4fa]">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={e => setShowUnreadOnly(e.target.checked)}
                  className="accent-[#38bdf8]"
                />
                <span className="text-[11px]">Unread Only</span>
              </label>
            </div>

            <div className="text-[11px] text-[#87929a]">
              Showing {filteredEvents.length} of {liveEvents.length} triggered alerts
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-3">
            {filteredEvents.map(event => (
              <div
                key={event.eventId}
                className={`bg-[#090d14] border rounded-sm p-4 text-xs font-mono-data transition-all space-y-3 ${
                  !event.isRead ? 'border-[#38bdf8]/60 bg-[#0d1c2d]/50' : 'border-[#1c2b3c]'
                }`}
              >
                {/* Event Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2b3c] pb-2.5">
                  <div className="flex items-center gap-2">
                    {/* Epistemic Status Badge */}
                    <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold tracking-wider uppercase border ${
                      event.epistemicStatus === 'REAL'
                        ? 'bg-[#064e3b]/40 text-[#34d399] border-[#059669]'
                        : event.epistemicStatus === 'CALCULATED'
                        ? 'bg-[#3b0764]/40 text-[#c084fc] border-[#7e22ce]'
                        : event.epistemicStatus === 'SIMULATED'
                        ? 'bg-[#78350f]/40 text-[#fbbf24] border-[#d97706]'
                        : 'bg-[#1f2937]/40 text-[#9ca3af] border-[#4b5563]'
                    }`}>
                      {event.epistemicStatus}
                    </span>

                    {/* Priority Badge */}
                    <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                      event.priority === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : event.priority === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    }`}>
                      {event.priority}
                    </span>

                    {/* Symbol / Asset */}
                    {event.symbol && (
                      <button
                        onClick={() => onSelectStock(event.symbol!)}
                        className="font-bold text-sm text-[#38bdf8] hover:underline"
                      >
                        {event.symbol}
                      </button>
                    )}

                    <span className="text-[#d4e4fa] font-semibold text-xs">
                      {event.companyName || 'Portfolio Alert'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#87929a]">
                    <span>{new Date(event.triggeredAt).toLocaleTimeString()}</span>
                    {!event.isAcknowledged && (
                      <button
                        onClick={() => handleAcknowledge(event.eventId)}
                        className="px-2 py-0.5 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#38bdf8] rounded-xs transition-colors text-[10px]"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>

                {/* Event Content: Trigger Condition & Value */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-[#051424] border border-[#1c2b3c] rounded-xs">
                  <div>
                    <span className="text-[10px] text-[#87929a] uppercase font-bold block mb-0.5">
                      TRIGGER CONDITION:
                    </span>
                    <p className="text-[#d4e4fa] font-semibold text-xs">{event.reason}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#87929a] uppercase font-bold block mb-0.5">
                      OBSERVED VS THRESHOLD:
                    </span>
                    <p className="text-[#38bdf8] font-semibold text-xs">
                      Observed: {typeof event.observedValue === 'number' ? event.observedValue.toLocaleString() : event.observedValue}{' '}
                      | Threshold: {typeof event.threshold === 'number' ? event.threshold.toLocaleString() : event.threshold}
                    </p>
                  </div>
                </div>

                {/* AI Context Card (Optional / Grounded) */}
                {event.contextualAnalysis ? (
                  <div className="p-3 bg-[#0a192f]/50 border border-[#0284c7]/40 rounded-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[#38bdf8] text-[10px] font-bold uppercase">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Investment Context (Non-Causal Commentary):</span>
                    </div>
                    <p className="text-[#bdc8d1] leading-relaxed text-[11px]">
                      {event.contextualAnalysis}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#87929a]">
                      Provider: <strong>{event.provider}</strong> ({event.market || 'Global'})
                    </span>
                    <button
                      onClick={() => handleGenerateAnalysis(event.eventId)}
                      disabled={analyzingEventId === event.eventId}
                      className="px-2.5 py-1 bg-[#0d1c2d] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#38bdf8] text-[11px] rounded-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className={`w-3 h-3 ${analyzingEventId === event.eventId ? 'animate-spin' : ''}`} />
                      <span>{analyzingEventId === event.eventId ? 'Analyzing...' : 'Generate AI Context'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <div className="p-12 text-center text-[#87929a] font-mono-data text-xs bg-[#090d14] border border-[#1c2b3c] rounded-sm">
                No alert events currently recorded. All watched thresholds are clear.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE RULES */}
      {activeTab === 'rules' && (
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3 font-mono-data text-xs">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
            <span className="font-bold text-[#d4e4fa] uppercase">Configured Alert Rules</span>
            <span className="text-[11px] text-[#87929a]">{activeRules.length} Active Rules</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#87929a] border-b border-[#1c2b3c] text-[11px]">
                  <th className="py-2 px-2">ASSET / TARGET</th>
                  <th className="py-2 px-2">RULE TYPE</th>
                  <th className="py-2 px-2 text-right">THRESHOLD</th>
                  <th className="py-2 px-2 text-center">COMPARISON</th>
                  <th className="py-2 px-2 text-center">COOLDOWN</th>
                  <th className="py-2 px-2 text-center">PRIORITY</th>
                  <th className="py-2 px-2 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2b3c]">
                {activeRules.map(rule => (
                  <tr key={rule.alertRuleId} className="hover:bg-[#0d1c2d]">
                    <td className="py-2.5 px-2 font-bold text-[#38bdf8]">
                      {rule.symbol || rule.portfolioId || 'Portfolio'}
                    </td>
                    <td className="py-2.5 px-2 text-[#d4e4fa]">{rule.alertType}</td>
                    <td className="py-2.5 px-2 text-right font-medium text-[#d4e4fa]">{rule.threshold}</td>
                    <td className="py-2.5 px-2 text-center text-[#87929a]">{rule.comparison}</td>
                    <td className="py-2.5 px-2 text-center text-[#87929a]">{rule.cooldownMinutes}m</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.2 rounded-xs text-[10px] font-bold ${
                        rule.priority === 'CRITICAL' ? 'text-rose-400' : rule.priority === 'WARNING' ? 'text-amber-400' : 'text-sky-400'
                      }`}>
                        {rule.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                        rule.enabled ? 'bg-[#064e3b]/30 text-[#34d399]' : 'bg-[#1f2937] text-[#87929a]'
                      }`}>
                        {rule.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SEC DISCLOSURES (EXISTING) */}
      {activeTab === 'disclosures' && (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-[#090d14] border rounded-sm p-4 text-xs font-mono-data space-y-3 ${
                !alert.isRead ? 'border-[#38bdf8]/60 bg-[#0d1c2d]/50' : 'border-[#1c2b3c]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2b3c] pb-2.5">
                <div className="flex items-center gap-2">
                  <ProvenanceBadge tag={alert.provenanceType} size="xs" />
                  <span className="px-2 py-0.2 rounded-xs text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    {alert.severity}
                  </span>
                  {alert.ticker && (
                    <button
                      onClick={() => onSelectStock(alert.ticker!)}
                      className="font-bold text-[#38bdf8] hover:underline"
                    >
                      {alert.ticker}
                    </button>
                  )}
                  <h3 className="font-semibold text-sm text-[#d4e4fa]">{alert.title}</h3>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#87929a]">
                  <span>{alert.timestamp}</span>
                  <button
                    onClick={() => onToggleRead(alert.id)}
                    className="hover:text-[#38bdf8] transition-colors"
                  >
                    {alert.isRead ? 'Mark Unread' : 'Mark Read'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[#87929a] uppercase font-bold">WHAT CHANGED:</span>
                <p className="text-[#d4e4fa] leading-relaxed text-[12px]">{alert.whatChanged}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[#f59e0b] uppercase font-bold">WHY IT MATTERS:</span>
                <p className="text-[#bdc8d1] leading-relaxed text-[12px]">{alert.whyItMatters}</p>
              </div>

              <div className="p-2.5 bg-[#051424] border-l-2 border-[#38bdf8] rounded-r-xs space-y-1">
                <span className="text-[10px] text-[#38bdf8] uppercase font-bold">
                  DECISION-SUPPORT GUIDANCE (NOT AUTOMATED ORDER):
                </span>
                <p className="text-[#d4e4fa] text-[11px]">{alert.recommendedAction}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
