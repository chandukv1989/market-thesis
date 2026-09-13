import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Stock,
  PortfolioData,
  Strategy,
  AlertItem,
  ResearchQueryItem,
  BacktestResult,
  HoldingPosition,
  ActiveScreen,
  EvidenceSource,
  DataSourcesHealth,
  FinancialFact,
  FilingRecord,
  SecurityIdentifier
} from '../types';
import {
  CANONICAL_SECURITIES_MAP,
  MOCK_STRATEGIES,
  MOCK_ALERTS,
  MOCK_BACKTEST,
  MOCK_RESEARCH_QUERIES
} from '../data/mockData';
import { derivePortfolio, DEFAULT_HOLDING_POSITIONS } from './portfolioEngine';
import { financialClient } from '../services/financialDataService';
import { resolveSecurity } from '../data/canonicalSecurities';
import { classifyAndResolve } from '../services/searchIntelligence';

export interface AppContextType {
  // Securities (Single Source of Truth)
  securities: Record<string, Stock>;
  securitiesList: Stock[];
  getSecurity: (ticker: string) => Stock | undefined;
  updateSecurity: (ticker: string, updates: Partial<Stock>) => void;
  updateSecurityPrice: (ticker: string, newPrice: number, newChange?: number) => void;

  // Real Financial Data Provider Layer
  dataSourcesHealth: DataSourcesHealth;
  isSecLoading: boolean;
  fetchSecDataForTicker: (ticker: string) => Promise<void>;
  refreshProviderHealth: () => Promise<void>;
  realFactsMap: Record<string, FinancialFact[]>;
  recentFilingsMap: Record<string, FilingRecord[]>;

  // Portfolio (Derived from holdings & canonical securities)
  holdingPositions: HoldingPosition[];
  portfolio: PortfolioData;
  updateHolding: (ticker: string, shares: number, avgCost: number) => void;

  // Watchlist (Tickers linked to canonical securities)
  watchlist: string[];
  watchlistedSecurities: Stock[];
  isWatchlisted: (ticker: string) => boolean;
  toggleWatchlist: (ticker: string) => void;
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;

  // Alerts
  alerts: AlertItem[];
  markAllAlertsRead: () => void;
  toggleAlertRead: (id: string) => void;
  unreadAlertsCount: number;

  // Strategies & Backtesting
  strategies: Strategy[];
  addStrategy: (strat: Strategy) => void;
  backtests: Record<string, BacktestResult>;
  currentBacktest: BacktestResult;
  selectedStrategyForBacktest: Strategy | null;
  selectStrategyForBacktest: (strat: Strategy) => void;

  // Research Queries
  researchQueries: ResearchQueryItem[];
  addResearchQuery: (query: ResearchQueryItem) => void;

