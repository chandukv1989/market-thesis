import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Mic, Bell, Info, Shield, HelpCircle, ChevronRight, Activity, ArrowRight, CornerDownLeft, Sparkles, Navigation } from 'lucide-react';
import { ActiveScreen, DataSourcesHealth, SearchResult } from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { classifyAndResolve } from '../services/searchIntelligence';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  unreadAlertsCount: number;
  onSearchSubmit: (query: string) => void;
  onSelectStock?: (identifier: string) => void;
  portfolioNav: number;
  portfolioTodayChangePct: number;
  dataSourcesHealth?: DataSourcesHealth;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  unreadAlertsCount,
  onSearchSubmit,
  onSelectStock,
  portfolioNav,
  portfolioTodayChangePct,
  dataSourcesHealth
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [showVoicePlaceholder, setShowVoicePlaceholder] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchResult: SearchResult | null = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return classifyAndResolve(searchQuery);
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      return;
    }

    if (!searchResult) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        onSearchSubmit(searchQuery);
        setIsDropdownOpen(false);
      }
      return;
    }

    const matchesCount = searchResult.intent === 'SECURITY_LOOKUP' ? searchResult.matches.length : 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, matchesCount - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      if (searchResult.intent === 'SECURITY_LOOKUP' && searchResult.matches.length > 0) {
        const chosen = searchResult.matches[selectedIndex] || searchResult.matches[0];
        if (onSelectStock) {
          onSelectStock(chosen.security.id || chosen.security.symbol);
        } else {
          onSearchSubmit(chosen.security.id || chosen.security.symbol);
        }
      } else if (searchResult.intent === 'NAVIGATION' && searchResult.navigationTarget) {
        onNavigate(searchResult.navigationTarget);
      } else {
        onSearchSubmit(searchQuery);
      }
      setIsDropdownOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-[#051424]/95 backdrop-blur-md border-b border-[#1c2b3c] text-[#d4e4fa]">
      {/* Left: Terminal status & Brand identifier */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono-data font-semibold tracking-wider text-emerald-400 uppercase hidden sm:inline">
            TERMINAL ONLINE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono-data font-semibold bg-[#122131] border border-[#1c2b3c] text-[#34d399] rounded-xs uppercase hidden md:inline-flex items-center gap-1" title="Real SEC EDGAR integration active">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            SEC EDGAR: REAL
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono-data font-semibold bg-[#122131] border border-[#1c2b3c] text-[#87929a] rounded-xs uppercase" title="Market prices simulated across US and Indian exchanges until external market data provider is configured">
            MARKETS: US & IN (SIMULATED)
          </span>
        </div>
        <span className="text-[#3e484f] hidden sm:inline">|</span>
        <div className="flex items-center gap-1.5 text-xs text-[#87929a] font-mono-data hidden md:flex">
          <Activity className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>EPISTEMIC ENGINE V0.9</span>
        </div>
      </div>

      {/* Center: Global AI Investigation Search Bar */}
      <div ref={dropdownRef} className="relative flex-1 max-w-xl mx-4">
        <div className="relative flex items-center bg-[#0d1c2d] border border-[#1c2b3c] focus-within:border-[#38bdf8] rounded-sm transition-colors group">
          <Search className="w-4 h-4 ml-2.5 text-[#87929a] group-focus-within:text-[#38bdf8] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsDropdownOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Investigate ticker or ask (e.g. 'NVDA', 'RELIANCE NSE', 'TCS', 'Why is NVDA down?')..."
            className="w-full py-1.5 pl-2 pr-16 bg-transparent text-xs text-[#d4e4fa] placeholder-[#87929a] focus:outline-none font-mono-data"
          />
          {/* Voice Input Button as UI Placeholder */}
          <button
            type="button"
            title="Voice Investigation Input (UI Preview)"
            onClick={() => setShowVoicePlaceholder(true)}
            className="absolute right-1.5 p-1 text-[#87929a] hover:text-[#38bdf8] hover:bg-[#1c2b3c] rounded-xs transition-colors"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Phase 6: Deterministic Query & Ticker Candidate Dropdown */}
        {isDropdownOpen && searchResult && searchQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#091522] border border-[#1c2b3c] shadow-2xl rounded-xs z-50 overflow-hidden font-mono-data text-xs">
            {/* Header: Intent Classification */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#05111d] border-b border-[#1c2b3c]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-[#87929a]">
                  INTENT:
                </span>
                {searchResult.intent === 'SECURITY_LOOKUP' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#0c2438] text-[#38bdf8] border border-[#38bdf8]/30 rounded-xs">
                    SECURITY LOOKUP
                  </span>
                )}
                {searchResult.intent === 'RESEARCH_QUERY' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#1e1b4b] text-[#a78bfa] border border-[#a78bfa]/30 rounded-xs">
                    RESEARCH & RAG INQUIRY
                  </span>
                )}
                {searchResult.intent === 'NAVIGATION' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#062e24] text-[#34d399] border border-[#34d399]/30 rounded-xs">
                    APP NAVIGATION
                  </span>
                )}
                {searchResult.intent === 'UNKNOWN' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#1c2b3c] text-[#87929a] rounded-xs">
                    GENERAL DISCOVERY
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#87929a] hidden sm:inline">
                Press Enter ↵ to resolve
              </span>
            </div>

            {/* Content: SECURITY LOOKUP */}
            {searchResult.intent === 'SECURITY_LOOKUP' && (
              <div className="max-h-64 overflow-y-auto divide-y divide-[#1c2b3c]/60">
                {searchResult.matches.slice(0, 6).map((match, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={match.security.id || `${match.security.symbol}-${match.security.exchange}-${idx}`}
                      onClick={() => {
                        if (onSelectStock) {
                          onSelectStock(match.security.id || match.security.symbol);
                        } else {
                          onSearchSubmit(match.security.id || match.security.symbol);
                        }
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-[#122538]' : 'hover:bg-[#0d1c2d]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-bold text-[#d4e4fa] text-xs">
                          {match.security.symbol}
                        </span>
                        <span className="text-[11px] text-[#87929a] truncate max-w-[200px] sm:max-w-[280px]">
                          {match.security.companyName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Explicit Exchange Badge */}
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-xs border ${
                          match.security.exchange === 'BSE'
                            ? 'bg-[#1a2333] text-[#60a5fa] border-[#60a5fa]/30'
                            : match.security.exchange === 'NSE'
                            ? 'bg-[#0f2e24] text-[#34d399] border-[#34d399]/30'
                            : 'bg-[#122131] text-[#38bdf8] border-[#38bdf8]/30'
                        }`}>
                          {match.security.exchange}
                        </span>
                        {/* Market / Currency */}
                        <span className="text-[10px] text-[#87929a] hidden sm:inline">
                          {match.security.currency}
                        </span>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-[#38bdf8] ml-1" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content: RESEARCH QUERY */}
            {searchResult.intent === 'RESEARCH_QUERY' && (
              <button
                onClick={() => {
                  onSearchSubmit(searchQuery);
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left p-3 hover:bg-[#122538] transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-[#d4e4fa] font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" />
                    <span>Investigate inquiry in Research & RAG Workspace</span>
                  </div>
                  <CornerDownLeft className="w-3.5 h-3.5 text-[#a78bfa]" />
                </div>
                <div className="text-[11px] text-[#87929a] truncate">
                  "{searchQuery}"
                </div>
                {searchResult.securities.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-[#87929a]">
                    <span>Detected Security Context:</span>
                    {searchResult.securities.map(s => (
                      <span key={s.id || s.symbol} className="px-1.5 py-0.2 bg-[#17263c] text-[#7bd0ff] rounded-xs font-bold">
                        {s.symbol} ({s.exchange})
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )}

            {/* Content: NAVIGATION */}
            {searchResult.intent === 'NAVIGATION' && searchResult.navigationTarget && (
              <button
                onClick={() => {
                  onNavigate(searchResult.navigationTarget!);
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left p-3 hover:bg-[#122538] transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-xs text-[#d4e4fa]">
                  <Navigation className="w-3.5 h-3.5 text-[#34d399]" />
                  <span>
                    Navigate to <strong className="text-[#34d399] uppercase">{searchResult.navigationTarget}</strong> screen
                  </span>
                </div>
                <CornerDownLeft className="w-3.5 h-3.5 text-[#34d399]" />
              </button>
            )}

            {/* Content: UNKNOWN */}
            {searchResult.intent === 'UNKNOWN' && (
              <div className="p-3 text-center text-[#87929a] text-xs">
                No exact security match found. Press Enter to view Market Discover screener.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Quick Portfolio NAV Chip, Epistemic Legend, Alerts */}
      <div className="flex items-center gap-3">
        {/* Quick Portfolio NAV button */}
        <button
          onClick={() => onNavigate('portfolio')}
          className="flex items-center gap-2 px-2.5 py-1 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] rounded-sm transition-colors text-left hidden lg:flex"
        >
          <div className="text-[10px] font-mono-data text-[#87929a] uppercase">NAV</div>
          <div className="font-mono-data text-xs font-semibold text-[#d4e4fa]">
            ${portfolioNav.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span className={`text-[11px] font-mono-data font-semibold ${portfolioTodayChangePct >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}`}>
            {portfolioTodayChangePct >= 0 ? '+' : ''}{portfolioTodayChangePct.toFixed(2)}%
          </span>
        </button>

        {/* Epistemic Provenance Guide modal toggle */}
        <button
          onClick={() => setShowLegendModal(true)}
          title="Epistemic Provenance Key (FACT vs AI ANALYSIS)"
          className="flex items-center gap-1 px-2 py-1 bg-[#0d1c2d] hover:bg-[#1c2b3c] border border-[#1c2b3c] rounded-sm text-xs font-mono-data text-[#bdc8d1] transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span className="hidden xl:inline text-[11px]">PROVENANCE KEY</span>
        </button>

        {/* Alerts Bell */}
        <button
          onClick={() => onNavigate('alerts')}
          className="relative p-1.5 bg-[#0d1c2d] hover:bg-[#1c2b3c] border border-[#1c2b3c] rounded-sm text-[#87929a] hover:text-[#d4e4fa] transition-colors"
          title="Monitored Alerts & Thesis Events"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-[#f43f5e] text-white font-mono-data text-[10px] font-bold rounded-full">
              {unreadAlertsCount}
            </span>
          )}
        </button>
      </div>

      {/* Voice Placeholder Toast */}
      {showVoicePlaceholder && (
        <div className="fixed top-16 right-4 z-50 p-3 bg-[#090d14] border border-[#38bdf8]/40 shadow-xl rounded-sm max-w-sm text-xs font-mono-data animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-[#38bdf8] font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" /> VOICE PROTOCOL READY
            </span>
            <button onClick={() => setShowVoicePlaceholder(false)} className="text-[#87929a] hover:text-[#d4e4fa]">✕</button>
          </div>
          <p className="text-[#bdc8d1] text-[11px]">
            Voice query input is configured in UI mode. In production, this streams speech directly to quantitative research workers.
          </p>
        </div>
      )}

      {/* Epistemic Legend Modal */}
      {showLegendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#090d14] border border-[#273647] rounded-sm max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#38bdf8]" />
                <h3 className="font-semibold text-sm text-[#d4e4fa] tracking-wide">
                  EPISTEMIC PROVENANCE SYSTEM
                </h3>
              </div>
              <button
                onClick={() => setShowLegendModal(false)}
                className="text-[#87929a] hover:text-[#d4e4fa] text-xs font-mono-data"
              >
                ✕ CLOSE
              </button>
            </div>

            <p className="text-xs text-[#bdc8d1] leading-relaxed">
              Every data point, quote, and sentence in this terminal is explicitly classified to protect institutional decision makers from hallucination and overconfidence.
            </p>

            {/* Live Data Provider Status */}
            {dataSourcesHealth && (
              <div className="p-3 bg-[#051424] border border-[#1c2b3c] rounded-sm space-y-2 text-xs font-mono-data">
                <div className="text-[10px] text-[#87929a] uppercase font-bold tracking-wider">
                  DATA PROVIDER ARCHITECTURE STATUS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <div className="text-[#87929a] text-[10px]">SEC EDGAR (XBRL)</div>
                    <div className="text-[#34d399] font-bold mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                      {dataSourcesHealth.secEdgar.status} (REAL)
                    </div>
                    <div className="text-[#87929a] text-[9px] mt-0.5 truncate">{dataSourcesHealth.secEdgar.dataFreshness}</div>
                  </div>

                  <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <div className="text-[#87929a] text-[10px]">US (Twelve Data)</div>
                    {dataSourcesHealth.usMarketData?.status === 'Connected' && !dataSourcesHealth.usMarketData?.isSimulated ? (
                      <div className="text-[#34d399] font-bold mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                        Connected (REAL)
                      </div>
                    ) : (
                      <div className="text-amber-400 font-bold mt-0.5">
                        {dataSourcesHealth.usMarketData?.status === 'UNCONFIGURED' ? 'UNCONFIGURED' : dataSourcesHealth.usMarketData?.status || 'UNCONFIGURED'} (SIMULATED)
                      </div>
                    )}
                    <div className="text-[#87929a] text-[9px] mt-0.5 truncate">
                      {dataSourcesHealth.usMarketData?.status === 'Connected' && !dataSourcesHealth.usMarketData?.isSimulated
                        ? 'Live Twelve Data'
                        : 'Simulated Baseline'}
                    </div>
                  </div>

                  <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <div className="text-[#87929a] text-[10px]">India (TrueData)</div>
                    {dataSourcesHealth.indiaMarketData?.status === 'Connected' && !dataSourcesHealth.indiaMarketData?.isSimulated ? (
                      <div className="text-[#34d399] font-bold mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                        Connected (REAL)
                      </div>
                    ) : (
                      <div className="text-amber-400 font-bold mt-0.5">
                        {dataSourcesHealth.indiaMarketData?.status === 'UNCONFIGURED' ? 'UNCONFIGURED' : dataSourcesHealth.indiaMarketData?.status || 'UNCONFIGURED'} (SIMULATED)
                      </div>
                    )}
                    <div className="text-[#87929a] text-[9px] mt-0.5 truncate">
                      {dataSourcesHealth.indiaMarketData?.status === 'Connected' && !dataSourcesHealth.indiaMarketData?.isSimulated
                        ? 'Live TrueData'
                        : 'Simulated Baseline'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm">
                <ProvenanceBadge tag="FACT" size="xs" />
                <span className="text-[#bdc8d1] text-[11px]">
                  Verifiable public disclosures directly extracted from SEC 10-K/Q filings, press releases, or official transcripts.
                </span>
              </div>
              <div className="flex items-start gap-2.5 p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm">
                <ProvenanceBadge tag="CALCULATION" size="xs" />
                <span className="text-[#bdc8d1] text-[11px]">
                  Deterministic formulas: DCF outputs, ROIC, Beta, Sharpe ratio, and variance calculations.
                </span>
              </div>
              <div className="flex items-start gap-2.5 p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm">
                <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
                <span className="text-[#bdc8d1] text-[11px]">
                  Probabilistic LLM synthesis and thematic evaluation. Never to be construed as certainty.
                </span>
              </div>
              <div className="flex items-start gap-2.5 p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm">
                <ProvenanceBadge tag="RISK" size="xs" />
                <span className="text-[#bdc8d1] text-[11px]">
                  Specific tail risks, regulatory exposures, packaging bottlenecks, or macroeconomic vulnerabilities.
                </span>
              </div>
              <div className="flex items-start gap-2.5 p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm">
                <ProvenanceBadge tag="UNCERTAINTY" size="xs" />
                <span className="text-[#bdc8d1] text-[11px]">
                  Wide confidence bands, conflicting data sources, or unverified forward guidance.
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1c2b3c] flex justify-end">
              <button
                onClick={() => setShowLegendModal(false)}
                className="px-3 py-1 bg-[#38bdf8] text-[#051424] font-semibold text-xs rounded-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
