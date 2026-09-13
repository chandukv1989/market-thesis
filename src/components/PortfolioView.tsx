import React, { useState } from 'react';
import { PortfolioData, Holding, ActiveScreen } from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { ThesisStatusBadge } from './common/ThesisStatusBadge';
import { PortfolioIntelligencePanel } from './portfolio/PortfolioIntelligencePanel';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  PieChart,
  Globe,
  ShieldAlert,
  ArrowRight,
  Filter,
  Layers,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

interface PortfolioViewProps {
  portfolio: PortfolioData;
  onSelectStock: (ticker: string) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  portfolio,
  onSelectStock,
  onNavigate
}) => {
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'weight' | 'value' | 'return' | 'risk'>('weight');

  const sectors = ['All', ...Array.from(new Set(portfolio.holdings.map(h => h.sector)))];

  const sortedHoldings = [...portfolio.holdings]
    .filter(h => sectorFilter === 'All' || h.sector === sectorFilter)
    .sort((a, b) => {
      if (sortBy === 'weight') return b.weightPct - a.weightPct;
      if (sortBy === 'value') return b.currentValue - a.currentValue;
      if (sortBy === 'return') return b.totalReturnPct - a.totalReturnPct;
      if (sortBy === 'risk') return b.riskContributionPct - a.riskContributionPct;
      return 0;
    });

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              PORTFOLIO MANAGEMENT & LEDGER
            </h1>
            <span className="text-xs font-mono-data text-[#87929a] px-2 py-0.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
              MANDATE: GROWTH & QUALITY PRESERVATION
            </span>
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Simulated positions ledger, covariance risk contributions, and thesis compliance diagnostics.
          </p>
        </div>

        <button
          onClick={() => onNavigate('backtesting')}
          className="px-3 py-1.5 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] hover:border-[#38bdf8] text-[#38bdf8] text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
        >
          <span>Stress-Test in Backtester</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top Snapshot Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4">
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase flex justify-between">
            <span>Portfolio NAV</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#d4e4fa] mt-1">
            ${portfolio.nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-xs font-mono-data text-[#34d399] mt-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+${portfolio.todayChange.toLocaleString()} (+{portfolio.todayChangePct.toFixed(2)}%) Today</span>
          </div>
        </div>

        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4">
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase flex justify-between">
            <span>Unrealized Gain</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#34d399] mt-1">
            +${portfolio.unrealizedReturn.toLocaleString()}
          </div>
          <div className="text-xs font-mono-data text-[#87929a] mt-2">
            Return on Cost: <strong className="text-[#34d399]">+{portfolio.unrealizedReturnPct.toFixed(1)}%</strong>
          </div>
        </div>

        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4">
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase flex justify-between">
            <span>Risk Index</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="font-mono-data text-2xl font-bold text-amber-400 mt-1">
            {portfolio.riskScore}<span className="text-xs text-[#87929a] font-normal">/100</span>
          </div>
          <div className="text-xs font-mono-data text-amber-400 mt-2">
            {portfolio.riskLabel} • Beta 1.28
          </div>
        </div>

        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4">
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase flex justify-between">
            <span>Diversification</span>
            <ProvenanceBadge tag="CALCULATION" size="xs" showDot={false} />
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#38bdf8] mt-1">
            {portfolio.diversificationScore}<span className="text-xs text-[#87929a] font-normal">/100</span>
          </div>
          <div className="text-xs font-mono-data text-[#38bdf8] mt-2">
            {portfolio.diversificationLabel} across 11 assets
          </div>
        </div>
      </div>

      {/* AI Interpretation vs Calculated Fact Banner */}
      <div className="p-4 bg-[#090d14] border border-[#1c2b3c] rounded-sm space-y-3">
        <div className="flex items-center gap-2">
          <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
          <span className="text-xs font-mono-data text-[#87929a] uppercase font-semibold">
            PORTFOLIO CONCENTRATION DIAGNOSTIC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
          <div className="p-3 bg-[#0d1c2d] border-l-2 border-[#a78bfa] rounded-r-xs space-y-1">
            <div className="text-[10px] font-mono-data text-[#a78bfa] uppercase font-bold">
              AI Generated Interpretation:
            </div>
            <p className="text-[#d4e4fa]">{portfolio.aiBriefing.aiAnalysis}</p>
          </div>

          <div className="p-3 bg-[#0d1c2d] border-l-2 border-[#34d399] rounded-r-xs space-y-1">
            <div className="text-[10px] font-mono-data text-[#34d399] uppercase font-bold">
              Deterministic Mathematical Calculation:
            </div>
            <p className="text-[#d4e4fa] font-mono-data">{portfolio.aiBriefing.calculationFact}</p>
          </div>
        </div>
      </div>

      {/* Phase 9: Portfolio Intelligence, Concentration HHI, Factor Risk & Grounded Inquiry */}
      <PortfolioIntelligencePanel
        portfolio={portfolio}
        onSelectStock={onSelectStock}
        onNavigate={onNavigate}
      />

      {/* Sector Allocation & Geographic Exposure Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sector Allocation Breakdown */}
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
              Sector Concentration Weighting
            </h3>
            <ProvenanceBadge tag="CALCULATION" size="xs" />
          </div>

          <div className="space-y-2.5">
            {portfolio.sectorAllocation.map((sec, i) => (
              <div key={i} className="space-y-1 text-xs font-mono-data">
                <div className="flex justify-between">
                  <span className="text-[#bdc8d1]">{sec.sector}</span>
                  <span className="text-[#d4e4fa] font-semibold">{sec.percentage}%</span>
                </div>
                <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${sec.percentage}%`, backgroundColor: sec.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Exposure */}
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
              Geographic Revenue Exposure
            </h3>
            <ProvenanceBadge tag="CALCULATION" size="xs" />
          </div>

          <div className="space-y-3 pt-1">
            {portfolio.geographicExposure.map((geo, i) => (
              <div key={i} className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1 text-xs font-mono-data">
                <div className="flex justify-between">
                  <span className="text-[#d4e4fa] font-medium">{geo.region}</span>
                  <span className="text-[#38bdf8] font-bold">{geo.percentage}%</span>
                </div>
                <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#38bdf8] h-full rounded-full" style={{ width: `${geo.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-[11px] font-mono-data text-[#87929a]">
            Note: Derived from segment footnote disclosures in corporate 10-K filings.
          </div>
        </div>
      </div>

      {/* Holdings Ledger Table */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
          <div>
            <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
              PORTFOLIO HOLDINGS & RISK CONTRIBUTIONS ({sortedHoldings.length} POSITIONS)
            </h3>
            <span className="text-[11px] font-mono-data text-[#87929a]">
              Click any row to open institutional stock deep dive
            </span>
          </div>

          {/* Controls: Sector Filter & Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-data">
            <div className="flex items-center gap-1">
              <span className="text-[#87929a] text-[11px]">Sector:</span>
              <select
                value={sectorFilter}
                onChange={e => setSectorFilter(e.target.value)}
                className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2 py-1 text-[11px] text-[#d4e4fa] focus:outline-none"
              >
                {sectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#87929a] text-[11px]">Sort By:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2 py-1 text-[11px] text-[#d4e4fa] focus:outline-none"
              >
                <option value="weight">Position Weight</option>
                <option value="value">Current Value</option>
                <option value="return">Total Return %</option>
                <option value="risk">Risk Contribution %</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead>
              <tr className="text-[#87929a] border-b border-[#1c2b3c] text-[11px]">
                <th className="py-2 px-2 font-medium">HOLDING</th>
                <th className="py-2 px-2 font-medium text-right">WEIGHT</th>
                <th className="py-2 px-2 font-medium text-right">SHARES</th>
                <th className="py-2 px-2 font-medium text-right">AVG COST</th>
                <th className="py-2 px-2 font-medium text-right">PRICE</th>
                <th className="py-2 px-2 font-medium text-right">CURRENT VALUE</th>
                <th className="py-2 px-2 font-medium text-right">TOTAL RETURN</th>
                <th className="py-2 px-2 font-medium text-right">RISK CONTRIB</th>
                <th className="py-2 px-2 font-medium text-center">THESIS STATUS</th>
                <th className="py-2 px-2 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2b3c]">
              {sortedHoldings.map(holding => (
                <tr
                  key={holding.ticker}
                  onClick={() => {
                    if (holding.ticker !== 'USD-CASH' && holding.ticker !== 'SHV') {
                      onSelectStock(holding.ticker);
                    }
                  }}
                  className={`transition-colors group ${
                    holding.ticker !== 'USD-CASH' && holding.ticker !== 'SHV'
                      ? 'hover:bg-[#0d1c2d] cursor-pointer'
                      : ''
                  }`}
                >
                  <td className="py-2.5 px-2">
                    <div className="font-bold text-[#38bdf8] group-hover:underline">
                      {holding.ticker}
                    </div>
                    <div className="text-[11px] text-[#87929a] truncate max-w-[150px]">
                      {holding.name}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold text-[#d4e4fa]">
                    {holding.weightPct.toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-2 text-right text-[#bdc8d1]">
                    {holding.shares.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right text-[#87929a]">
                    ${holding.avgCost.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-[#d4e4fa]">
                    ${holding.currentPrice.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold text-[#d4e4fa]">
                    ${holding.currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className={`py-2.5 px-2 text-right font-medium ${
                    holding.totalReturnPct >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'
                  }`}>
                    {holding.totalReturnPct >= 0 ? '+' : ''}${holding.totalReturnDollars.toLocaleString()} ({holding.totalReturnPct >= 0 ? '+' : ''}{holding.totalReturnPct.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold text-[#38bdf8]">
                    {holding.riskContributionPct > 0 ? `${holding.riskContributionPct}%` : '0.0%'}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <ThesisStatusBadge status={holding.thesisStatus} size="sm" />
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {holding.ticker !== 'USD-CASH' && holding.ticker !== 'SHV' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStock(holding.ticker);
                        }}
                        className="px-2 py-1 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#38bdf8] text-[11px] rounded-xs transition-colors"
                      >
                        Deep Dive
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#87929a]">Cash Asset</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Segregated Indian Equities Ledger (Currency-Isolated) */}
      {portfolio.inrHoldings && portfolio.inrHoldings.length > 0 && (
        <div className="bg-[#090d14] border border-[#3730a3]/50 rounded-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#818cf8]" />
                <h3 className="text-xs font-mono-data font-semibold text-[#818cf8] uppercase">
                  SEGREGATED INDIAN EQUITIES LEDGER ({portfolio.inrHoldings.length} POSITIONS • INR)
                </h3>
              </div>
              <span className="text-[11px] font-mono-data text-[#87929a]">
                Strict currency segregation enforced: No premature USD/INR mixing or ungrounded FX conversion.
              </span>
            </div>

            {portfolio.inrSummary && (
              <div className="flex items-center gap-4 text-xs font-mono-data">
                <div>
                  <span className="text-[#87929a] text-[10px] uppercase mr-1.5">Total INR Value:</span>
                  <strong className="text-[#d4e4fa]">₹{portfolio.inrSummary.totalValueInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                </div>
                <div>
                  <span className="text-[#87929a] text-[10px] uppercase mr-1.5">Unrealized:</span>
                  <strong className={portfolio.inrSummary.unrealizedReturnInr >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}>
                    {portfolio.inrSummary.unrealizedReturnInr >= 0 ? '+' : ''}₹{portfolio.inrSummary.unrealizedReturnInr.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({portfolio.inrSummary.unrealizedReturnPct >= 0 ? '+' : ''}{portfolio.inrSummary.unrealizedReturnPct.toFixed(1)}%)
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-data">
              <thead>
                <tr className="text-[#87929a] border-b border-[#1c2b3c] text-[11px]">
                  <th className="py-2 px-2 font-medium">HOLDING</th>
                  <th className="py-2 px-2 font-medium text-right">EXCHANGE</th>
                  <th className="py-2 px-2 font-medium text-right">SHARES</th>
                  <th className="py-2 px-2 font-medium text-right">AVG COST</th>
                  <th className="py-2 px-2 font-medium text-right">PRICE</th>
                  <th className="py-2 px-2 font-medium text-right">CURRENT VALUE</th>
                  <th className="py-2 px-2 font-medium text-right">TOTAL RETURN</th>
                  <th className="py-2 px-2 font-medium text-center">THESIS STATUS</th>
                  <th className="py-2 px-2 font-medium text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2b3c]">
                {portfolio.inrHoldings.map(holding => (
                  <tr
                    key={holding.ticker}
                    onClick={() => onSelectStock(holding.ticker)}
                    className="hover:bg-[#0d1c2d] cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-[#38bdf8] group-hover:underline">
                        {holding.ticker}
                      </div>
                      <div className="text-[11px] text-[#87929a] truncate max-w-[150px]">
                        {holding.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right text-[#818cf8] font-semibold">
                      NSE
                    </td>
                    <td className="py-2.5 px-2 text-right text-[#bdc8d1]">
                      {holding.shares.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right text-[#87929a]">
                      ₹{holding.avgCost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-[#d4e4fa]">
                      ₹{holding.currentPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-[#d4e4fa]">
                      ₹{holding.currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-medium ${
                      holding.totalReturnPct >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'
                    }`}>
                      {holding.totalReturnPct >= 0 ? '+' : ''}₹{holding.totalReturnDollars.toLocaleString()} ({holding.totalReturnPct >= 0 ? '+' : ''}{holding.totalReturnPct.toFixed(1)}%)
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <ThesisStatusBadge status={holding.thesisStatus} size="sm" />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStock(holding.ticker);
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
      )}
    </div>
  );
};
