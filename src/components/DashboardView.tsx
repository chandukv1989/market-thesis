import React, { useState } from 'react';
import {
  Stock,
  PortfolioData,
  AlertItem,
  ActiveScreen,
  EvidenceSource
} from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { ThesisStatusBadge } from './common/ThesisStatusBadge';
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  PieChart,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Clock,
  ChevronRight,
  Zap,
  Filter,
  CheckCircle2
} from 'lucide-react';

interface DashboardViewProps {
  portfolio: PortfolioData;
  stocks: Stock[];
  alerts: AlertItem[];
  onSelectStock: (ticker: string) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenEvidence: (evidence: EvidenceSource) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  portfolio,
  stocks,
  alerts,
  onSelectStock,
  onNavigate,
  onOpenEvidence
}) => {
  const [quickQuery, setQuickQuery] = useState('');

  const quickActions = [
    { label: 'Investigate NVDA Margin Compression', ticker: 'NVDA' },
    { label: 'Run 100bps Rate Hike Stress Test', screen: 'portfolio' as ActiveScreen },
    { label: 'Screen High-ROIC FCF Compounders', screen: 'discover' as ActiveScreen },
    { label: 'Inspect Hyperscaler Capex Sustainability', screen: 'research' as ActiveScreen }
  ];

  const watchlistHighlights = stocks.slice(0, 5);

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Top Banner: What matters to my portfolio right now? */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[#38bdf8]/5 to-transparent pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" />
            <span className="font-mono-data text-xs uppercase tracking-wider text-[#a78bfa] font-semibold">
              EXECUTIVE BRIEFING • WHAT MATTERS TO MY PORTFOLIO RIGHT NOW
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono-data text-[#87929a]">
            <Clock className="w-3 h-3 text-[#34d399]" />
            <span>Market Simulation (Demo Data) • Freshness: 2m ago</span>
          </div>
        </div>

        <h2 className="text-base sm:text-lg font-semibold text-[#d4e4fa] tracking-tight mb-2">
          {portfolio.aiBriefing.headline}
        </h2>

        {/* Segregated Provenance Blocks inside Executive Briefing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center justify-between">
              <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
              <span className="text-[10px] font-mono-data text-[#87929a]">Probabilistic Synthesis</span>
            </div>
            <p className="text-[#bdc8d1]">{portfolio.aiBriefing.aiAnalysis}</p>
          </div>

          <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center justify-between">
              <ProvenanceBadge tag="CALCULATION" size="xs" />
              <span className="text-[10px] font-mono-data text-[#87929a]">Deterministic Portfolio Math</span>
            </div>
            <p className="text-[#bdc8d1]">{portfolio.aiBriefing.calculationFact}</p>
          </div>
        </div>

        {/* Quick Trigger Chips */}
        <div className="mt-3 pt-3 border-t border-[#1c2b3c] flex flex-wrap items-center gap-2 text-xs font-mono-data">
          <span className="text-[#87929a] text-[11px] uppercase">Rapid Inquiries:</span>
          {quickActions.map((qa, i) => (
            <button
              key={i}
              onClick={() => {
                if (qa.ticker) {
                  onSelectStock(qa.ticker);
                } else if (qa.screen) {
                  onNavigate(qa.screen);
                }
              }}
              className="px-2.5 py-1 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#38bdf8] rounded-xs transition-all flex items-center gap-1 text-[11px]"
            >
              <Zap className="w-3 h-3" />
              <span>{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio Snapshot Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* NAV & Value */}
        <div
          onClick={() => onNavigate('portfolio')}
          className="bg-[#090d14] border border-[#1c2b3c] hover:border-[#38bdf8]/50 cursor-pointer rounded-sm p-4 transition-colors group"
          title="Open complete portfolio ledger"
        >
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="group-hover:text-[#38bdf8] transition-colors">Portfolio Net Asset Value</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#d4e4fa] tracking-tight">
            ${portfolio.nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs font-mono-data">
            <span className="flex items-center text-[#34d399] font-semibold">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              +${portfolio.todayChange.toLocaleString(undefined, { minimumFractionDigits: 2 })} (+{portfolio.todayChangePct.toFixed(2)}%)
            </span>
            <span className="text-[#87929a] text-[10px]">Today</span>
          </div>
        </div>

        {/* Overall Cumulative Return */}
        <div
          onClick={() => onNavigate('portfolio')}
          className="bg-[#090d14] border border-[#1c2b3c] hover:border-[#38bdf8]/50 cursor-pointer rounded-sm p-4 transition-colors group"
          title="Open cumulative returns and performance analysis"
        >
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="group-hover:text-[#38bdf8] transition-colors">Cumulative Unrealized Return</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#34d399] tracking-tight">
            +${portfolio.unrealizedReturn.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs font-mono-data text-[#87929a]">
            <span className="text-[#34d399] font-semibold">+{portfolio.unrealizedReturnPct.toFixed(1)}%</span>
            <span>since inception (2022)</span>
          </div>
        </div>

        {/* Risk Score */}
        <div
          onClick={() => onNavigate('portfolio')}
          className="bg-[#090d14] border border-[#1c2b3c] hover:border-[#38bdf8]/50 cursor-pointer rounded-sm p-4 transition-colors group"
          title="Inspect portfolio risk decomposition"
        >
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="group-hover:text-[#38bdf8] transition-colors">Portfolio Risk Index</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-mono-data text-2xl font-bold text-amber-400">
              {portfolio.riskScore}
              <span className="text-xs text-[#87929a] font-normal">/100</span>
            </div>
            <span className="text-xs font-mono-data text-amber-400">{portfolio.riskLabel}</span>
          </div>
          <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${portfolio.riskScore}%` }} />
          </div>
        </div>

        {/* Diversification Score */}
        <div
          onClick={() => onNavigate('portfolio')}
          className="bg-[#090d14] border border-[#1c2b3c] hover:border-[#38bdf8]/50 cursor-pointer rounded-sm p-4 transition-colors group"
          title="Inspect asset and sector diversification"
        >
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="group-hover:text-[#38bdf8] transition-colors">Diversification Score</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-mono-data text-2xl font-bold text-[#38bdf8]">
              {portfolio.diversificationScore}
              <span className="text-xs text-[#87929a] font-normal">/100</span>
            </div>
            <span className="text-xs font-mono-data text-[#38bdf8]">{portfolio.diversificationLabel}</span>
          </div>
          <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#38bdf8] h-full rounded-full" style={{ width: `${portfolio.diversificationScore}%` }} />
          </div>
        </div>
      </div>

      {/* Asset Allocation & Sector Concentration Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Asset & Sector Breakdown Card */}
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              Asset Allocation & Exposures
            </h3>
            <ProvenanceBadge tag="CALCULATION" size="xs" />
          </div>

          {/* Macro Allocation Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono-data text-[#87929a]">
              <span>Equities: {portfolio.assetAllocation.equitiesPct}%</span>
              <span>Fixed Income: {portfolio.assetAllocation.fixedIncomePct}%</span>
              <span>Cash: {portfolio.assetAllocation.cashPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#1c2b3c] rounded-xs flex overflow-hidden">
              <div className="bg-[#38bdf8] h-full" style={{ width: `${portfolio.assetAllocation.equitiesPct}%` }} title="Equities" />
              <div className="bg-[#818cf8] h-full" style={{ width: `${portfolio.assetAllocation.fixedIncomePct}%` }} title="Fixed Income" />
              <div className="bg-[#34d399] h-full" style={{ width: `${portfolio.assetAllocation.cashPct}%` }} title="Cash" />
            </div>
          </div>

          {/* Sector Allocation Breakdown */}
          <div className="space-y-2 pt-2 border-t border-[#1c2b3c]">
            <div className="text-[11px] font-mono-data text-[#87929a] uppercase">Sector Concentration</div>
            <div className="space-y-2">
              {portfolio.sectorAllocation.map((sec, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono-data">
                    <span className="text-[#bdc8d1] truncate">{sec.sector}</span>
                    <span className="text-[#d4e4fa] font-semibold">{sec.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1c2b3c] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${sec.percentage}%`, backgroundColor: sec.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('portfolio')}
            className="w-full py-1.5 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] text-[#38bdf8] text-xs font-mono-data rounded-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Open Complete Portfolio Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Monitored Events & Intelligence Stream */}
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-[#d4e4fa] tracking-wider uppercase font-mono-data">
                INTELLIGENCE & MONITORED THESIS EVENTS
              </span>
              <span className="text-[10px] font-mono-data bg-[#1c2b3c] text-[#38bdf8] px-1.5 py-0.2 rounded-xs">
                {alerts.length} ALERTS
              </span>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs font-mono-data text-[#38bdf8] hover:underline flex items-center gap-1"
            >
              <span>View All Alerts</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {alerts.slice(0, 4).map(alert => (
              <div
                key={alert.id}
                className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] hover:border-[#273647] rounded-sm transition-all text-xs space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProvenanceBadge tag={alert.provenanceType} size="xs" />
                    {alert.ticker && (
                      <button
                        onClick={() => onSelectStock(alert.ticker!)}
                        className="font-mono-data font-bold text-[#38bdf8] hover:underline"
                      >
                        {alert.ticker}
                      </button>
                    )}
                    <span className="font-semibold text-[#d4e4fa]">{alert.title}</span>
                  </div>
                  <span className="text-[11px] font-mono-data text-[#87929a]">{alert.timestamp}</span>
                </div>

                <div className="text-[#bdc8d1] leading-relaxed text-[12px]">
                  <strong className="text-[#87929a] font-normal uppercase text-[10px] font-mono-data block mb-0.5">
                    WHAT CHANGED:
                  </strong>
                  {alert.whatChanged}
                </div>

                <div className="text-[#87929a] text-[11px] leading-relaxed">
                  <strong className="text-[#f59e0b] font-normal uppercase text-[10px] font-mono-data block mb-0.5">
                    WHY IT MATTERS:
                  </strong>
                  {alert.whyItMatters}
                </div>

                <div className="pt-1.5 border-t border-[#1c2b3c]/60 flex items-center justify-between text-[11px] font-mono-data text-[#87929a]">
                  <div className="flex items-center gap-1.5">
                    <span>Evidence:</span>
                    <span className="text-[#818cf8] underline cursor-pointer" onClick={() => {
                      const stock = stocks.find(s => s.ticker === alert.ticker);
                      if (stock && stock.evidenceSources.length > 0) {
                        onOpenEvidence(stock.evidenceSources[0]);
                      }
                    }}>
                      {alert.evidence.source} ({alert.evidence.filingDate})
                    </span>
                  </div>
                  <span className="text-[#34d399]">
                    {alert.evidence.confidence}% Deterministic Grounding
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Watchlist Highlights & Live Thesis Tracker */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              WATCHLIST HIGHLIGHTS • THESIS STATUS
            </span>
            <span className="text-[10px] font-mono-data text-[#87929a]">
              Active Quantitative Scoring
            </span>
          </div>
          <button
            onClick={() => onNavigate('watchlist')}
            className="text-xs font-mono-data text-[#38bdf8] hover:underline flex items-center gap-1"
          >
            <span>Open Watchlist Matrix</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead>
              <tr className="text-[#87929a] border-b border-[#1c2b3c] text-[11px]">
                <th className="py-2 px-2 font-medium">TICKER / NAME</th>
                <th className="py-2 px-2 font-medium text-right">PRICE</th>
                <th className="py-2 px-2 font-medium text-right">1D CHG</th>
                <th className="py-2 px-2 font-medium text-center">DECISION SCORE</th>
                <th className="py-2 px-2 font-medium text-center">GROWTH</th>
                <th className="py-2 px-2 font-medium text-center">QUALITY</th>
                <th className="py-2 px-2 font-medium text-center">VALUATION</th>
                <th className="py-2 px-2 font-medium text-center">THESIS STATUS</th>
                <th className="py-2 px-2 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2b3c]">
              {watchlistHighlights.map(stock => (
                <tr
                  key={stock.ticker}
                  onClick={() => onSelectStock(stock.ticker)}
                  className="hover:bg-[#0d1c2d] cursor-pointer transition-colors group"
                >
                  <td className="py-2 px-2">
                    <div className="font-bold text-[#38bdf8] group-hover:underline">
                      {stock.ticker}
                    </div>
                    <div className="text-[11px] text-[#87929a] truncate max-w-[140px]">
                      {stock.name}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-[#d4e4fa]">
                    {stock.currency === 'INR' ? '₹' : '$'}{stock.price.toFixed(2)}
                  </td>
                  <td className={`py-2 px-2 text-right font-medium ${stock.changePercent >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="px-2 py-0.5 rounded-xs font-bold text-xs bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30">
                      {stock.overallScore}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-[#d4e4fa]">{stock.factorScores.growth}</td>
                  <td className="py-2 px-2 text-center text-[#d4e4fa]">{stock.factorScores.quality}</td>
                  <td className="py-2 px-2 text-center text-[#d4e4fa]">{stock.factorScores.valuation}</td>
                  <td className="py-2 px-2 text-center">
                    <ThesisStatusBadge status={stock.thesisStatus} size="sm" />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(stock.ticker);
                      }}
                      className="px-2 py-1 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#38bdf8] text-[11px] rounded-xs transition-colors"
                    >
                      Deep Dive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