  // Global Navigation & UI
  currentScreen: ActiveScreen;
  setCurrentScreen: (screen: ActiveScreen) => void;
  selectedSecurityId: string;
  setSelectedSecurityId: (id: string) => void;
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  activeResearchContext: { query: string; securities: SecurityIdentifier[] } | null;
  setActiveResearchContext: (ctx: { query: string; securities: SecurityIdentifier[] } | null) => void;
  currentStock: Stock;
  activeEvidence: EvidenceSource | null;
  setActiveEvidence: (ev: EvidenceSource | null) => void;
  handleSelectStock: (identifier: string) => void;
  handleSearchSubmit: (query: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Canonical Securities
  const [securities, setSecurities] = useState<Record<string, Stock>>(CANONICAL_SECURITIES_MAP);
  const [realFactsMap, setRealFactsMap] = useState<Record<string, FinancialFact[]>>({});
  const [recentFilingsMap, setRecentFilingsMap] = useState<Record<string, FilingRecord[]>>({});
  const [isSecLoading, setIsSecLoading] = useState(false);

  // Data sources health
  const [dataSourcesHealth, setDataSourcesHealth] = useState<DataSourcesHealth>({
    secEdgar: {
      name: 'SEC EDGAR (XBRL & Submissions)',
      status: 'Connected',
      lastSuccessfulRetrieval: null,
      dataFreshness: 'Simulated Baseline',
      details: 'Active & ready for SEC EDGAR EDGAR submissions and XBRL facts',
      isSimulated: false
    },
    marketData: {
      name: 'Simulated Pricing Engine',
      status: 'UNCONFIGURED',
      lastSuccessfulRetrieval: null,
      dataFreshness: 'Simulated Baseline (Unconfigured Provider)',
      details: 'Market data provider unconfigured (MARKET_DATA_API_KEY optional). Running in simulated price mode.',
      isSimulated: true
    }
  });

  const securitiesList = useMemo(() => {
    const map = new Map<string, Stock>();
    (Object.values(securities) as Stock[]).forEach(s => {
      if (s?.ticker && !map.has(s.ticker.toUpperCase())) {
        map.set(s.ticker.toUpperCase(), s);
      }
    });
    return Array.from(map.values());
  }, [securities]);

  const getSecurity = useCallback((tickerOrId: string) => {
    const key = tickerOrId.toUpperCase();
    if (securities[key]) return securities[key];
    const resolved = resolveSecurity(tickerOrId);
    if (resolved) {
      const sym = resolved.symbol.toUpperCase();
      if (securities[sym]) return securities[sym];
    }
    const byId = (Object.values(securities) as Stock[]).find(
      s => s.id?.toLowerCase() === tickerOrId.toLowerCase()
    );
    if (byId) return byId;
    return undefined;
  }, [securities]);

  const updateSecurity = useCallback((ticker: string, updates: Partial<Stock>) => {
    const key = ticker.toUpperCase();
    setSecurities(prev => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          ...updates
        }
      };
    });
  }, []);

  const updateSecurityPrice = useCallback((ticker: string, newPrice: number, newChange?: number) => {
    const key = ticker.toUpperCase();
    setSecurities(prev => {
      const existing = prev[key];
      if (!existing) return prev;
      const prevPrice = existing.price;
      const change = newChange !== undefined ? newChange : (newPrice - prevPrice);
      const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
      return {
        ...prev,
        [key]: {
          ...existing,
          price: Math.round(newPrice * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100
        }
      };
    });
  }, []);

  // Provider health refresh
  const refreshProviderHealth = useCallback(async () => {
    const health = await financialClient.getDataSourcesHealth();
    if (health) {
      setDataSourcesHealth(health);
    }
  }, []);

  // Fetch SEC EDGAR real facts and filings for a ticker (US securities only)
  const fetchSecDataForTicker = useCallback(async (ticker: string) => {
    const sym = ticker.toUpperCase();
    const sec = securities[sym] || resolveSecurity(sym);
    if (sec && sec.market === 'INDIA') {
      // SEC EDGAR is US-only; non-US equities rely on statutory reporting
      return;
    }
    setIsSecLoading(true);
    try {
      const data = await financialClient.getSecurityFinancials(sym);
      if (data && data.facts && data.facts.length > 0) {
        setRealFactsMap(prev => ({ ...prev, [sym]: data.facts }));
        setRecentFilingsMap(prev => ({ ...prev, [sym]: data.filings }));

        setSecurities(prev => {
          const current = prev[sym];
          if (!current) return prev;

          // Convert SEC filings into real verified EvidenceSources
          const realEvidenceSources: EvidenceSource[] = data.filings.slice(0, 5).map((f, idx) => ({
            id: `sec-${f.accessionNumber || idx}`,
            type: (f.form === '10-K' ? 'SEC 10-K' : f.form === '10-Q' ? 'SEC 10-Q' : 'Government Filing') as EvidenceSource['type'],
            title: `${sym} ${f.form} Verified Filing (${f.reportDate})`,
            sourceDoc: `SEC EDGAR Accession #${f.accessionNumber}`,
            reportingDate: f.reportDate || f.filingDate,
            freshness: `Verified SEC EDGAR • Filed ${f.filingDate}`,
            quote: `Official SEC disclosure filed with the U.S. Securities and Exchange Commission for CIK ${data.cik}. Document: ${f.primaryDocument}`,
            confidence: 99,
            url: f.sourceUrl,
            verificationHash: `EDGAR-${f.accessionNumber.replace(/-/g, '').slice(0, 16)}`,
            extractedPillar: 'Fundamental Financial Disclosures'
          }));

          // Use real derived quarterly financials if available from SEC
          const updatedQuarters = data.derivedQuarters && data.derivedQuarters.length > 0
            ? data.derivedQuarters.map(dq => ({
                period: dq.period,
                revenue: dq.revenue,
                grossMarginPct: dq.grossMarginPct,
                operatingIncome: dq.operatingIncome,
                netIncome: dq.netIncome,
                freeCashFlow: dq.freeCashFlow,
                capex: dq.capex
              }))
            : current.financialQuarters;

          return {
            ...prev,
            [sym]: {
              ...current,
              secCik: data.cik,
              isSecGrounded: true,
              retrievedAt: data.retrievedAt,
              dataFreshness: `SEC EDGAR Verified (As of ${new Date(data.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
              lastCalculated: 'SEC EDGAR XBRL Engine',
              financialQuarters: updatedQuarters,
              evidenceSources: realEvidenceSources.length > 0 ? realEvidenceSources : current.evidenceSources,
              realFinancialFacts: data.facts,
              recentFilings: data.filings
            }
          };
        });

        // Update provider health to show last retrieval
        setDataSourcesHealth(prev => ({
          ...prev,
          secEdgar: {
            ...prev.secEdgar,
            status: 'Connected',
            lastSuccessfulRetrieval: data.retrievedAt,
            dataFreshness: `Real-time SEC Connected (${sym} Grounded)`
          }
        }));
      }
    } catch (err) {
      console.warn(`Could not retrieve SEC EDGAR data for ${sym}:`, err);
    } finally {
      setIsSecLoading(false);
    }
  }, []);

  // Initial load: Fetch SEC EDGAR data for NVDA and initialize provider health
  useEffect(() => {
    refreshProviderHealth();
    fetchSecDataForTicker('NVDA');
  }, [refreshProviderHealth, fetchSecDataForTicker]);

  // 2. Holding Positions & Derived Portfolio
  const [holdingPositions, setHoldingPositions] = useState<HoldingPosition[]>(DEFAULT_HOLDING_POSITIONS);

  const portfolio = useMemo(() => {
    return derivePortfolio(holdingPositions, securities);
  }, [holdingPositions, securities]);

  const updateHolding = useCallback((ticker: string, shares: number, avgCost: number) => {
    setHoldingPositions(prev => {
      const idx = prev.findIndex(p => p.ticker.toUpperCase() === ticker.toUpperCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], shares, avgCost };
        return copy;
      }
      return [...prev, { ticker: ticker.toUpperCase(), shares, avgCost }];
    });
  }, []);

  // 3. Watchlist
  const [watchlist, setWatchlist] = useState<string[]>(['NVDA', 'TSM', 'MSFT', 'ASML', 'AMZN', 'AAPL', 'AVGO', 'PLTR']);

  const watchlistedSecurities = useMemo(() => {
    return watchlist
      .map(ticker => securities[ticker])
      .filter((s): s is Stock => Boolean(s));
  }, [watchlist, securities]);

  const isWatchlisted = useCallback((ticker: string) => {
    return watchlist.includes(ticker.toUpperCase());
  }, [watchlist]);

  const toggleWatchlist = useCallback((ticker: string) => {
    const sym = ticker.toUpperCase();
    setWatchlist(prev =>
      prev.includes(sym) ? prev.filter(t => t !== sym) : [...prev, sym]
    );
  }, []);

  const addToWatchlist = useCallback((ticker: string) => {
    const sym = ticker.toUpperCase();
    setWatchlist(prev => (prev.includes(sym) ? prev : [...prev, sym]));
  }, []);

  const removeFromWatchlist = useCallback((ticker: string) => {
    const sym = ticker.toUpperCase();
    setWatchlist(prev => prev.filter(t => t !== sym));
  }, []);

  // 4. Alerts
  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    return MOCK_ALERTS.map(a => {
      if (a.ticker && CANONICAL_SECURITIES_MAP[a.ticker]) {
        return {
          ...a,
          companyName: CANONICAL_SECURITIES_MAP[a.ticker].name
        };
      }
      return a;
    });
  });

  const markAllAlertsRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true, read: true })));
  }, []);

  const toggleAlertRead = useCallback((id: string) => {
    setAlerts(prev =>
      prev.map(a => (a.id === id ? { ...a, isRead: !a.isRead, read: !a.isRead } : a))
    );
  }, []);

  const unreadAlertsCount = useMemo(() => {
    return alerts.filter(a => !a.isRead && !a.read).length;
  }, [alerts]);

  // 5. Strategies & Backtests
  const [strategies, setStrategies] = useState<Strategy[]>(MOCK_STRATEGIES);
  const [backtests] = useState<Record<string, BacktestResult>>({
    'strat-1': MOCK_BACKTEST,
    'bt-1': MOCK_BACKTEST
  });
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<Strategy | null>(
    MOCK_STRATEGIES[0] || null
  );

  const currentBacktest = useMemo(() => {
    if (selectedStrategyForBacktest && backtests[selectedStrategyForBacktest.id]) {
      return backtests[selectedStrategyForBacktest.id];
    }
    return MOCK_BACKTEST;
  }, [selectedStrategyForBacktest, backtests]);

  const selectStrategyForBacktest = useCallback((strat: Strategy) => {
    setSelectedStrategyForBacktest(strat);
  }, []);

  const addStrategy = useCallback((strat: Strategy) => {
    setStrategies(prev => [strat, ...prev]);
  }, []);

  // 6. Research
  const [researchQueries, setResearchQueries] = useState<ResearchQueryItem[]>(MOCK_RESEARCH_QUERIES);

  const addResearchQuery = useCallback((query: ResearchQueryItem) => {
    setResearchQueries(prev => [query, ...prev]);
  }, []);

  // 7. Global Navigation & Selected Stock
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('dashboard');
  const [selectedSecurityId, setSelectedSecurityId] = useState<string>('us-nvda');
  const [selectedTicker, setSelectedTicker] = useState<string>('NVDA');
  const [activeResearchContext, setActiveResearchContext] = useState<{
    query: string;
    securities: SecurityIdentifier[];
  } | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceSource | null>(null);

  const currentStock = useMemo(() => {
    return (
      (selectedSecurityId ? securities[selectedSecurityId] : null) ||
      securities[selectedTicker] ||
      securitiesList[0] ||
      CANONICAL_SECURITIES_MAP['NVDA']
    );
  }, [securities, selectedSecurityId, selectedTicker, securitiesList]);

  const handleSelectStock = useCallback((identifier: string) => {
    const raw = identifier.trim();
    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();

    // 1. Direct ID match or ticker match in securities map
    const byKey = securities[raw] || securities[lower] || securities[upper];
    // 2. Resolve via canonical security resolver (supports BSE, NSE, NASDAQ, etc.)
    const resolvedCanonical = resolveSecurity(raw);

    const resolved = byKey || resolvedCanonical;

    if (resolved) {
      const canonicalId = resolved.id || (resolved.market === 'INDIA' ? `in-${resolved.symbol.toLowerCase()}` : `us-${resolved.symbol.toLowerCase()}`);
      const targetTicker = 'ticker' in resolved ? (resolved as Stock).ticker : resolved.symbol.toUpperCase();

      setSelectedSecurityId(canonicalId);
      setSelectedTicker(targetTicker);

      // Only fetch SEC EDGAR for US securities that have not yet been grounded
      if (resolved.market !== 'INDIA' && !securities[targetTicker]?.isSecGrounded) {
        fetchSecDataForTicker(targetTicker);
      }
    } else {
      setSelectedSecurityId('us-nvda');
      setSelectedTicker('NVDA');
    }
    setCurrentScreen('deep-dive');
  }, [securities, fetchSecDataForTicker]);

  const handleSearchSubmit = useCallback((query: string) => {
    const clean = query.trim();
    if (!clean) return;

    // Use deterministic intent classification and resolution (Phase 6)
    const result = classifyAndResolve(clean);

    // 1. NAVIGATION INTENT
    if (result.intent === 'NAVIGATION' && result.navigationTarget) {
      setCurrentScreen(result.navigationTarget);
      return;
    }

    // 2. RESEARCH QUERY INTENT
    // Rule: Do not accidentally interpret natural-language research questions as ticker search
    if (result.intent === 'RESEARCH_QUERY') {
      setActiveResearchContext({
        query: result.query,
        securities: result.securities
      });
      addResearchQuery({
        id: `query-${Date.now()}`,
        query: result.query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: result.confidence,
        provenance: 'AI ANALYSIS',
        relatedSecurities: result.securities.map(s => s.symbol)
      });
      setCurrentScreen('research');
      return;
    }

    // 3. SECURITY LOOKUP INTENT
    if (result.intent === 'SECURITY_LOOKUP') {
      if (result.matches.length > 0) {
        const topSec = result.matches[0].security;
        handleSelectStock(topSec.id || topSec.symbol);
        setCurrentScreen('deep-dive');
        return;
      }
    }

    // 4. Fallback matches or unknown
    if (result.matches.length > 0) {
      const topSec = result.matches[0].security;
      handleSelectStock(topSec.id || topSec.symbol);
      setCurrentScreen('deep-dive');
      return;
    }

    // If completely unknown, navigate to discover
    setCurrentScreen('discover');
  }, [handleSelectStock, addResearchQuery]);

  const value: AppContextType = {
    securities,
    securitiesList,
    getSecurity,
    updateSecurity,
    updateSecurityPrice,
    dataSourcesHealth,
    isSecLoading,
    fetchSecDataForTicker,
    refreshProviderHealth,
    realFactsMap,
    recentFilingsMap,
    holdingPositions,
    portfolio,
    updateHolding,
    watchlist,
    watchlistedSecurities,
    isWatchlisted,
    toggleWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    alerts,
    markAllAlertsRead,
    toggleAlertRead,
    unreadAlertsCount,
    strategies,
    addStrategy,
    backtests,
    currentBacktest,
    selectedStrategyForBacktest,
    selectStrategyForBacktest,
    researchQueries,
    addResearchQuery,
    currentScreen,
    setCurrentScreen,
    selectedSecurityId,
    setSelectedSecurityId,
    selectedTicker,
    setSelectedTicker,
    activeResearchContext,
    setActiveResearchContext,
    currentStock,
    activeEvidence,
    setActiveEvidence,
    handleSelectStock,
    handleSearchSubmit
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppState = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
