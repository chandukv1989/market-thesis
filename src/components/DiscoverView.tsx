import React, { useState, useMemo } from 'react';
import { Stock, ActiveScreen } from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { ThesisStatusBadge } from './common/ThesisStatusBadge';
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  Check,
  ArrowUpDown,
  Sparkles,
  Info,
  Shield,
  ChevronRight,
  Filter
} from 'lucide-react';

interface DiscoverViewProps {
  stocks: Stock[];
  watchlistTickers: string[];
  onToggleWatchlist: (ticker: string) => void;
  onSelectStock: (ticker: string) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  stocks,
  watchlistTickers,
  onToggleWatchlist,
  onSelectStock,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [horizon, setHorizon] = useState<'Short' | 'Medium' | 'Long'>('Long');
  const [riskPreference, setRiskPreference] = useState<'Conservative' | 'Moderate' | 'Aggressive'>('Moderate');
  
  // Quantitative filters state
  const [minScore, setMinScore] = useState(70);
  const [minGrowth, setMinGrowth] = useState(75);
  const [minQuality, setMinQuality] = useState(75);
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedMarket, setSelectedMarket] = useState<string>('All');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Active screening rules toggle
  const [rules, setRules] = useState([
    { id: 'r1', name: 'ROIC > 15% & FCF Yield > 2%', active: true },
    { id: 'r2', name: 'Net Debt / EBITDA < 2.0x', active: true },
    { id: 'r3', name: '3Y Revenue CAGR > 12%', active: true },
    { id: 'r4', name: 'Gross Margin > 50%', active: false }
  ]);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => (r.id === id ? { ...r, active: !r.active } : r)));
  };

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // Market filter
      if (selectedMarket !== 'All' && stock.market !== selectedMarket) return false;

      // Natural language / text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicker = stock.ticker.toLowerCase().includes(q);
        const matchName = stock.name.toLowerCase().includes(q);
        const matchSector = stock.sector.toLowerCase().includes(q);
        const matchWhy = stock.whyThisStock.toLowerCase().includes(q);
        if (!matchTicker && !matchName && !matchSector && !matchWhy) return false;
      }

      // Sector filter
      if (selectedSector !== 'All' && stock.sector !== selectedSector) return false;

      // Quantitative thresholds
      if (stock.overallScore < minScore) return false;
      if (stock.factorScores.growth < minGrowth) return false;
      if (stock.factorScores.quality < minQuality) return false;

      return true;
    }).sort((a, b) => b.overallScore - a.overallScore);
  }, [stocks, selectedMarket, searchQuery, selectedSector, minScore, minGrowth, minQuality]);

  const sectors = useMemo(() => {
    const set = new Set<string>(['All']);
    stocks.forEach(s => set.add(s.sector));
    return Array.from(set);
  }, [stocks]);

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              DISCOVER & FACTOR SCREENER
            </h1>
            <span className="text-xs font-mono-data text-[#87929a] px-2 py-0.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
              DECISION-SUPPORT MATRIX
            </span>
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Evaluate assets using quantitative pillars and verifiable fundamental disclosures. Zero return guarantees.
          </p>
        </div>

        {/* Epistemic Trust Banner */}
        <div className="flex items-center gap-2 p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-[11px] font-mono-data text-[#bdc8d1]">
          <Shield className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Decision Score is an analytical synthesis index, not an algorithmic price forecast.</span>
        </div>
      </div>

      {/* Interactive Natural Language Prompt & Filter Controls Bar */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        {/* Natural Language Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#87929a]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search naturally (e.g., 'Foundries with high pricing power and low debt', 'Enterprise SaaS', 'NVDA')..."
            className="w-full bg-[#0d1c2d] border border-[#1c2b3c] focus:border-[#38bdf8] rounded-sm pl-9 pr-4 py-2 text-xs font-mono-data text-[#d4e4fa] placeholder-[#87929a] focus:outline-none"
          />
        </div>

        {/* Horizon, Risk Preference & Filter Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono-data">
          <div className="flex flex-wrap items-center gap-3">
            {/* Investment Horizon */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#87929a] uppercase text-[11px]">Horizon:</span>
              <div className="flex bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs p-0.5">
                {(['Short', 'Medium', 'Long'] as const).map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className={`px-2 py-0.5 rounded-xs text-[11px] transition-colors ${
                      horizon === h
                        ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                        : 'text-[#87929a] hover:text-[#d4e4fa]'
                    }`}
                  >
                    {h} {h === 'Short' ? '(3-6m)' : h === 'Medium' ? '(1-3y)' : '(3-5y+)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Preference */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#87929a] uppercase text-[11px]">Risk Profile:</span>
              <div className="flex bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs p-0.5">
                {(['Conservative', 'Moderate', 'Aggressive'] as const).map(rp => (
                  <button
                    key={rp}
                    onClick={() => setRiskPreference(rp)}
                    className={`px-2 py-0.5 rounded-xs text-[11px] transition-colors ${
                      riskPreference === rp
                        ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                        : 'text-[#87929a] hover:text-[#d4e4fa]'
                    }`}
                  >
                    {rp}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#87929a] uppercase text-[11px]">Market:</span>
              <div className="flex items-center bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs p-0.5">
                {(['All', 'US', 'INDIA'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMarket(m)}
                    className={`px-2 py-0.5 rounded-xs text-[11px] transition-colors ${
                      selectedMarket === m
                        ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                        : 'text-[#87929a] hover:text-[#d4e4fa]'
                    }`}
                  >
                    {m === 'INDIA' ? 'India' : m}
                  </button>
                ))}
              </div>
            </div>

            {/* Sector Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#87929a] uppercase text-[11px]">Sector:</span>
              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2 py-1 text-[11px] text-[#d4e4fa] focus:outline-none"
              >
                {sectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantitative Gates Drawer Toggle */}
          <button
            onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-xs transition-colors ${
              showFiltersDrawer
                ? 'bg-[#122131] border-[#38bdf8] text-[#38bdf8]'
                : 'bg-[#0d1c2d] border-[#1c2b3c] text-[#87929a] hover:text-[#d4e4fa]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Quantitative Thresholds</span>
          </button>
        </div>

        {/* Collapsible Quantitative Sliders Panel */}
        {showFiltersDrawer && (
          <div className="pt-3 border-t border-[#1c2b3c] grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#051424] p-3 rounded-sm text-xs font-mono-data">
            <div>
              <div className="flex justify-between text-[#87929a] mb-1">
                <span>Min Decision Score:</span>
                <span className="text-[#38bdf8] font-semibold">{minScore}</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={minScore}
                onChange={e => setMinScore(Number(e.target.value))}
                className="w-full accent-[#38bdf8]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#87929a] mb-1">
                <span>Min Growth Factor:</span>
                <span className="text-[#38bdf8] font-semibold">{minGrowth}</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={minGrowth}
                onChange={e => setMinGrowth(Number(e.target.value))}
                className="w-full accent-[#38bdf8]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#87929a] mb-1">
                <span>Min Quality Factor:</span>
                <span className="text-[#38bdf8] font-semibold">{minQuality}</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={minQuality}
                onChange={e => setMinQuality(Number(e.target.value))}
                className="w-full accent-[#38bdf8]"
              />
            </div>
          </div>
        )}

        {/* Active Screening Rules Badges */}
        <div className="pt-2 border-t border-[#1c2b3c] flex flex-wrap items-center gap-2 text-xs font-mono-data">
          <span className="text-[#87929a] text-[11px] uppercase">Active Screening Rules:</span>
          {rules.map(rule => (
            <button
              key={rule.id}
              onClick={() => toggleRule(rule.id)}
              className={`px-2 py-0.5 rounded-xs border text-[11px] transition-colors flex items-center gap-1 ${
                rule.active
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-[#0d1c2d] border-[#1c2b3c] text-[#87929a] line-through'
              }`}
            >
              {rule.active && <Check className="w-3 h-3" />}
              <span>{rule.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Candidate Results Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono-data text-[#87929a]">
          <span>CANDIDATES MATCHING CRITERIA: {filteredStocks.length} ASSETS</span>
          <span>Ranked by Multi-Pillar Decision Score</span>
        </div>

        <div className="space-y-3">
          {filteredStocks.map(stock => {
            const isWatchlisted = watchlistTickers.includes(stock.ticker);

            return (
              <div
                key={stock.ticker}
                className="bg-[#090d14] border border-[#1c2b3c] hover:border-[#273647] rounded-sm p-4 transition-all text-xs space-y-3"
              >
                {/* Top Row: Company Info & Primary Scores */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1c2b3c] pb-3">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onSelectStock(stock.ticker)}
                          className="font-mono-data text-base font-bold text-[#38bdf8] hover:underline"
                        >
                          {stock.ticker}
                        </button>
                        <span className="text-[#d4e4fa] font-semibold text-sm">{stock.name}</span>
                        {stock.market === 'INDIA' ? (
                          <span className="text-[10px] font-mono-data px-1.5 py-0.2 bg-[#1e1b4b] text-[#818cf8] border border-[#3730a3] rounded-xs font-semibold">
                            {stock.exchange || 'NSE'} • IN
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono-data px-1.5 py-0.2 bg-[#0d1c2d] text-[#87929a] border border-[#1c2b3c] rounded-xs">
                            {stock.exchange} • US
                          </span>
                        )}
                        <span className="text-[11px] font-mono-data text-[#87929a]">
                          {stock.sector}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono-data text-[#87929a] mt-1 flex-wrap">
                        <span>Price: <strong className="text-[#d4e4fa]">{stock.currency === 'INR' ? '₹' : '$'}{stock.price.toFixed(2)}</strong></span>
                        <span className={stock.changePercent >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}>
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                        <span>MCap: <strong className="text-[#d4e4fa]">{stock.marketCap}</strong></span>
                        <span>Fwd P/E: <strong className="text-[#d4e4fa]">{stock.forwardPe}x</strong></span>
                        <span>ROIC: <strong className="text-[#d4e4fa]">{stock.roic}%</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Decision Score & Confidence Badges */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Decision Score</div>
                      <div className="font-mono-data text-2xl font-bold text-[#38bdf8]">
                        {stock.overallScore}
                        <span className="text-xs font-normal text-[#87929a]">/100</span>
                      </div>
                    </div>

                    <div className="text-right text-[11px] font-mono-data text-[#87929a] space-y-0.5 border-l border-[#1c2b3c] pl-3">
                      <div>Confidence: <strong className="text-[#34d399]">{stock.confidence}%</strong></div>
                      <div>Completeness: <strong className="text-[#38bdf8]">{stock.dataCompleteness}%</strong></div>
                      <div>Rules: <strong className="text-emerald-400">{stock.rulesPassed.passed}/{stock.rulesPassed.total}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Factor Breakdown Pillars */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2 bg-[#0d1c2d] rounded-sm text-xs font-mono-data">
                  <div>
                    <div className="text-[10px] text-[#87929a] uppercase">Growth (30%)</div>
                    <div className="font-semibold text-[#d4e4fa] mt-0.5">{stock.factorScores.growth}/100</div>
                    <div className="w-full bg-[#1c2b3c] h-1 rounded-full mt-1">
                      <div className="bg-[#38bdf8] h-full rounded-full" style={{ width: `${stock.factorScores.growth}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#87929a] uppercase">Quality (25%)</div>
                    <div className="font-semibold text-[#d4e4fa] mt-0.5">{stock.factorScores.quality}/100</div>
                    <div className="w-full bg-[#1c2b3c] h-1 rounded-full mt-1">
                      <div className="bg-[#34d399] h-full rounded-full" style={{ width: `${stock.factorScores.quality}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#87929a] uppercase">Valuation (20%)</div>
                    <div className="font-semibold text-[#d4e4fa] mt-0.5">{stock.factorScores.valuation}/100</div>
                    <div className="w-full bg-[#1c2b3c] h-1 rounded-full mt-1">
                      <div className="bg-[#f59e0b] h-full rounded-full" style={{ width: `${stock.factorScores.valuation}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#87929a] uppercase">Risk (15%)</div>
                    <div className="font-semibold text-[#d4e4fa] mt-0.5">{stock.factorScores.risk}/100</div>
                    <div className="w-full bg-[#1c2b3c] h-1 rounded-full mt-1">
                      <div className="bg-[#818cf8] h-full rounded-full" style={{ width: `${stock.factorScores.risk}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#87929a] uppercase">Momentum (10%)</div>
                    <div className="font-semibold text-[#d4e4fa] mt-0.5">{stock.factorScores.momentum}/100</div>
                    <div className="w-full bg-[#1c2b3c] h-1 rounded-full mt-1">
                      <div className="bg-[#a78bfa] h-full rounded-full" style={{ width: `${stock.factorScores.momentum}%` }} />
                    </div>
                  </div>
                </div>

                {/* Evidence & Rationale Blocks */}
                <div className="space-y-2 pt-1">
                  <div>
                    <div className="text-[10px] font-mono-data text-[#87929a] uppercase mb-0.5">
                      WHY THIS STOCK:
                    </div>
                    <p className="text-[#d4e4fa] leading-relaxed">{stock.whyThisStock}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-[#051424] border border-[#1c2b3c] rounded-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
                        <span className="font-mono-data text-[#87929a]">Probabilistic Interpretation</span>
                      </div>
                      <p className="text-[#bdc8d1]">{stock.aiInterpretation}</p>
                    </div>

                    <div className="p-2 bg-[#051424] border border-[#1c2b3c] rounded-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <ProvenanceBadge tag="KEY CONCERN" size="xs" />
                        <span className="font-mono-data text-[#87929a]">Primary Vulnerability</span>
                      </div>
                      <p className="text-[#bdc8d1]">{stock.keyConcern}</p>
                    </div>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div className="pt-2 border-t border-[#1c2b3c] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono-data text-[#87929a]">
                    <span>Freshness: {stock.dataFreshness}</span>
                    <span>•</span>
                    <ThesisStatusBadge status={stock.thesisStatus} size="sm" />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleWatchlist(stock.ticker)}
                      className={`px-3 py-1 border text-xs font-mono-data rounded-xs transition-colors flex items-center gap-1.5 ${
                        isWatchlisted
                          ? 'bg-[#38bdf8]/15 border-[#38bdf8] text-[#38bdf8]'
                          : 'bg-[#0d1c2d] border-[#1c2b3c] text-[#87929a] hover:text-[#d4e4fa]'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</span>
                    </button>

                    <button
                      onClick={() => onSelectStock(stock.ticker)}
                      className="px-3 py-1 bg-[#38bdf8] hover:bg-[#7bd0ff] text-[#051424] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1 transition-colors"
                    >
                      <span>Deep Dive Research</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
