import React, { useState, useEffect } from 'react';
import {
  Stock,
  PortfolioData,
  InvestmentDecisionAssessment,
  SecurityDecisionComparison,
  DecisionDimensionAssessment,
  DecisionInvalidationCondition
} from '../../types';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Layers,
  FileText,
  PieChart,
  Activity,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  Scale,
  ExternalLink,
  Copy,
  Check,
  AlertOctagon
} from 'lucide-react';

interface InvestmentAssessmentViewProps {
  stock: Stock;
  portfolio: PortfolioData;
  allStocks: Stock[];
  onSelectTicker: (ticker: string) => void;
  onOpenEvidence?: (evidenceId: string) => void;
}

export const InvestmentAssessmentView: React.FC<InvestmentAssessmentViewProps> = ({
  stock,
  portfolio,
  allStocks,
  onSelectTicker,
  onOpenEvidence
}) => {
  const [assessment, setAssessment] = useState<InvestmentDecisionAssessment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Security Comparison State
  const [compareTarget, setCompareTarget] = useState<string>('');
  const [comparison, setComparison] = useState<SecurityDecisionComparison | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // Fetch decision assessment
  const fetchAssessment = async (date?: string, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/decisions/${stock.ticker}${date ? `?asOfDate=${date}` : ''}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load decision assessment: ${res.statusText}`);
      }
      const data = await res.json();
      setAssessment(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessment(asOfDate);
  }, [stock.ticker, asOfDate]);

  // Handle side-by-side comparison
  const handleCompare = async (targetTicker: string) => {
    if (!targetTicker || targetTicker === stock.ticker) return;
    setComparing(true);
    try {
      const res = await fetch('/api/decisions/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          securityIdA: stock.ticker,
          securityIdB: targetTicker,
          asOfDate
        })
      });
      if (res.ok) {
        const data = await res.json();
        setComparison(data);
        setShowComparison(true);
      }
    } catch (err) {
      console.error('Failed to compare decisions', err);
    } finally {
      setComparing(false);
    }
  };

  const copyDecisionId = () => {
    if (assessment?.decisionId) {
      navigator.clipboard?.writeText(assessment.decisionId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const getOverallColor = (overall: string) => {
    switch (overall) {
      case 'POSITIVE':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
      case 'CONSTRUCTIVE':
        return 'text-[#38bdf8] border-[#38bdf8]/40 bg-[#38bdf8]/10';
      case 'NEUTRAL':
        return 'text-slate-300 border-slate-500/40 bg-slate-500/10';
      case 'CAUTIOUS':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
      case 'NEGATIVE':
        return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
      default:
        return 'text-slate-400 border-slate-600 bg-slate-800/40';
    }
  };

  const getConvictionBadge = (conviction: string) => {
    switch (conviction) {
      case 'HIGH':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'MODERATE':
        return 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30';
      case 'LOW':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      default:
        return 'bg-slate-700/40 text-slate-400 border border-slate-600';
    }
  };

  const getDimensionBadge = (category: string) => {
    switch (category) {
      case 'POSITIVE':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'CAUTIOUS':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'NEGATIVE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'INSUFFICIENT':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      default:
        return 'text-slate-300 bg-slate-800/60 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 text-[#d4e4fa]">
      {/* HEADER BANNER & PIT CONTROLS */}
      <div className="bg-[#0a1622] border border-[#1c2b3c] rounded-sm p-4 lg:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#87929a] uppercase tracking-wider mb-1">
              <span>Investment Decision Intelligence</span>
              <span>·</span>
              <span>Phase 15 Framework v1.0</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold font-mono tracking-wide text-white">
                {stock.ticker}
              </h1>
              <span className="text-sm text-[#87929a]">{stock.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-xs bg-[#0d1f30] text-[#87929a] border border-[#1c2b3c] font-mono">
                {stock.market} · {stock.currency}
              </span>
            </div>
          </div>

          {/* Point-in-Time Date & Refresh Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-[#06101a] px-3 py-1.5 rounded-sm border border-[#1c2b3c] text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="text-[#87929a]">As of:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => fetchAssessment(asOfDate, true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-sm bg-[#122234] hover:bg-[#1a3048] text-xs font-mono border border-[#223950] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Evaluate</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-[#38bdf8] animate-spin" />
            <span className="text-xs font-mono text-[#87929a]">
              Evaluating 10 deterministic dimensions across market, filings, quant, and portfolio context...
            </span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-sm text-xs font-mono text-rose-300">
            Error loading decision assessment: {error}
          </div>
        ) : assessment ? (
          <div className="space-y-4 pt-2">
            {/* OVERALL ASSESSMENT BADGE & CONVICTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#1c2b3c]">
              <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4 bg-[#06101a] p-4 rounded-sm border border-[#152435]">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#87929a] tracking-wider">
                    Overall Investment Setup
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold font-mono px-3 py-1 rounded-sm border ${getOverallColor(assessment.overallAssessment)}`}>
                      {assessment.overallAssessment}
                    </span>
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-sm ${getConvictionBadge(assessment.conviction)}`}>
                      {assessment.conviction} Conviction
                    </span>
                  </div>
                </div>

                <div className="sm:ml-auto space-y-1 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#1c2b3c]">
                  <div className="text-[10px] font-mono text-[#87929a] uppercase">Composite Score</div>
                  <div className="text-lg font-mono font-bold text-white">
                    {assessment.compositeScore > 0 ? `+${assessment.compositeScore.toFixed(2)}` : assessment.compositeScore.toFixed(2)}
                    <span className="text-xs text-[#87929a] font-normal"> / 1.0</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#87929a]">
                    Evidence: {assessment.evidenceCoverage.rating} ({assessment.evidenceCoverage.totalEvidenceCount} items)
                  </div>
                </div>
              </div>

              {/* Security Comparison Selector */}
              <div className="bg-[#06101a] p-4 rounded-sm border border-[#152435] flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-[#87929a] tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Scale className="w-3 h-3 text-[#38bdf8]" />
                    <span>Security Comparison</span>
                  </div>
                  <p className="text-xs text-[#87929a]">
                    Compare deterministic scores against another instrument.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <select
                    value={compareTarget}
                    onChange={(e) => {
                      setCompareTarget(e.target.value);
                      handleCompare(e.target.value);
                    }}
                    className="flex-1 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Compare with...</option>
                    {allStocks
                      .filter(s => s.ticker !== stock.ticker)
                      .map(s => (
                        <option key={s.ticker} value={s.ticker}>
                          {s.ticker} ({s.name})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* WHY THIS ASSESSMENT (KEY DRIVERS) & COUNTER EVIDENCE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#081522] border border-emerald-500/20 rounded-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>Key Analytical Drivers</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {assessment.keyDrivers.map((driver, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-mono mt-0.5">•</span>
                      <span>{driver}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-[#081522] border border-amber-500/20 rounded-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Counter-Evidence & Headwinds</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {assessment.counterEvidence.length > 0 ? (
                    assessment.counterEvidence.map((counter, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-mono mt-0.5">•</span>
                        <span>{counter}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No significant analytical counter-evidence detected.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* COMPARISON MODAL / DRAWER IF ACTIVE */}
      {showComparison && comparison && (
        <div className="bg-[#0a1622] border border-[#38bdf8]/40 rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#38bdf8]" />
              <h2 className="text-sm font-bold font-mono text-white uppercase">
                Deterministic Security Comparison: {stock.ticker} vs {compareTarget}
              </h2>
            </div>
            <button
              onClick={() => setShowComparison(false)}
              className="text-xs font-mono text-[#87929a] hover:text-white px-2 py-0.5 rounded-xs bg-[#122234]"
            >
              Close Comparison
            </button>
          </div>

          <div className="p-3 bg-[#06101a] border border-[#1c2b3c] rounded-sm text-xs font-mono">
            <span className="text-[#38bdf8] font-bold">Comparison Verdict: </span>
            <span>{comparison.summary}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1c2b3c] text-[#87929a] text-left">
                  <th className="py-2 px-3">Dimension</th>
                  <th className="py-2 px-3">{stock.ticker} Rating</th>
                  <th className="py-2 px-3">{compareTarget} Rating</th>
                  <th className="py-2 px-3">Analytical Advantage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152435]">
                {comparison.dimensionComparisons.map(d => (
                  <tr key={d.dimension} className="hover:bg-[#0d1f30]">
                    <td className="py-2.5 px-3 text-white font-bold">{d.dimensionName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-xs bg-[#122234] border border-[#1c2b3c]">
                        {d.securityAAssessment}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-xs bg-[#122234] border border-[#1c2b3c]">
                        {d.securityBAssessment}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-xs font-bold ${
                        d.advantage === 'SECURITY_A'
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                          : d.advantage === 'SECURITY_B'
                          ? 'text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30'
                          : 'text-slate-400 bg-slate-800'
                      }`}>
                        {d.advantage === 'SECURITY_A' ? stock.ticker : d.advantage === 'SECURITY_B' ? compareTarget : 'TIED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10 DECISION DIMENSIONS MATRIX */}
      {assessment && (
        <div className="bg-[#0a1622] border border-[#1c2b3c] rounded-sm p-4 lg:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#38bdf8]" />
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Decision Dimensions (10 Factor Matrix)
              </h2>
            </div>
            <span className="text-xs font-mono text-[#87929a]">
              Strictly Deterministic Calculations
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {assessment.dimensionsList.map((dim: DecisionDimensionAssessment) => {
              const isExpanded = expandedDimension === dim.dimension;
              return (
                <div
                  key={dim.dimension}
                  className="bg-[#06101a] border border-[#152435] rounded-sm transition-colors hover:border-[#223950]"
                >
                  <div
                    onClick={() => setExpandedDimension(isExpanded ? null : dim.dimension)}
                    className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-white w-48">
                        {dim.dimensionName}
                      </span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-xs border font-bold ${getDimensionBadge(dim.category)}`}>
                        {dim.assessment}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-[#0d1f30] text-[#87929a] border border-[#1c2b3c]">
                        Status: {dim.dataStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-[#87929a]">
                      <span className="hidden lg:inline text-slate-300 max-w-md truncate text-right">
                        {dim.rationale}
                      </span>
                      <span className="text-[#38bdf8] font-bold">
                        Weight: {(dim.weight * 100).toFixed(0)}%
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#122234] space-y-3 text-xs">
                      <div>
                        <span className="text-[#87929a] font-mono uppercase text-[10px] tracking-wider block mb-1">
                          Full Algorithmic Rationale:
                        </span>
                        <p className="text-slate-200">{dim.rationale}</p>
                      </div>

                      {dim.metrics && Object.keys(dim.metrics).length > 0 && (
                        <div>
                          <span className="text-[#87929a] font-mono uppercase text-[10px] tracking-wider block mb-1">
                            Deterministic Computed Metrics:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(dim.metrics).map(([k, v]) => (
                              <span key={k} className="px-2 py-1 bg-[#0d1f30] border border-[#1c2b3c] rounded-xs font-mono text-[11px]">
                                <span className="text-[#87929a]">{k}:</span> <span className="text-white font-bold">{String(v ?? 'N/A')}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {dim.supportingEvidenceIds.length > 0 && (
                        <div>
                          <span className="text-[#87929a] font-mono uppercase text-[10px] tracking-wider block mb-1">
                            Supporting Evidence IDs ({dim.supportingEvidenceIds.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                            {dim.supportingEvidenceIds.map(id => (
                              <span
                                key={id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenEvidence?.(id);
                                }}
                                className="px-2 py-0.5 bg-[#122234] hover:bg-[#1a3048] text-[#38bdf8] border border-[#223950] rounded-xs cursor-pointer"
                              >
                                {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {dim.limitations && dim.limitations.length > 0 && (
                        <div className="text-amber-300/80 font-mono text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Limitations: {dim.limitations.join('. ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* THESIS INVALIDATION CONDITIONS (FALSIFIABLE SAFEGUARDS) */}
      {assessment && (
        <div className="bg-[#0a1622] border border-[#1c2b3c] rounded-sm p-4 lg:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Thesis Invalidation Conditions
              </h2>
            </div>
            <span className="text-xs font-mono text-[#87929a]">
              Objective, Falsifiable Guards
            </span>
          </div>

          <p className="text-xs text-[#87929a]">
            Pre-defined quantitative and fundamental conditions that would falsify the current thesis and force an immediate negative or cautious downgrade:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assessment.invalidationConditions.map((cond: DecisionInvalidationCondition) => (
              <div
                key={cond.conditionId}
                className={`p-3.5 rounded-sm border ${
                  cond.status === 'TRIGGERED'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-[#06101a] border-[#152435]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-xs bg-[#0d1f30] text-[#87929a] border border-[#1c2b3c]">
                    {cond.category}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-xs font-bold ${
                    cond.status === 'TRIGGERED'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {cond.status === 'TRIGGERED' ? 'TRIGGERED (BREACHED)' : 'ACTIVE GUARD'}
                  </span>
                </div>
                <p className="text-xs text-white font-medium mb-2">{cond.condition}</p>
                {cond.threshold && (
                  <div className="text-[11px] font-mono text-[#87929a]">
                    Threshold: <span className="text-[#38bdf8]">{cond.threshold}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PORTFOLIO CONTEXT & CONCENTRATION IMPACT */}
      {assessment && (
        <div className="bg-[#0a1622] border border-[#1c2b3c] rounded-sm p-4 lg:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#38bdf8]" />
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Portfolio Fit & Concentration Context
              </h2>
            </div>
            <span className="text-xs font-mono text-[#87929a]">
              Phase 9 Risk Integration
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#06101a] p-3 rounded-sm border border-[#152435]">
              <span className="text-[10px] font-mono uppercase text-[#87929a] block mb-1">Holding Status</span>
              <span className={`text-sm font-mono font-bold ${assessment.portfolioContext.isHeld ? 'text-white' : 'text-[#87929a]'}`}>
                {assessment.portfolioContext.isHeld ? 'CURRENTLY HELD' : 'NOT HELD'}
              </span>
            </div>
            <div className="bg-[#06101a] p-3 rounded-sm border border-[#152435]">
              <span className="text-[10px] font-mono uppercase text-[#87929a] block mb-1">Current Weight</span>
              <span className="text-sm font-mono font-bold text-white">
                {assessment.portfolioContext.currentWeightPct !== undefined ? `${assessment.portfolioContext.currentWeightPct.toFixed(1)}%` : '0.0%'}
              </span>
            </div>
            <div className="bg-[#06101a] p-3 rounded-sm border border-[#152435]">
              <span className="text-[10px] font-mono uppercase text-[#87929a] block mb-1">Beta Contribution</span>
              <span className="text-sm font-mono font-bold text-white">
                {assessment.portfolioContext.portfolioBetaContribution !== undefined ? assessment.portfolioContext.portfolioBetaContribution.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="bg-[#06101a] p-3 rounded-sm border border-[#152435]">
              <span className="text-[10px] font-mono uppercase text-[#87929a] block mb-1">Marginal Risk Rating</span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-xs ${
                assessment.portfolioContext.marginalRiskRating === 'HIGH_CONCENTRATION'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {assessment.portfolioContext.marginalRiskRating}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-[#06101a] rounded-sm border border-[#152435] text-xs font-mono space-y-1">
            <span className="text-[#38bdf8] font-bold">Concentration & Sizing Rule: </span>
            <span className="text-slate-300">{assessment.portfolioContext.implication}</span>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL & DATA QUALITY */}
      {assessment && (
        <div className="bg-[#0a1622] border border-[#1c2b3c] rounded-sm p-4 lg:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Decision Audit Trail & Epistemic Status
              </h2>
            </div>
            <button
              onClick={copyDecisionId}
              className="px-2.5 py-1 rounded-xs bg-[#122234] hover:bg-[#1a3048] text-[11px] font-mono text-[#38bdf8] border border-[#223950] flex items-center gap-1.5 transition-colors"
            >
              {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId ? 'Copied ID' : 'Copy Decision ID'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-2 bg-[#06101a] p-3 rounded-sm border border-[#152435]">
              <span className="text-[#87929a] uppercase text-[10px] block">Audit Metadata</span>
              <div><span className="text-[#87929a]">Decision ID:</span> <span className="text-white select-all">{assessment.decisionId}</span></div>
              <div><span className="text-[#87929a]">As-of Date:</span> <span className="text-white">{assessment.asOfDate}</span></div>
              <div><span className="text-[#87929a]">Framework Version:</span> <span className="text-white">{assessment.frameworkVersion}</span></div>
              <div><span className="text-[#87929a]">Explanation Source:</span> <span className="text-[#38bdf8]">{assessment.explanation.generatedBy}</span></div>
            </div>

            <div className="space-y-2 bg-[#06101a] p-3 rounded-sm border border-[#152435]">
              <span className="text-[#87929a] uppercase text-[10px] block">Epistemic Classification Counts</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-1.5 bg-[#0d1f30] rounded-xs border border-[#1c2b3c]">
                  <span className="text-emerald-400 font-bold">REAL:</span> {assessment.dataQuality.epistemicSummary.REAL}
                </div>
                <div className="p-1.5 bg-[#0d1f30] rounded-xs border border-[#1c2b3c]">
                  <span className="text-[#38bdf8] font-bold">CALCULATED:</span> {assessment.dataQuality.epistemicSummary.CALCULATED}
                </div>
                <div className="p-1.5 bg-[#0d1f30] rounded-xs border border-[#1c2b3c]">
                  <span className="text-amber-400 font-bold">SIMULATED:</span> {assessment.dataQuality.epistemicSummary.SIMULATED}
                </div>
                <div className="p-1.5 bg-[#0d1f30] rounded-xs border border-[#1c2b3c]">
                  <span className="text-slate-400 font-bold">UNAVAILABLE:</span> {assessment.dataQuality.epistemicSummary.UNAVAILABLE}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY INSTITUTIONAL TERMINAL DISCLAIMER */}
      <div className="p-4 bg-[#05101a] border border-[#1c2b3c] rounded-sm text-center text-xs font-mono text-[#87929a] space-y-1">
        <div className="font-bold tracking-wider text-slate-300 uppercase">
          DECISION SUPPORT ONLY · NOT FINANCIAL ADVICE · NO GUARANTEED RETURNS · NO AUTOMATED EXECUTION
        </div>
        <div>
          Assessments are deterministically computed based on available point-in-time facts and historical disclosures.
          Past simulated performance does not guarantee future results. Broker trading execution is strictly prohibited.
        </div>
      </div>
    </div>
  );
};
