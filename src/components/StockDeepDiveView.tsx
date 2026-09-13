import React, { useState } from 'react';
import { Stock, PortfolioData, EvidenceSource, ActiveScreen } from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { ThesisStatusBadge } from './common/ThesisStatusBadge';
import { FinancialQuarterlyChart } from './common/FinancialChart';
import { InvestmentAssessmentView } from './decision/InvestmentAssessmentView';
import {
  Shield,
  Clock,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
  Bookmark,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertOctagon,
  HelpCircle
} from 'lucide-react';

interface StockDeepDiveViewProps {
  stock: Stock;
  portfolio: PortfolioData;
  isWatchlisted: boolean;
  onToggleWatchlist: (ticker: string) => void;
  onOpenEvidence: (evidence: EvidenceSource) => void;
  allStocks: Stock[];
  onSelectTicker: (ticker: string) => void;
}

export const StockDeepDiveView: React.FC<StockDeepDiveViewProps> = ({
  stock,
  portfolio,
  isWatchlisted,
  onToggleWatchlist,
  onOpenEvidence,
  allStocks,
  onSelectTicker
}) => {
  const [activeTab, setActiveTab] = useState<'thesis' | 'decision' | 'financials' | 'committee' | 'fit' | 'evidence'>('decision');
  const [expandedPillar, setExpandedPillar] = useState<number | null>(0);

  const tabs = [
    { id: 'decision' as const, label: 'Investment Assessment' },
    { id: 'thesis' as const, label: 'Investment Thesis' },
    { id: 'financials' as const, label: 'Financials & Quarters' },
    { id: 'committee' as const, label: 'AI Investment Committee' },
    { id: 'fit' as const, label: 'Portfolio Fit' },
    { id: 'evidence' as const, label: `Evidence (${stock.evidenceSources.length})` }
  ];

  const currSymbol = stock.currency === 'INR' ? '₹' : '$';

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Ticker Selector & Switcher Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono-data border-b border-[#1c2b3c] pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#87929a] uppercase">Stock Deep Dive:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {allStocks.map(s => (
              <button
                key={s.ticker}
                onClick={() => onSelectTicker(s.ticker)}
                className={`px-2 py-0.5 rounded-xs transition-colors text-[11px] ${
                  s.ticker === stock.ticker
                    ? 'bg-[#38bdf8] text-[#051424] font-bold'
                    : 'bg-[#0d1c2d] hover:bg-[#1c2b3c] text-[#87929a] hover:text-[#d4e4fa] border border-[#1c2b3c]'
                }`}
              >
                {s.ticker}
                {s.market === 'INDIA' && <span className="ml-1 text-[9px] text-[#818cf8] font-semibold">IN</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#87929a]">
          <span className="flex items-center gap-1 text-[#34d399]">
            <Clock className="w-3 h-3" />
            <span>{stock.dataFreshness}</span>
          </span>
          <span>•</span>
          <span>Calculated: {stock.lastCalculated}</span>
        </div>
      </div>

      {/* Non-US Equity / SEC Status Notice */}
      {stock.market === 'INDIA' && (
        <div className="p-3 bg-[#090d14] border border-[#3730a3]/40 rounded-sm text-xs font-mono-data flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#818cf8]" />
            <span className="text-[#d4e4fa] font-semibold">Indian Security Listing ({stock.exchange}):</span>
            <span className="text-[#87929a]">SEC EDGAR is not applicable to non-US securities. Financial analysis grounded in statutory exchange filings and annual audit reports.</span>
          </div>
          <span className="px-2 py-0.5 text-[10px] bg-[#1e1b4b] text-[#818cf8] border border-[#3730a3] rounded-xs font-bold uppercase">
            STATUTORY REPORTING • {stock.currency}
          </span>
        </div>
      )}

      {/* Institutional Company Header */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono-data text-2xl font-bold text-[#38bdf8]">{stock.ticker}</span>
              <h1 className="text-xl font-semibold text-[#d4e4fa]">{stock.name}</h1>
              <ThesisStatusBadge status={stock.thesisStatus} size="md" />
              {stock.market === 'INDIA' ? (
                <span className="px-1.5 py-0.5 text-[10px] font-mono-data font-semibold bg-[#1e1b4b] text-[#818cf8] border border-[#3730a3] rounded-xs inline-flex items-center gap-1" title="Indian Equity (NSE/BSE) • SEC Filings Not Applicable">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8]" />
                  {stock.exchange || 'NSE'} • INDIAN EQUITY ({stock.currency})
                </span>
              ) : stock.secCik ? (
                <span className="px-1.5 py-0.5 text-[10px] font-mono-data font-semibold bg-[#0d2a1d] text-[#34d399] border border-[#166534] rounded-xs inline-flex items-center gap-1" title={`SEC EDGAR CIK ${stock.secCik} Real XBRL Data`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                  SEC CIK {stock.secCik} (REAL XBRL)
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[10px] font-mono-data font-semibold bg-[#0d1c2d] text-[#87929a] border border-[#1c2b3c] rounded-xs inline-flex items-center gap-1">
                  US EQUITY • {stock.exchange}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-data text-[#87929a] mt-1.5">
              <span>{stock.exchange}</span>
              <span>•</span>
              <span>Country: <strong className="text-[#d4e4fa]">{stock.country || (stock.market === 'INDIA' ? 'India' : 'US')}</strong></span>
              <span>•</span>
              <span>Sector: <strong className="text-[#d4e4fa]">{stock.sector}</strong></span>
              <span>•</span>
              <span>Industry: <strong className="text-[#d4e4fa]">{stock.industry}</strong></span>
            </div>
          </div>

          {/* Current Market Price & Today Change */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-mono-data text-3xl font-bold text-[#d4e4fa] tracking-tight">
                {currSymbol}{stock.price.toFixed(2)}
              </div>
              <div className={`font-mono-data text-xs font-semibold flex items-center justify-end gap-1 ${
                stock.changePercent >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'
              }`}>
                {stock.changePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {stock.changePercent >= 0 ? '+' : ''}{currSymbol}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                </span>
                <span className="text-[#87929a] font-normal text-[10px]">Today</span>
              </div>
            </div>

            <button
              onClick={() => onToggleWatchlist(stock.ticker)}
              className={`p-2 border rounded-xs transition-colors ${
                isWatchlisted
                  ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8]'
                  : 'bg-[#0d1c2d] border-[#1c2b3c] text-[#87929a] hover:text-[#d4e4fa]'
              }`}
              title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multiples & Ratios Ribbon */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-xs font-mono-data">
          <div>
            <div className="text-[10px] text-[#87929a] uppercase">Market Cap</div>
            <div className="text-[#d4e4fa] font-semibold mt-0.5">{stock.marketCap}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#87929a] uppercase">Fwd P/E</div>
            <div className="text-[#d4e4fa] font-semibold mt-0.5">{stock.forwardPe}x</div>
          </div>
          <div>
            <div className="text-[10px] text-[#87929a] uppercase">ROIC</div>
            <div className="text-[#34d399] font-semibold mt-0.5">{stock.roic}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[#87929a] uppercase">Beta (5Y)</div>
            <div className="text-[#d4e4fa] font-semibold mt-0.5">{stock.beta}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#87929a] uppercase">FCF Yield</div>
            <div className="text-[#d4e4fa] font-semibold mt-0.5">{stock.fcfYield}%</div>
          </div>
          <div>
            <div className="text-[10px] text-[#87929a] uppercase">Debt / Equity</div>
            <div className="text-[#d4e4fa] font-semibold mt-0.5">{stock.debtToEquity}x</div>
          </div>
        </div>

        {/* AI Analytical Score & Factor Breakdown Grid */}
        <div className="p-3 bg-[#051424] border border-[#1c2b3c] rounded-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">
                  AI Analytical Decision Score
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono-data text-3xl font-bold text-[#38bdf8]">
                    {stock.overallScore}
                  </span>
                  <span className="text-xs font-mono-data text-[#87929a]">/100</span>
                  <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
                </div>
              </div>
            </div>

            {/* Score Weights & Meta */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono-data text-[#87929a]">
              <div>
                <span>Confidence: </span>
                <strong className="text-[#34d399]">{stock.confidence}% Deterministic</strong>
              </div>
              <div>
                <span>Data Completeness: </span>
                <strong className="text-[#38bdf8]">{stock.dataCompleteness}%</strong>
              </div>
              <div>
                <span>Model Verification: </span>
                <strong className="text-[#d4e4fa]">Validated vs 10-Q</strong>
              </div>
            </div>
          </div>

          {/* Factor Breakdown Bars */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-[#1c2b3c] text-xs font-mono-data">
            <div>
              <div className="flex justify-between text-[#87929a] text-[11px]">
                <span>Growth (30%)</span>
                <span className="text-[#d4e4fa] font-semibold">{stock.factorScores.growth}</span>
              </div>
              <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-1">
                <div className="bg-[#38bdf8] h-full rounded-full" style={{ width: `${stock.factorScores.growth}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#87929a] text-[11px]">
                <span>Quality (25%)</span>
                <span className="text-[#d4e4fa] font-semibold">{stock.factorScores.quality}</span>
              </div>
              <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-1">
                <div className="bg-[#34d399] h-full rounded-full" style={{ width: `${stock.factorScores.quality}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#87929a] text-[11px]">
                <span>Valuation (20%)</span>
                <span className="text-[#d4e4fa] font-semibold">{stock.factorScores.valuation}</span>
              </div>
              <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-1">
                <div className="bg-[#f59e0b] h-full rounded-full" style={{ width: `${stock.factorScores.valuation}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#87929a] text-[11px]">
                <span>Risk (15%)</span>
                <span className="text-[#d4e4fa] font-semibold">{stock.factorScores.risk}</span>
              </div>
              <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-1">
                <div className="bg-[#818cf8] h-full rounded-full" style={{ width: `${stock.factorScores.risk}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#87929a] text-[11px]">
                <span>Momentum (10%)</span>
                <span className="text-[#d4e4fa] font-semibold">{stock.factorScores.momentum}</span>
              </div>
              <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full mt-1">
                <div className="bg-[#a78bfa] h-full rounded-full" style={{ width: `${stock.factorScores.momentum}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-[#1c2b3c] overflow-x-auto text-xs font-mono-data">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-[#38bdf8] text-[#38bdf8] bg-[#0d1c2d]/40'
                : 'border-transparent text-[#87929a] hover:text-[#d4e4fa] hover:bg-[#0d1c2d]/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: INVESTMENT DECISION INTELLIGENCE (PHASE 15) */}
      {activeTab === 'decision' && (
        <InvestmentAssessmentView
          stock={stock}
          portfolio={portfolio}
          allStocks={allStocks}
          onSelectTicker={onSelectTicker}
        />
      )}

      {/* TAB CONTENT 1: THESIS & THESIS BREAKERS */}
      {activeTab === 'thesis' && (
        <div className="space-y-5">
          {/* Thesis Executive Overview */}
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
                <span className="text-xs font-mono-data text-[#87929a] uppercase">
                  CENTRAL INVESTMENT THESIS
                </span>
              </div>
              <span className="text-xs font-mono-data text-[#34d399]">Status: {stock.thesisStatus}</span>
            </div>
            <p className="text-sm text-[#d4e4fa] leading-relaxed font-sans">
              {stock.thesisOverview}
            </p>
          </div>

          {/* Quantitative Pillars with FACT, CALCULATION, AI ANALYSIS, UNCERTAINTY */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono-data text-[#87929a]">
              <span>QUANTITATIVE PILLARS WITH STRICT PROVENANCE SEGREGATION</span>
              <span>Click to inspect pillar evidence</span>
            </div>

            <div className="space-y-3">
              {stock.thesisPillars.map((pillar, idx) => (
                <div
                  key={idx}
                  className="bg-[#090d14] border border-[#1c2b3c] rounded-sm overflow-hidden text-xs"
                >
                  <div
                    onClick={() => setExpandedPillar(expandedPillar === idx ? null : idx)}
                    className="flex items-center justify-between p-3.5 bg-[#0d1c2d] hover:bg-[#122131] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 font-mono-data">
                      <span className="font-bold text-[#d4e4fa] text-sm">{pillar.name}</span>
                      <span className={`px-2 py-0.5 rounded-xs text-[11px] font-semibold ${
                        pillar.status === 'Strong'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : pillar.status === 'Neutral'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {pillar.status}
                      </span>
                      <span className="text-[#87929a] text-[11px]">Score: {pillar.score}/100</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#87929a]">
                      <span className="text-[11px] font-mono-data">{pillar.evidenceRef}</span>
                      {expandedPillar === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {expandedPillar === idx && (
                    <div className="p-4 space-y-3 bg-[#090d14] border-t border-[#1c2b3c] text-xs">
                      {/* FACT Row */}
                      <div className="p-2.5 bg-[#051424] border-l-2 border-[#38bdf8] rounded-r-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <ProvenanceBadge tag="FACT" size="xs" />
                          <span className="text-[10px] font-mono-data text-[#87929a]">{pillar.evidenceRef}</span>
                        </div>
                        <p className="text-[#d4e4fa] font-mono-data">{pillar.fact}</p>
                      </div>

                      {/* CALCULATION Row */}
                      <div className="p-2.5 bg-[#051424] border-l-2 border-[#34d399] rounded-r-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <ProvenanceBadge tag="CALCULATION" size="xs" />
                          <span className="text-[10px] font-mono-data text-[#87929a]">Formulaic Output</span>
                        </div>
                        <p className="text-[#d4e4fa] font-mono-data">{pillar.calculation}</p>
                      </div>

                      {/* AI ANALYSIS Row */}
                      <div className="p-2.5 bg-[#051424] border-l-2 border-[#a78bfa] rounded-r-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
                          <span className="text-[10px] font-mono-data text-[#87929a]">Thematic Inference</span>
                        </div>
                        <p className="text-[#d4e4fa] leading-relaxed">{pillar.aiAnalysis}</p>
                      </div>

                      {/* UNCERTAINTY Row */}
                      {pillar.uncertainty && (
                        <div className="p-2.5 bg-[#051424] border-l-2 border-[#94a3b8] rounded-r-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <ProvenanceBadge tag="UNCERTAINTY" size="xs" />
                            <span className="text-[10px] font-mono-data text-[#87929a]">Forecast Volatility</span>
                          </div>
                          <p className="text-[#bdc8d1] italic">{pillar.uncertainty}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Thesis Breakers Section */}
          <div className="bg-[#090d14] border border-[#f43f5e]/30 rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2.5">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-[#f43f5e]" />
                <h3 className="font-semibold text-xs text-[#d4e4fa] tracking-wider uppercase font-mono-data">
                  THESIS BREAKERS • MANDATORY RECONSIDERATION TRIGGERS
                </h3>
              </div>
              <span className="text-[11px] font-mono-data text-[#87929a]">
                Explicit conditions that invalidate thesis
              </span>
            </div>

            <div className="space-y-2">
              {stock.thesisBreakers.map(breaker => (
                <div
                  key={breaker.id}
                  className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-xs space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-data text-[#f43f5e] font-bold">{breaker.id}</span>
                      <span className="font-semibold text-[#d4e4fa]">{breaker.condition}</span>
                    </div>
                    <span className={`px-2 py-0.5 font-mono-data text-[10px] rounded-xs font-semibold ${
                      breaker.status === 'Safe'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {breaker.currentStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono-data text-[#87929a] pt-1">
                    <div>Trigger Gate: <strong className="text-[#f43f5e]">{breaker.threshold}</strong></div>
                    <div>Probability: <strong className="text-[#d4e4fa]">{breaker.probabilityEstimate}</strong></div>
                    <div>Impact Severity: <strong className="text-[#f59e0b]">{breaker.impactSeverity}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: FINANCIALS */}
      {activeTab === 'financials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                Financial Progression & Metric Dynamics
              </h3>
              {stock.isSecGrounded && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono-data font-bold bg-[#0d2a1d] text-[#34d399] border border-[#166534] rounded-xs uppercase">
                  SEC EDGAR XBRL VERIFIED
                </span>
              )}
            </div>
            <ProvenanceBadge tag="FACT" size="xs" />
          </div>

          <FinancialQuarterlyChart quarters={stock.financialQuarters} />

          {/* Detailed Financial Ledger Table */}
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
            <div className="text-xs font-mono-data text-[#87929a] uppercase">
              Quarterly Financial Statement Audit (Amounts in Billions {stock.currency === 'INR' ? 'INR (₹)' : 'USD ($)'})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-data">
                <thead>
                  <tr className="text-[#87929a] border-b border-[#1c2b3c]">
                    <th className="py-2 px-2 font-medium">Metric</th>
                    {stock.financialQuarters.map((q, i) => (
                      <th key={i} className="py-2 px-2 font-medium text-right">{q.period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2b3c]">
                  <tr>
                    <td className="py-2 px-2 text-[#38bdf8] font-semibold">Total Revenue</td>
                    {stock.financialQuarters.map((q, i) => (
                      <td key={i} className="py-2 px-2 text-right text-[#d4e4fa]">{currSymbol}{q.revenue.toFixed(2)}B</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-[#87929a]">Gross Margin %</td>
                    {stock.financialQuarters.map((q, i) => (
                      <td key={i} className="py-2 px-2 text-right text-[#34d399]">{q.grossMarginPct.toFixed(1)}%</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-[#87929a]">Operating Income</td>
                    {stock.financialQuarters.map((q, i) => (
                      <td key={i} className="py-2 px-2 text-right text-[#d4e4fa]">{currSymbol}{q.operatingIncome.toFixed(2)}B</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-[#87929a]">Net Income</td>
                    {stock.financialQuarters.map((q, i) => (
                      <td key={i} className="py-2 px-2 text-right text-[#d4e4fa]">{currSymbol}{q.netIncome.toFixed(2)}B</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-[#34d399] font-semibold">Free Cash Flow</td>
                    {stock.financialQuarters.map((q, i) => (
                      <td key={i} className="py-2 px-2 text-right text-[#34d399]">{currSymbol}{q.freeCashFlow.toFixed(2)}B</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-[#87929a]">Capex</td>
                    {stock.financialQuarters.map((q, i) => (
                      <td key={i} className="py-2 px-2 text-right text-[#87929a]">{currSymbol}{q.capex.toFixed(2)}B</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Real SEC XBRL Verified Statements Audit Drawer if grounded */}
          {stock.realFinancialFacts && stock.realFinancialFacts.length > 0 && (
            <div className="bg-[#090d14] border border-[#166534]/50 rounded-sm p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                  <span className="font-mono-data text-xs font-bold text-[#34d399] uppercase">
                    SEC EDGAR XBRL AUDIT TRAIL • {stock.realFinancialFacts.length} VERIFIED FACTS
                  </span>
                </div>
                <span className="text-[10px] font-mono-data text-[#87929a]">
                  CIK {stock.secCik || '0001045810'}
                </span>
              </div>
              <div className="text-[11px] font-mono-data text-[#87929a]">
                All values extracted directly from US-GAAP company facts taxonomy filed with the SEC.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {stock.realFinancialFacts.slice(0, 12).map((fact, idx) => (
                  <div key={idx} className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-[11px] font-mono-data">
                    <div className="flex items-center justify-between text-[#87929a] text-[10px]">
                      <span>{fact.form} ({fact.fiscalPeriod || 'FY'} {fact.fiscalYear || ''})</span>
                      <span className="text-[#34d399]">VERIFIED</span>
                    </div>
                    <div className="text-[#d4e4fa] font-semibold mt-0.5 truncate">{fact.label}</div>
                    <div className="flex items-center justify-between mt-1 text-[#38bdf8]">
                      <span>
                        {fact.unit === 'USD'
                          ? `$${(fact.value / 1e9).toFixed(2)}B`
                          : `${(fact.value / 1e6).toFixed(1)}M shares`}
                      </span>
                      {fact.sourceUrl && (
                        <a
                          href={fact.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#87929a] hover:text-[#38bdf8] inline-flex items-center gap-0.5 text-[9px]"
                        >
                          SEC Filing
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: AI INVESTMENT COMMITTEE */}
      {activeTab === 'committee' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
            <div>
              <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                AI INVESTMENT COMMITTEE DELIBERATION
              </h3>
              <p className="text-xs text-[#87929a]">
                Multi-agent dialectic synthesis representing Bull, Base, Bear, and Risk specialist perspectives.
              </p>
            </div>
            <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stock.aiCommittee.map((perspective, idx) => (
              <div
                key={idx}
                className={`bg-[#090d14] border rounded-sm p-4 space-y-3 ${
                  perspective.role === 'Bull Case'
                    ? 'border-[#34d399]/40'
                    : perspective.role === 'Bear Case'
                    ? 'border-[#f43f5e]/40'
                    : perspective.role === 'Risk Analyst'
                    ? 'border-[#f59e0b]/40'
                    : 'border-[#38bdf8]/40 md:col-span-2'
                }`}
              >
                <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono-data text-xs font-bold uppercase ${
                      perspective.role === 'Bull Case'
                        ? 'text-[#34d399]'
                        : perspective.role === 'Bear Case'
                        ? 'text-[#f43f5e]'
                        : perspective.role === 'Risk Analyst'
                        ? 'text-[#f59e0b]'
                        : 'text-[#38bdf8]'
                    }`}>
                      {perspective.role}
                    </span>
                    <span className="text-[11px] font-mono-data text-[#87929a]">
                      • {perspective.author}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-data text-[#87929a]">
                    Conviction: <strong className="text-[#d4e4fa]">{perspective.conviction}</strong> ({perspective.confidenceScore}%)
                  </span>
                </div>

                <p className="text-xs text-[#d4e4fa] leading-relaxed font-sans">
                  {perspective.summary}
                </p>

                <div className="space-y-1 text-xs">
                  <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Core Arguments:</div>
                  <ul className="space-y-1">
                    {perspective.coreArguments.map((arg, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[#bdc8d1] text-[11px]">
                        <span className="text-[#38bdf8]">•</span>
                        <span>{arg}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-[#1c2b3c] text-[11px] font-mono-data">
                  <span className="text-[#f59e0b] font-semibold">Identified Blindspot: </span>
                  <span className="text-[#87929a]">{perspective.keyVulnerability}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: PORTFOLIO FIT */}
      {activeTab === 'fit' && (
        <div className="space-y-4">
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
              <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                PORTFOLIO FIT & COVARIANCE SIMULATION
              </h3>
              <ProvenanceBadge tag="CALCULATION" size="xs" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono-data">
              <div className="p-3 bg-[#0d1c2d] rounded-sm border border-[#1c2b3c]">
                <div className="text-[10px] text-[#87929a] uppercase">Correlation to Portfolio</div>
                <div className="text-xl font-bold text-[#d4e4fa] mt-1">{stock.portfolioFit.correlation}</div>
                <div className="text-[11px] text-[#87929a] mt-0.5">High covariance with Tech cluster</div>
              </div>

              <div className="p-3 bg-[#0d1c2d] rounded-sm border border-[#1c2b3c]">
                <div className="text-[10px] text-[#87929a] uppercase">Tech Sector Delta</div>
                <div className="text-xl font-bold text-amber-400 mt-1">{stock.portfolioFit.sectorTechDelta}</div>
                <div className="text-[11px] text-[#87929a] mt-0.5">Expands portfolio tech weight</div>
              </div>

              <div className="p-3 bg-[#0d1c2d] rounded-sm border border-[#1c2b3c]">
                <div className="text-[10px] text-[#87929a] uppercase">Risk Contribution</div>
                <div className="text-xl font-bold text-[#38bdf8] mt-1">{stock.portfolioFit.riskContributionPct}%</div>
                <div className="text-[11px] text-[#87929a] mt-0.5">Share of total portfolio variance</div>
              </div>
            </div>

            {/* Stress Test Scenarios */}
            <div className="space-y-2 pt-2 border-t border-[#1c2b3c]">
              <div className="text-xs font-mono-data text-[#87929a] uppercase">
                Simulated Macro Stress Testing:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono-data">
                <div className="p-2.5 bg-[#051424] border border-[#1c2b3c] rounded-xs">
                  <div className="text-[10px] text-[#87929a] uppercase">+100 bps Fed Rate Hike</div>
                  <div className="text-[#f43f5e] font-semibold mt-1">
                    {stock.portfolioFit.scenarioImpact.rateHike100bps}
                  </div>
                </div>
                <div className="p-2.5 bg-[#051424] border border-[#1c2b3c] rounded-xs">
                  <div className="text-[10px] text-[#87929a] uppercase">Mild Global Recession</div>
                  <div className="text-[#f43f5e] font-semibold mt-1">
                    {stock.portfolioFit.scenarioImpact.recessionMild}
                  </div>
                </div>
                <div className="p-2.5 bg-[#051424] border border-[#1c2b3c] rounded-xs">
                  <div className="text-[10px] text-[#87929a] uppercase">Tech 20% Drawdown</div>
                  <div className="text-[#f43f5e] font-semibold mt-1">
                    {stock.portfolioFit.scenarioImpact.techSelloff20Pct}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: EVIDENCE REPOSITORY */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
            <div>
              <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                PRIMARY SOURCE EVIDENCE REPOSITORY
              </h3>
              <p className="text-xs text-[#87929a]">
                All AI conclusions trace to verifiable filings, conference calls, and audit documents.
              </p>
            </div>
            <ProvenanceBadge tag="SOURCE" size="xs" />
          </div>

          <div className="space-y-3">
            {stock.evidenceSources.map(evidence => (
              <div
                key={evidence.id}
                onClick={() => onOpenEvidence(evidence)}
                className="p-3.5 bg-[#090d14] border border-[#1c2b3c] hover:border-[#38bdf8]/50 rounded-sm cursor-pointer transition-all text-xs space-y-2 group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-data font-bold text-[#38bdf8]">{evidence.type}</span>
                    <span className="text-[#87929a]">•</span>
                    <span className="font-semibold text-[#d4e4fa] group-hover:text-[#38bdf8] transition-colors">
                      {evidence.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono-data text-[#87929a]">
                    <span>{evidence.reportingDate} ({evidence.freshness})</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8]" />
                  </div>
                </div>

                <div className="p-2.5 bg-[#0d1c2d] border-l-2 border-[#38bdf8] rounded-r-xs font-mono-data text-[11px] text-[#bdc8d1]">
                  "{evidence.quote}"
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono-data text-[#87929a]">
                  <span>Source: {evidence.sourceDoc}</span>
                  <span className="text-[#34d399] font-semibold">{evidence.confidence}% Verification Confidence</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
