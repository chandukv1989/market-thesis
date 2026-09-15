export type MarketRegion = 'US' | 'INDIA' | 'GLOBAL';
export type SupportedExchange = 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | string;
export type AssetType = 'EQUITY' | 'ETF' | 'INDEX' | 'MUTUAL_FUND' | string;

export interface SecurityIdentifier {
  id: string;
  symbol: string;
  companyName: string;
  market: MarketRegion;
  exchange: SupportedExchange;
  country: string;
  currency: string;
  isin?: string | null;
  sector?: string;
  industry?: string;
  assetType?: AssetType;
}

export type ProvenanceTag =
  | 'FACT'
  | 'CALCULATION'
  | 'AI ANALYSIS'
  | 'RISK'
  | 'KEY CONCERN'
  | 'UNCERTAINTY'
  | 'SOURCE';

export type ThesisStatus =
  | 'Healthy'
  | 'Improving'
  | 'Watch'
  | 'Deteriorating'
  | 'Thesis Broken';

export interface EvidenceSource {
  id: string;
  type: 'SEC 10-K' | 'SEC 10-Q' | 'Earnings Transcript' | 'Investor Deck' | 'Expert Research' | 'Government Filing';
  title: string;
  sourceDoc: string;
  reportingDate: string;
  freshness: string;
  quote: string;
  confidence: number; // 0 to 100
  url?: string;
  verificationHash?: string;
  extractedPillar?: string;
}

export interface FactorBreakdown {
  growth: number;
  quality: number;
  valuation: number;
  risk: number;
  momentum: number;
}

export interface FactorWeights {
  growth: number;
  quality: number;
  valuation: number;
  risk: number;
  momentum: number;
}

export interface ThesisPillar {
  name: string;
  score: number;
  status: 'Strong' | 'Neutral' | 'Vulnerable';
  fact: string;
  calculation: string;
  aiAnalysis: string;
  uncertainty?: string;
  evidenceRef: string;
}

export interface ThesisBreaker {
  id: string;
  condition: string;
  threshold: string;
  currentStatus: string;
  status: 'Safe' | 'Warning' | 'Breached';
  probabilityEstimate: string;
  impactSeverity: 'High' | 'Severe' | 'Moderate';
}

export interface CommitteePerspective {
  role: 'Bull Case' | 'Base Case' | 'Bear Case' | 'Risk Analyst' | 'Final Assessment';
  author: string;
  conviction: 'High' | 'Moderate' | 'Speculative';
  summary: string;
  coreArguments: string[];
  keyVulnerability: string;
  confidenceScore: number;
}

export interface FinancialQuarter {
  period: string; // e.g., 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24'
  revenue: number; // in billions or millions
  grossMarginPct: number;
  operatingIncome: number;
  netIncome: number;
  freeCashFlow: number;
  capex: number;
}

export interface Stock {
  // Canonical Security Identifiers
  id?: string;
  symbol?: string;
  companyName?: string;
  market?: MarketRegion;
  country?: string;
  currency?: string;
  isin?: string | null;
  assetType?: AssetType;

  // Legacy & Display Identity (100% backward compatible)
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  peRatio?: number | null;
  forwardPe?: number | null;
  psRatio?: number | null;
  evEbitda?: number | null;
  fcfYield?: number | null;
  dividendYield?: number | null;
  roic?: number | null;
  beta?: number | null;
  debtToEquity?: number | null;
  overallScore: number; // Overall Decision Score
  confidence: number; // e.g. 91%
  dataCompleteness: number; // e.g. 96%
  lastCalculated: string;
  dataFreshness: string;
  factorScores: FactorBreakdown;
  factorWeights: FactorWeights;
  rulesPassed: { passed: number; total: number };
  whyThisStock: string;
  aiInterpretation: string;
  keyConcern: string;
  thesisStatus: ThesisStatus;
  thesisOverview: string;
  thesisPillars: ThesisPillar[];
  thesisBreakers: ThesisBreaker[];
  aiCommittee: CommitteePerspective[];
  financialQuarters: FinancialQuarter[];
  portfolioFit: {
    correlation: number;
    sectorTechDelta: string;
    riskContributionPct: number;
    scenarioImpact: {
      rateHike100bps: string;
      recessionMild: string;
      techSelloff20Pct: string;
    };
  };
  evidenceSources: EvidenceSource[];
  secCik?: string;
  isSecGrounded?: boolean;
  retrievedAt?: string;
  realFinancialFacts?: FinancialFact[];
  recentFilings?: FilingRecord[];
}

export interface Holding {
  ticker: string;
  securityId?: string;
  market?: MarketRegion;
  exchange?: string;
  currency?: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  weightPct: number;
  totalReturnDollars: number;
  totalReturnPct: number;
  todayChangeDollars: number;
  todayChangePct: number;
  riskContributionPct: number;
  thesisStatus: ThesisStatus;
  sector: string;
}

export interface PortfolioData {
  nav: number;
  todayChange: number;
  todayChangePct: number;
  unrealizedReturn: number;
  unrealizedReturnPct: number;
  riskScore: number; // 0 - 100 (64 Moderate-Aggressive)
  riskLabel: string;
  diversificationScore: number; // 0 - 100 (78 Strong)
  diversificationLabel: string;
  baseCurrency?: string; // Default: 'USD'
  inrHoldings?: Holding[]; // Segregated INR positions (never combined into fake USD NAV)
  inrSummary?: {
    totalValue: number;
    totalCost: number;
    totalValueInr?: number;
    unrealizedReturnInr?: number;
    unrealizedReturnPct?: number;
    currency: 'INR';
    positionsCount: number;
  };
  metrics?: PortfolioMetrics;
  assetAllocation: {
    equitiesPct: number;
    fixedIncomePct: number;
    cashPct: number;
    alternativesPct: number;
  };
  sectorAllocation: { sector: string; percentage: number; color: string }[];
  geographicExposure: { region: string; percentage: number }[];
  holdings: Holding[];
  aiBriefing: {
    headline: string;
    aiAnalysis: string;
    calculationFact: string;
    riskObservation: string;
    uncertaintyNotice: string;
  };
}

export interface StrategyRule {
  category: 'Universe' | 'Entry Rule' | 'Exit Rule' | 'Position Sizing' | 'Rebalancing';
  description: string;
  parameters: string;
}

export interface BacktestTrade {
  id: string;
  tradeId?: string;
  backtestId?: string;
  securityId?: string;
  symbol?: string;
  ticker: string;
  date: string;
  timestamp?: string;
  signalTimestamp?: string;
  action: 'BUY' | 'SELL';
  side?: 'BUY' | 'SELL';
  shares: number;
  quantity?: number;
  price: number;
  requestedPrice?: number;
  executionPrice?: number;
  grossValue?: number;
  slippage?: number;
  transactionCost?: number;
  netValue?: number;
  signalId?: string;
  strategyId?: string;
  strategyVersion?: string;
  executionModel?: string;
  provenance?: PointInTimeProvenance;
  realizedPnL?: number;
  returnPct?: number;
  rationale?: string;
  holdingPeriodBars?: number;
}

export interface EquityPoint {
  timestamp?: string;
  date: string;
  cash?: number;
  positionsValue?: number;
  totalEquity?: number;
  equity?: number;
  strategy?: number;
  benchmark?: number;
  drawdown?: number;
  drawdownPct?: number;
}

export interface SimulatedPosition {
  securityId?: string;
  symbol: string;
  quantity: number;
  averageEntryPrice?: number;
  entryPrice?: number;
  currentPrice: number;
  marketValue: number;
  realizedPnL?: number;
  unrealizedPnL: number;
  unrealizedPnLPct?: number;
  weight?: number;
  weightPct?: number;
  currency: string;
}

export interface PerformanceAnalytics {
  totalReturn: number;
  totalReturnPct: number;
  cagr: number | null;
  annualizedVol: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxDrawdownDetails: {
    maxDrawdown: number;
    maxDrawdownPct: number;
    peakDate?: string;
    troughDate?: string;
    recoveryDate?: string;
    durationDays?: number;
  };
  drawdownSeries: DrawdownPoint[];
  periodReturns: number[];
  dailyReturnsCount: number;
  bestDayPct: number;
  worstDayPct: number;
  positiveDaysCount: number;
  negativeDaysCount: number;
  downsideDeviation: number;
}

export interface BacktestResult {
  id?: string;
  backtestId?: string;
  strategyId?: string;
  strategyTitle?: string;
  strategyVersion?: string;
  configuration?: BacktestConfiguration;
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'BLOCKED' | 'FAILED';
  dataStatus?: 'REAL' | 'SIMULATED' | 'UNAVAILABLE';
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  finalEquity?: number;
  period?: string;
  universe?: string;
  sizing?: string;
  rebalanceFrequency?: string;
  totalReturn: number;
  totalReturnPct?: number;
  cagr: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  annualizedVol: number;
  winRate: number;
  profitFactor?: number;
  totalTrades?: number;
  tradesCount: number;
  benchmarkTotalReturn: number;
  equityCurve: EquityPoint[];
  trades?: BacktestTrade[];
  tradeLog?: BacktestTrade[];
  positions?: SimulatedPosition[];
  monthlyReturns?: {
    year: number;
    months: number[];
    ytd: number;
  }[];
  warnings?: {
    overfittingRisk?: string;
    lookAheadBias?: string;
    survivorshipBias?: string;
    transactionCostImpact?: string;
    [key: string]: string | undefined;
  } | string[];
  dataQuality?: DataQualityStatus;
  provenance?: PointInTimeProvenance;
  epistemicStatus?: EpistemicStatus;
  totalRealizedPnL?: number;
  totalUnrealizedPnL?: number;
  totalTransactionCosts?: number;
  totalSlippageCost?: number;
  isAnalyticalOnly?: boolean;
  executionProhibited?: boolean;
  // Phase 12B Analytics extensions
  perfAnalytics?: PerformanceAnalytics;
  drawdownSeries?: DrawdownPoint[];
  maxDrawdownDetails?: {
    maxDrawdown: number;
    maxDrawdownPct: number;
    peakDate?: string;
    troughDate?: string;
    recoveryDate?: string;
    durationDays?: number;
  };
  tradeStatistics?: TradeStatistics;
  turnover?: TurnoverMetrics;
  exposureSeries?: ExposurePoint[];
  concentrationMetrics?: BacktestConcentrationMetrics;
  benchmarkResults?: BenchmarkComparisonResult;
  attribution?: SecurityAttribution[];
  limitations?: BacktestLimitations;
  report?: BacktestReport;
}

export interface DrawdownPoint {
  timestamp: string;
  equity: number;
  runningPeak: number;
  drawdown: number;
  drawdownPct: number;
}

export interface TradeStatistics {
  totalTrades: number;
  closedTrades: number;
  openPositions: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number; // percentage 0 - 100
  lossRate: number;
  profitFactor: number | null; // null if gross losses === 0 or no losing trades
  averageWinningTrade: number;
  averageLosingTrade: number;
  winLossRatio: number | null;
  largestWin: number;
  largestLoss: number;
  averageHoldingPeriodBars: number;
  averageHoldingPeriodDays: number;
  grossProfits: number;
  grossLosses: number;
}

export interface TurnoverMetrics {
  grossTurnover: number; // total notional / initial capital
  annualizedTurnover: number;
  totalNotionalTraded: number;
  averageTradeSize: number;
}

export interface ExposurePoint {
  timestamp: string;
  grossExposure: number;
  netExposure: number;
  cashPercentage: number;
  investedPercentage: number;
  largestPositionPct: number;
  largestPositionSymbol: string;
  positionsCount: number;
}

export interface BacktestConcentrationMetrics {
  largestPositionWeight: number;
  largestPositionSymbol: string;
  top3Concentration: number;
  top5Concentration: number;
  herfindahlIndex: number;
  sectorConcentration: { sector: string; weightPct: number }[];
  marketConcentration: { market: MarketRegion; weightPct: number }[];
  maxSinglePositionPct?: number;
  top5ConcentrationPct?: number;
}

export interface BenchmarkComparisonResult {
  benchmarkSymbol: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'CALCULATED';
  benchmarkTotalReturn: number;
  strategyTotalReturn: number;
  excessReturn: number;
  annualizedBenchmarkReturn: number | null;
  annualizedExcessReturn: number | null;
  beta: number | null;
  correlation: number | null;
  trackingError: number | null;
  informationRatio: number | null;
  notes?: string;
  epistemicStatus?: EpistemicStatus;
}

export interface SecurityAttribution {
  securityId: string;
  symbol: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  pnlContributionPct: number;
  totalTrades: number;
  currency: string;
}

export interface BacktestLimitations {
  survivorshipBiasRisk: 'SURVIVORSHIP_BIAS_POSSIBLE' | 'CONTROLLED';
  delistingDataStatus: 'DELISTING_DATA_UNAVAILABLE' | 'DELISTING_ACCOUNTED';
  corporateActionsAdjustment: 'ADJUSTED' | 'UNADJUSTED';
  lookAheadBiasProtection: 'STRICT_POINT_IN_TIME';
  executionModelDescription: string;
  epistemicDisclaimer: string;
}

export interface BacktestReport {
  executiveSummary: {
    strategyName: string;
    strategyId: string;
    backtestId: string;
    period: string;
    totalReturnPct: number;
    cagr: number | null;
    sharpeRatio: number | null;
    maxDrawdownPct: number;
    winRate: number;
    profitFactor: number | null;
    finalEquity: number;
    initialCapital: number;
  };
  performance: {
    totalReturn: number;
    totalReturnPct: number;
    cagr: number | null;
    periodReturnsCount: number;
    bestDayPct: number;
    worstDayPct: number;
    positiveDaysCount: number;
    negativeDaysCount: number;
  };
  risk: {
    annualizedVolatility: number;
    sharpeRatio: number | null;
    sortinoRatio: number | null;
    maxDrawdown: number;
    maxDrawdownDetails: {
      maxDrawdownPct: number;
      peakDate?: string;
      troughDate?: string;
      recoveryDate?: string;
      durationDays?: number;
    };
    downsideDeviation: number;
  };
  trading: TradeStatistics & TurnoverMetrics;
  exposure: {
    averageInvestedPct: number;
    maxInvestedPct: number;
    averageCashPct: number;
    maxCashPct: number;
    peakPositionsCount: number;
  };
  benchmark: BenchmarkComparisonResult | null;
  dataQuality: {
    provider: string;
    market: MarketRegion;
    exchange: string;
    currency: string;
    startDate: string;
    endDate: string;
    totalBars: number;
    missingBars: number;
    corporateActionsAdjusted: boolean;
    dataStatus: 'REAL' | 'SIMULATED' | 'UNAVAILABLE';
    epistemicStatus: EpistemicStatus;
  };
  provenance: PointInTimeProvenance;
  warnings: string[];
  limitations: BacktestLimitations;
}

export interface Strategy {
  id: string;
  title: string;
  description: string;
  prompt: string;
  status: 'AI Generated Strategy' | 'Backtest Verified Strategy';
  targetUniverse: string;
  rebalanceFrequency: string;
  positionSizing?: string;
  exitRules?: string;
  rules: StrategyRule[];
  lastRun?: string;
  backtestId?: string;
  quickMetrics?: {
    cagr?: string;
    sharpe?: string;
    maxDd?: string;
  };
  backtestResult?: BacktestResult;
}

export interface HoldingPosition {
  ticker: string; // backwards compatible symbol key
  shares: number; // shares count
  avgCost: number; // average cost per share
  name?: string;
  sector?: string;
  isCashEquivalent?: boolean;

  // Canonical Multi-Market additions
  securityId?: string;
  quantity?: number; // alias for shares
  averageCost?: number; // alias for avgCost
  currency?: string; // 'USD' | 'INR'
  market?: MarketRegion; // 'US' | 'INDIA' | 'GLOBAL'
  exchange?: string;
}

export interface WatchlistItem {
  ticker: string;
  thesisStatus?: ThesisStatus;
  alertThreshold?: string;
}

export type CanonicalSecurity = SecurityIdentifier & Partial<Stock> & {
  canonicalId?: string;
  ticker?: string;
};

export interface AppState {
  securities: Record<string, Stock>;
  portfolio: PortfolioData;
  watchlist: string[];
  alerts: AlertItem[];
  strategies: Strategy[];
  backtests: Record<string, BacktestResult>;
  researchQueries: ResearchQueryItem[];
}

export interface AlertItem {
  id: string;
  type: 'portfolio' | 'company' | 'earnings' | 'news' | 'risk' | 'thesis' | string;
  ticker?: string;
  companyName?: string;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  recommendedAction?: string;
  evidence: {
    source: string;
    filingDate: string;
    confidence: number;
  };
  timestamp: string;
  read?: boolean;
  isRead?: boolean;
  severity: 'critical' | 'warning' | 'info' | 'HIGH' | 'MEDIUM' | 'INFO' | string;
  provenanceType: ProvenanceTag;
}

export interface ResearchQueryItem {
  id: string;
  query: string;
  date: string;
  ticker?: string;
  answerSummary: string;
  groundedFacts: { statement: string; tag: ProvenanceTag; sourceIndex: number }[];
  sources: {
    id: string;
    name: string;
    docType: string;
    date: string;
    excerpt: string;
    confidence: number;
  }[];
}

export type ActiveScreen =
  | 'dashboard'
  | 'discover'
  | 'deep-dive'
  | 'portfolio'
  | 'strategies'
  | 'backtesting'
  | 'watchlist'
  | 'alerts'
  | 'research';

export type EpistemicCategory = 'REAL' | 'CALCULATED' | 'SIMULATED' | 'AI_GENERATED';

export interface FinancialFact {
  ticker: string;
  metric: string;
  label: string;
  value: number;
  unit: string;
  periodStart?: string;
  periodEnd?: string;
  filedDate?: string;
  fiscalYear?: number | string;
  fiscalPeriod?: string;
  form?: string;
  accessionNumber?: string;
  primaryDocument?: string;
  sourceUrl?: string;
  source: string;
  sourceType: 'SEC_XBRL' | 'SEC_SUBMISSION' | 'CALCULATED' | 'SIMULATED';
  asOf: string;
  retrievedAt: string;
  isSimulated: boolean;
  epistemicCategory: EpistemicCategory;
  status: 'available' | 'unavailable';
  reason?: string;
}

export interface FilingRecord {
  ticker: string;
  form: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  sourceUrl: string;
  description?: string;
  isSimulated: boolean;
  retrievedAt: string;
}

export type EpistemicStatus = 'REAL' | 'CALCULATED' | 'SIMULATED' | 'UNAVAILABLE';

export interface NormalizedQuote {
  ticker: string; // for backwards compatibility
  symbol: string;
  securityId: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: string;
  marketCap?: string;
  currency: string;
  market: MarketRegion;
  exchange: string;
  asOf: string;
  retrievedAt: string;
  provider: string;
  isSimulated: boolean;
  epistemicCategory: EpistemicCategory;
  epistemicStatus: EpistemicStatus;
  status: 'available' | 'unavailable';
  reason?: string;
}

export interface ProviderHealth {
  name: string;
  status:
    | 'Connected'
    | 'Throttled'
    | 'Error'
    | 'Unavailable'
    | 'Simulated'
    | 'UNCONFIGURED'
    | 'AUTHENTICATION_REQUIRED'
    | 'RATE_LIMITED'
    | 'CONNECTED'
    | 'ERROR'
    | 'UNAVAILABLE';
  lastSuccessfulRetrieval: string | null;
  dataFreshness: string;
  details?: string;
  isSimulated: boolean;
  provider?: string;
  market?: MarketRegion;
  checkedAt?: string;
  lastErrorCategory?: string | null;
  lastSuccessfulRequest?: string | null;
}

export interface DataSourcesHealth {
  secEdgar: ProviderHealth;
  marketData: ProviderHealth;
  usMarketData?: ProviderHealth;
  indiaMarketData?: ProviderHealth;
  fyersMarketData?: ProviderHealth;
  trueDataMarketData?: ProviderHealth;
}

// ==========================================
// MARKET PROVIDER & ROUTING INTERFACES
// ==========================================

export interface MarketDataRequest {
  securityId?: string;
  symbol: string;
  market?: MarketRegion;
  exchange?: SupportedExchange;
  currency?: string;
  provider?: string;
}

export interface MarketStatusRequest {
  market: MarketRegion;
  exchange?: string;
}

export interface MarketStatusResponse {
  market: MarketRegion;
  exchange: string;
  isOpen: boolean;
  timezone: string;
  session: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED';
  status: 'CONNECTED' | 'SIMULATED' | 'UNCONFIGURED' | 'ERROR';
  retrievedAt?: string;
  provider?: string;
  epistemicStatus?: EpistemicStatus;
  isSimulated?: boolean;
}

// ==========================================
// HISTORICAL OHLCV MARKET DATA CONTRACT
// ==========================================

export interface HistoricalPriceBar {
  timestamp: string; // ISO-8601 or YYYY-MM-DD trading date
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose?: number;
  volume: number;
  currency?: string;
  securityId?: string;
  market?: MarketRegion;
  exchange?: string;
  provider?: string;
  epistemicStatus: EpistemicStatus;
  isSimulated?: boolean;
  corporateActionsAdjusted?: boolean;
  provenance?: PointInTimeProvenance;
}

export interface HistoricalPricesRequest {
  securityId?: string;
  symbol: string;
  market?: MarketRegion;
  exchange?: string;
  currency?: string;
  period?: '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y' | 'MAX';
  interval?: '1m' | '5m' | '15m' | '1h' | '1d' | '1wk' | '1mo';
  startDate?: string;
  endDate?: string;
}

export interface HistoricalPricesResponse {
  securityId: string;
  symbol: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
  interval?: string;
  bars: HistoricalPriceBar[];
  provider: string;
  retrievedAt?: string;
  epistemicStatus: EpistemicStatus;
  isSimulated: boolean;
  status: 'available' | 'unavailable';
  reason?: string;
}

// Legacy point representation kept for backward compatibility with existing components
export interface HistoricalPricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  currency: string;
  isSimulated: boolean;
}

// ==========================================
// CORPORATE ACTION CONTRACTS (PHASE 5A PREP)
// ==========================================

export type CorporateActionType =
  | 'STOCK_SPLIT'
  | 'DIVIDEND_CASH'
  | 'DIVIDEND_STOCK'
  | 'BONUS_ISSUE'
  | 'RIGHTS_ISSUE'
  | 'SPINOFF'
  | 'MERGER_ACQUISITION'
  | 'SYMBOL_CHANGE';

export interface BaseCorporateAction {
  id: string;
  securityId: string;
  symbol: string;
  market: MarketRegion;
  exchange: string;
  actionType: CorporateActionType;
  exDate: string; // YYYY-MM-DD
  recordDate?: string;
  effectiveDate: string;
  announcementDate?: string;
  currency?: string;
  description: string;
  epistemicStatus: EpistemicStatus;
  provider: string;
  verified: boolean;
  notes?: string;
}

export interface StockSplitAction extends BaseCorporateAction {
  actionType: 'STOCK_SPLIT';
  splitRatio: {
    numerator: number; // e.g. 10 for 10:1 split
    denominator: number; // e.g. 1
  };
}

export interface DividendAction extends BaseCorporateAction {
  actionType: 'DIVIDEND_CASH' | 'DIVIDEND_STOCK';
  dividendType?: 'REGULAR' | 'SPECIAL' | 'INTERIM' | 'FINAL';
  amountPerShare: number;
  currency: string;
}

export interface BonusIssueAction extends BaseCorporateAction {
  actionType: 'BONUS_ISSUE';
  bonusRatio: {
    bonusShares: number; // e.g. 1
    existingShares: number; // e.g. 1 (common on NSE/BSE)
  };
}

export interface RightsIssueAction extends BaseCorporateAction {
  actionType: 'RIGHTS_ISSUE';
  rightsRatio: {
    rightsShares: number;
    existingShares: number;
  };
  issuePrice: number;
  currency: string;
}

export interface MergerAction extends BaseCorporateAction {
  actionType: 'MERGER_ACQUISITION';
  acquirerSecurityId?: string;
  acquirerSymbol?: string;
  cashPerShare?: number;
  stockRatio?: {
    newShares: number;
    oldShares: number;
  };
}

export type CorporateAction =
  | StockSplitAction
  | DividendAction
  | BonusIssueAction
  | RightsIssueAction
  | MergerAction
  | BaseCorporateAction;

export interface CorporateActionsRequest {
  securityId?: string;
  symbol: string;
  market?: MarketRegion;
  startDate?: string;
  endDate?: string;
  actionTypes?: CorporateActionType[];
}

export interface CorporateActionsResponse {
  securityId: string;
  symbol: string;
  market: MarketRegion;
  actions: CorporateAction[];
  epistemicStatus: EpistemicStatus;
  provider: string;
  status: 'available' | 'unavailable';
  reason?: string;
}

export interface CorporateActionsProvider {
  getCorporateActions(request: CorporateActionsRequest): Promise<CorporateActionsResponse>;
}

// ==========================================
// POINT-IN-TIME DATA PROVENANCE (LOOK-AHEAD BIAS PREVENTION)
// ==========================================

export interface PointInTimeProvenance {
  dataTimestamp?: string; // Event date / market session time
  availableAt?: string; // Exact point-in-time publication / public dissemination date
  retrievedAt?: string; // System retrieval timestamp
  provider: string; // Source system / repository
  source?: string; // Specific source record (e.g. SEC accession number, exchange feed)
  epistemicStatus?: EpistemicStatus;
  isRestatement?: boolean;
  restatementDate?: string;
  notes?: string;
  asOf?: string;
  asOfDate?: string;
  sourceCount?: number;
  dataFrequency?: string;
  splitAdjusted?: boolean;
  dividendAdjusted?: boolean;
  lookAheadBiasChecked?: boolean;
  provenanceTag?: string;
  isSimulated?: boolean;
  pointInTimeStrict?: boolean;
  hasLookAheadBias?: boolean;
  sourceType?: string;
}

export interface PointInTimePriceBar extends HistoricalPriceBar {
  availableAt: string;
}

export interface PointInTimeFundamentalData {
  securityId: string;
  symbol: string;
  market: MarketRegion;
  periodEnd: string;
  filingDate: string;
  acceptanceDateTime: string; // Prevents look-ahead bias in backtests
  accessionNumber: string;
  facts: Record<string, number>;
  provenance: PointInTimeProvenance;
}

// ==========================================
// QUANTITATIVE STRATEGY ENGINE CONTRACTS (PHASE 5A PREP)
// ==========================================

export type StrategyFrequency = 'TICK' | 'MINUTE' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface IndicatorDefinition {
  id: string;
  name: string; // e.g., 'SMA', 'EMA', 'RSI', 'MACD', 'ROIC_RANK', 'FCF_YIELD', 'VOLATILITY'
  type: 'TECHNICAL' | 'FUNDAMENTAL' | 'COMPOSITE' | 'FACTOR';
  parameters: Record<string, number | string | boolean>;
  timeframe?: string;
  lookbackPeriods?: number;
}

export interface QuantStrategyRule {
  id: string;
  category: 'UNIVERSE' | 'ENTRY' | 'EXIT' | 'POSITION_SIZING' | 'REBALANCE' | 'RISK';
  name: string;
  condition: string; // e.g. "ROIC > 20% AND RSI(14) < 40"
  indicatorRefs?: string[];
  threshold?: number | string;
  operator?: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';
  action?: 'BUY' | 'SELL' | 'HOLD' | 'REDUCE' | 'CLOSE';
  priority?: number;
  weight?: number;
}

export interface PositionSizingRule {
  method:
    | 'EQUAL_WEIGHT'
    | 'VOLATILITY_WEIGHTED'
    | 'RISK_PARITY'
    | 'MARKET_CAP_WEIGHTED'
    | 'FACTOR_WEIGHTED'
    | 'FIXED_PERCENT'
    | 'KELLY_CRITERION';
  targetWeightPct?: number; // e.g. 5%
  targetPositionPct?: number; // Alias for targetWeightPct
  maxPositionWeightPct: number; // e.g. 10%
  minPositionWeightPct: number; // e.g. 1%
  cashReservePct?: number; // e.g. 5%
  parameters?: Record<string, unknown>;
}

export interface QuantitativeRiskConstraints {
  maxPositionWeightPct: number; // e.g. 10%
  maxPositionWeight?: number; // Alias for maxPositionWeightPct
  maxSectorWeightPct: number; // e.g. 25%
  maxSectorWeight?: number; // Alias for maxSectorWeightPct
  maxMarketWeightPct?: number;
  maxMarketWeight?: number;
  maxPortfolioExposurePct?: number;
  maxPortfolioExposure?: number;
  maxPositionCount?: number;
  maxPortfolioDrawdownPct?: number; // e.g. 15% circuit breaker
  maxAnnualizedVolatilityPct?: number; // e.g. 20%
  maxTurnoverPctAnnual?: number; // e.g. 200%
  minDailyLiquidityUSD?: number; // e.g. $5,000,000 ADTV
  minDailyLiquidityINR?: number; // e.g. ₹50,000,000 ADTV
  stopLossPct?: number; // e.g. 8% stop
  takeProfitPct?: number;
  maxLeverageRatio?: number; // default 1.0 (no leverage)
}

export interface PortfolioConstructionRule {
  maxHoldings?: number;
  minHoldings?: number;
  rebalanceFrequency: StrategyFrequency;
  rebalanceSchedule?: string; // e.g. 'FIRST_TRADING_DAY_OF_MONTH'
  allowShorting?: boolean;
  benchmarkSecurityId?: string; // 'us-spy' or 'in-nifty50'
  multiMarketPolicy?: 'SEPARATE_LEDGERS' | 'CROSS_MARKET'; // Strictly segregates USD & INR
  weightingScheme?: string;
}

export type ExecutionTimingModel = 
  | 'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN' 
  | 'SAME_BAR_CLOSE';

export interface TransactionCostConfig {
  type: 'PERCENT' | 'BPS' | 'FIXED';
  rate: number; // e.g. 0.0005 for 0.05%
  fixedPerTrade?: number; // e.g. 1.00 USD or 20.00 INR
  minCost?: number;
  currency?: string;
}

export interface SlippageConfig {
  type: 'PERCENT' | 'BPS';
  rate: number; // e.g. 0.0005 for 0.05%
}

export interface BacktestConfiguration {
  id?: string;
  backtestId?: string;
  strategyId: string;
  strategyVersion?: string;
  securityIds?: string[];
  symbols?: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  currency: string; // 'USD' | 'INR'
  baseCurrency?: string; // alias
  dataFrequency?: StrategyFrequency | string;
  executionTiming?: ExecutionTimingModel;
  rebalanceFrequency?: StrategyFrequency;
  riskConstraints?: QuantitativeRiskConstraints;
  positionSizing?: PositionSizingRule;
  transactionCost?: TransactionCostConfig;
  commissionPerTrade?: number;
  slippage?: SlippageConfig;
  slippageBps?: number;
  benchmarkSymbol?: string;
  benchmarkSecurityId?: string;
  corporateActionAdjustment?: 'ADJUSTED' | 'UNADJUSTED';
  includeCorporateActions?: boolean;
  isSimulatedBaseline?: boolean;
  allowShorting?: boolean;
}

export interface QuantStrategy {
  strategyId: string;
  name: string;
  version?: string; // Phase 11 strategy versioning (e.g., 'v1.0.0')
  description: string;
  universe: {
    markets: MarketRegion[];
    exchanges?: string[];
    sectors?: string[];
    minMarketCap?: number;
  };
  frequency: StrategyFrequency;
  indicators: IndicatorDefinition[];
  entryRules: QuantStrategyRule[];
  exitRules: QuantStrategyRule[];
  parameters?: Record<string, number | string | boolean>;
  positionSizing: PositionSizingRule;
  riskConstraints: QuantitativeRiskConstraints;
  portfolioConstruction: PortfolioConstructionRule;
  rebalanceSchedule: string;
  isDeterministic: boolean;
  backtestId?: string;
}

// ==========================================
// ANALYTICAL SIGNAL MODEL (STRICT GUARDRAILS: NO BROKER EXECUTION)
// ==========================================

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD' | 'NO_SIGNAL';
export type SignalType = 'ENTRY' | 'EXIT' | 'REBALANCE' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'RISK_OFF' | 'HOLD';

export interface AnalyticalSignal {
  id: string;
  securityId: string;
  symbol: string;
  market: MarketRegion;
  exchange: string;
  timestamp: string; // ISO format
  signalType: SignalType;
  direction: SignalDirection;
  strength: number; // 0.0 to 1.0
  targetWeight?: number;
  priceAtSignal?: number;
  currency?: string;
  reason: string;
  strategyId: string;
  strategyName?: string;
  ruleId?: string;
  provenance: PointInTimeProvenance;
  // Strict non-execution guardrails
  isAnalyticalOnly: true; // Explicit confirmation that this is strictly an analytical signal
  executionProhibited: true; // Hardcoded guardrail prohibiting automated broker order execution
}

// ==========================================
// FUNDAMENTAL + QUANTITATIVE COMBINATION ARCHITECTURE
// ==========================================

export interface FundamentalMetricsSummary {
  revenueGrowthYoY?: number;
  grossMarginPct?: number;
  operatingMarginPct?: number;
  roic?: number;
  fcfYield?: number;
  peRatio?: number;
  debtToEquity?: number;
  thesisStatus?: ThesisStatus;
  secGrounded: boolean;
}

export interface QuantFactorProfile {
  momentumScore: number;
  volatilityScore: number;
  trendStrength: number;
  relativeStrengthRank: number;
  betaToBenchmark?: number;
  sharpeContribution?: number;
}

export interface CompositeAssetEvaluation {
  securityId: string;
  symbol: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
  fundamental: FundamentalMetricsSummary;
  quantitative: QuantFactorProfile;
  compositeScore: number;
  signals: AnalyticalSignal[];
  evaluatedAt: string;
  provenance: {
    fundamentalSource: string;
    marketDataSource: string;
    isSimulated: boolean;
    epistemicStatus: EpistemicStatus;
  };
}

// ==========================================
// FUTURE INDIA FUNDAMENTALS (EXTENSION POINTS - PHASE 5 PREP)
// ==========================================

export interface IndiaCorporateFiling {
  companyName: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  category: 'Financial Result' | 'Corporate Action' | 'Shareholding Pattern' | 'Annual Report' | 'Board Meeting' | string;
  announcementDate: string;
  subject: string;
  attachmentUrl?: string;
}

export interface IndiaQuarterlyResult {
  symbol: string;
  exchange: 'NSE' | 'BSE';
  quarterEnded: string;
  fiscalYear: string;
  fiscalQuarter: string;
  totalIncome?: number;
  netProfit?: number;
  eps?: number;
  ebitda?: number;
  isAudited: boolean;
}

export interface IndiaFundamentalsProvider {
  getQuarterlyResults?(symbol: string, exchange?: string): Promise<IndiaQuarterlyResult[]>;
  getFilings?(symbol: string, exchange?: string): Promise<IndiaCorporateFiling[]>;
  getShareholdingPattern?(symbol: string): Promise<Record<string, unknown>>;
  getHealthStatus(): ProviderHealth;
}

// ==========================================
// SEARCH & TICKER INTELLIGENCE TYPES (PHASE 6)
// ==========================================

export type SearchIntent =
  | 'SECURITY_LOOKUP'
  | 'RESEARCH_QUERY'
  | 'NAVIGATION'
  | 'UNKNOWN';

export type SearchMatchType =
  | 'EXACT_TICKER'
  | 'EXACT_CANONICAL_SYMBOL'
  | 'EXACT_COMPANY_NAME'
  | 'EXCHANGE_QUALIFIED'
  | 'PREFIX'
  | 'ALIAS'
  | 'FUZZY';

export interface SearchSecurityMatch {
  security: SecurityIdentifier;
  matchType: SearchMatchType;
  score: number;
  exchange: string;
  market: MarketRegion;
  currency: string;
}

export interface SearchResult {
  query: string;
  intent: SearchIntent;
  securities: SecurityIdentifier[];
  navigationTarget?: ActiveScreen;
  confidence: number;
  matches: SearchSecurityMatch[];
  message?: string;
}

// ==========================================
// RESEARCH & ANALYSIS ENGINE TYPES (PHASE 7A)
// ==========================================

export type ResearchAnalysisType =
  | 'GENERAL_ANALYSIS'
  | 'WHY_MOVED'
  | 'COMPANY_ANALYSIS'
  | 'COMPARISON'
  | 'FUNDAMENTALS'
  | 'FUNDAMENTAL_ANALYSIS'
  | 'RISK'
  | 'RISK_ANALYSIS'
  | 'PORTFOLIO_CONTEXT'
  | 'INVESTMENT_THESIS'
  | 'VALUATION'
  | 'GROWTH'
  | 'CATALYSTS'
  | 'COMPETITIVE_POSITION'
  | 'MANAGEMENT'
  | 'EARNINGS'
  | 'RECENT_CHANGES'
  | 'BULL_CASE'
  | 'BEAR_CASE'
  | 'PORTFOLIO_IMPACT'
  | 'QUANT_SIGNAL_EXPLANATION'
  | 'CUSTOM';

export type ResearchEpistemicClassification =
  | 'FACT'
  | 'INFERENCE'
  | 'UNCERTAINTY'
  | 'SIMULATED'
  | 'UNAVAILABLE';

export interface ResearchEvidenceItem {
  id: string;
  securityId?: string;
  symbol?: string;
  sourceType: EvidenceSourceType;
  provider: string;
  epistemicStatus: EvidenceEpistemicStatus;
  isSimulated?: boolean;
  retrievedAt: string;
  description: string;
  filingDate?: string;
  accessionNumber?: string;
  data: Record<string, unknown> | null;
}

export interface ResearchSectionPoint {
  text: string;
  classification: ResearchEpistemicClassification;
  evidenceIds: string[];
}

export interface ResearchSection {
  heading: string;
  points: ResearchSectionPoint[];
}

export interface ResearchEvidenceReference {
  id: string;
  sourceType: EvidenceSourceType;
  provider: string;
  epistemicStatus: EvidenceEpistemicStatus;
  description: string;
  filingDate?: string;
  accessionNumber?: string;
}

export interface ResearchResponse {
  title: string;
  executiveSummary: string;
  conclusion: string;
  analysisType: ResearchAnalysisType;
  sections: ResearchSection[];
  keyRisks: string[];
  keyUnknowns: string[];
  evidenceReferences: ResearchEvidenceReference[];
  confidence: number;
  generatedAt: string;
  engineVersion: string;
  securities: SecurityIdentifier[];
  retrievalMetadata?: {
    retrievalMode: RetrievalMode;
    totalCandidates: number;
    retrievedCount: number;
    topSources: string[];
    conflictsCount?: number;
  };
}

export interface ResearchPortfolioHoldingContext {
  securityId: string;
  symbol: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  weightPct: number;
  unrealizedPnL: number;
}

export interface ResearchRequest {
  query: string;
  securities: SecurityIdentifier[];
  requestedAnalysisType: ResearchAnalysisType;
  availableEvidence: ResearchEvidenceItem[];
  asOfDate?: string;
  researchAsOfDate?: string;
  context?: {
    portfolioContext?: {
      holdings?: ResearchPortfolioHoldingContext[];
      totalNav?: number;
    };
    watchlistContext?: string[];
    quantitativeContext?: {
      signal?: string;
      strategyName?: string;
      epistemicStatus?: EpistemicStatus;
      metrics?: Record<string, any>;
      backtestSummary?: string;
      isSimulated?: boolean;
    };
  };
  retrievalMetadata?: {
    retrievalMode: RetrievalMode;
    totalCandidates: number;
    retrievedCount: number;
    topSources: string[];
    conflictsCount?: number;
  };
  conflicts?: RetrievalConflict[];
}

// ==========================================
// PHASE 8A: EVIDENCE FOUNDATION & RETRIEVAL ARCHITECTURE
// ==========================================

export type EvidenceSourceType =
  | 'SEC_EDGAR'
  | 'OFFICIAL_FILINGS'
  | 'MARKET_DATA'
  | 'PORTFOLIO'
  | 'CANONICAL_METADATA'
  | 'RESEARCH_DOCUMENT'
  | 'QUANTITATIVE';

export type EvidenceEpistemicStatus =
  | 'REAL'
  | 'CALCULATED'
  | 'SIMULATED'
  | 'UNAVAILABLE'
  | 'ERROR';

export interface EvidenceSourceReference {
  url?: string;
  accessionNumber?: string;
  cik?: string;
  form?: string;
  concept?: string;
  exchange?: string;
  symbol?: string;
  calculationSource?: string;
  provider?: string;
  [key: string]: unknown;
}

export interface EvidenceItem {
  evidenceId: string;
  securityId?: string;
  sourceType: EvidenceSourceType;
  provider: string;
  documentId?: string;
  documentType?: string;
  title: string;
  content: string;
  structuredValue?: number | string | Record<string, unknown> | null;
  unit?: string;
  currency?: string;
  publishedAt: string; // ISO-8601 string, publication or filing availability date
  filingDate?: string;
  periodStart?: string;
  periodEnd?: string;
  retrievedAt: string;
  availableAt?: string;
  fingerprint?: string;
  conceptKey?: string;
  qualityScore?: number;
  epistemicStatus: EvidenceEpistemicStatus;
  isSimulated: boolean;
  sourceReference?: EvidenceSourceReference;
  metadata?: Record<string, unknown>;
  hasConflict?: boolean;
  conflictDetails?: string;
  ownerUserId?: string;
  userId?: string;
}

export interface EvidenceFilter {
  securityId?: string;
  symbol?: string;
  sourceType?: EvidenceSourceType | EvidenceSourceType[];
  provider?: string | string[];
  documentType?: string;
  epistemicStatus?: EvidenceEpistemicStatus | EvidenceEpistemicStatus[];
  startDate?: string | Date;
  endDate?: string | Date;
  asOfDate?: string | Date;
  concept?: string;
  limit?: number;
}

export interface IEvidenceRepository {
  addEvidence(item: EvidenceItem): boolean;
  addEvidenceBatch(items: EvidenceItem[]): number;
  getEvidence(evidenceId: string): EvidenceItem | undefined;
  getEvidenceBySecurity(securityId: string): EvidenceItem[];
  getEvidenceBySource(sourceType: EvidenceSourceType): EvidenceItem[];
  getEvidenceAvailableAsOf(asOfDate: string | Date, filter?: EvidenceFilter): EvidenceItem[];
  queryEvidence(filter: EvidenceFilter): EvidenceItem[];
  query?(filter: EvidenceFilter): EvidenceItem[];
  removeEvidence(evidenceId: string): boolean;
  getAll(): EvidenceItem[];
  count(): number;
  clear(): void;
}

export interface EvidenceGatherOptions {
  securityIds?: string[];
  securities?: SecurityIdentifier[];
  asOfDate?: string | Date;
  portfolioContext?: {
    holdings?: ResearchPortfolioHoldingContext[];
    totalNav?: number;
    metrics?: PortfolioMetrics;
  };
  filter?: EvidenceFilter;
}

// ==========================================
// PHASE 8B: SEMANTIC RETRIEVAL & RAG CONTRACTS
// ==========================================

export type RetrievalMode = 'SEMANTIC' | 'DETERMINISTIC_FALLBACK';

export interface EvidenceQuery {
  query?: string;
  securityId?: string;
  securityIds?: string[];
  market?: MarketRegion;
  exchange?: string;
  sourceType?: EvidenceSourceType | EvidenceSourceType[];
  documentType?: string;
  epistemicStatus?: EvidenceEpistemicStatus | EvidenceEpistemicStatus[];
  startDate?: string | Date;
  endDate?: string | Date;
  asOfDate?: string | Date;
  limit?: number;
  minRelevanceScore?: number;
  userId?: string;
}

export interface EvidenceChunk {
  chunkId: string;
  evidenceId: string;
  securityId?: string;
  sourceType: EvidenceSourceType;
  provider: string;
  documentId?: string;
  documentType?: string;
  title: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  publishedAt: string;
  filingDate?: string;
  periodEnd?: string;
  epistemicStatus: EvidenceEpistemicStatus;
  isSimulated: boolean;
  sourceReference?: EvidenceSourceReference;
  hasConflict?: boolean;
  conflictDetails?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceEmbedding {
  chunkIdOrEvidenceId: string;
  vector: number[];
  model: string;
  dimensions: number;
  generatedAt: string;
}

export interface MatchSignal {
  signal: string;
  weight: number;
  description: string;
}

export interface EvidenceMatch {
  evidence: EvidenceItem;
  chunk?: EvidenceChunk;
  score: number;
  semanticScore?: number;
  deterministicScore: number;
  matchSignals: MatchSignal[];
  retrievalReason: string;
}

export type RetrievalFilter = EvidenceFilter;

export interface EmbeddingStatus {
  configured: boolean;
  model: string;
  status: 'ACTIVE' | 'UNAVAILABLE' | 'FALLBACK';
  message?: string;
}

export interface RetrievalConflict {
  evidenceId1: string;
  evidenceId2: string;
  details: string;
  provider1: string;
  provider2: string;
}

export interface RetrievalTrace {
  normalizedQuery: string;
  detectedSecurities: string[];
  appliedFilters: Record<string, unknown>;
  asOfDate?: string;
  totalRepositoryItems: number;
  candidatesAfterMetadataFilter: number;
  candidatesAfterPointInTime: number;
  retrievalMode: RetrievalMode;
  scoringDetails: {
    evidenceId: string;
    title: string;
    score: number;
    signals: string[];
    epistemicStatus: EvidenceEpistemicStatus;
  }[];
  diversityApplied: boolean;
  executionTimeMs: number;
}

export interface RetrievalResult {
  query: string;
  retrievalMode: RetrievalMode;
  matches: EvidenceMatch[];
  evidenceBundle: EvidenceItem[];
  chunks: EvidenceChunk[];
  totalCandidates: number;
  retrievalTrace: RetrievalTrace;
  conflicts: RetrievalConflict[];
  embeddingStatus: EmbeddingStatus;
}

export interface IRetrievalEngine {
  retrieve(query: EvidenceQuery): Promise<RetrievalResult>;
  getEmbeddingStatus(): EmbeddingStatus;
}

// ==========================================
// PHASE 9 — PORTFOLIO INTELLIGENCE CONTRACTS
// ==========================================

export interface EpistemicValue<T> {
  value: T | null;
  status: EvidenceEpistemicStatus;
  methodology?: string;
  underlyingSources?: string[];
  isSimulated?: boolean;
  notes?: string;
}

export interface PortfolioHoldingAnalytics {
  securityId: string;
  symbol: string;
  name: string;
  sector: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
  shares: number;
  quantity: number;
  avgCost: number;
  averageCost: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  weight: number; // 0.0 to 1.0
  weightPct: number; // 0.0 to 100.0%
  unrealizedPnL: number;
  unrealizedReturnPct: number;
  dailyPriceChange: number;
  dailyPriceChangePct: number;
  dailyPnLContribution: number;
  dailyReturnContributionPct: number;
  beta: EpistemicValue<number>;
  volatility: EpistemicValue<number>;
  riskContributionPct: EpistemicValue<number>;
  marginalRiskContribution: EpistemicValue<number>;
  isCashEquivalent: boolean;
  epistemicStatus: EvidenceEpistemicStatus;
  isSimulated: boolean;
}

export interface ConcentrationMetrics {
  largestPosition: {
    symbol: string;
    securityId?: string;
    weightPct: number;
    marketValue: number;
    currency: string;
  };
  top1WeightPct: number;
  top5WeightPct: number;
  top10WeightPct: number;
  remainingWeightPct: number;
  herfindahlHirschmanIndex: number; // Standard scale 0 - 10,000 (sum of weightPct^2)
  hhiNormalized: number; // 0.0 to 1.0 (sum of weightFraction^2)
  concentrationClassification?: 'HIGHLY_CONCENTRATED' | 'MODERATELY_CONCENTRATED' | 'DIVERSIFIED';
  status: EvidenceEpistemicStatus;
  observations: string[];
}

export interface SectorExposure {
  sector: string;
  marketValue: number;
  weightPct: number;
  positionCount: number;
  dailyPnLContribution: number;
  color: string;
  status: EvidenceEpistemicStatus;
}

export interface MarketExposure {
  market: MarketRegion;
  marketValue: number;
  weightPct: number;
  positionCount: number;
  exchanges: string[];
  dailyPnLContribution: number;
  currency: string;
  status: EvidenceEpistemicStatus;
}

export interface CurrencyExposure {
  currency: string;
  marketValueNative: number;
  weightPct: number;
  positionCount: number;
  isBaseCurrency: boolean;
  fxRateToBase: EpistemicValue<number>;
  marketValueBaseEquivalent: EpistemicValue<number>;
}

export interface PortfolioAttributionItem {
  symbol: string;
  securityId?: string;
  dailyPriceChange: number;
  dailyPriceChangePct: number;
  positionMarketValue: number;
  dailyPnLContribution: number;
  dailyReturnContributionPct: number;
}

export interface PortfolioPerformanceAnalytics {
  dailyPnL: EpistemicValue<number>;
  dailyReturnPct: EpistemicValue<number>;
  unrealizedPnL: EpistemicValue<number>;
  unrealizedReturnPct: EpistemicValue<number>;
  return1D: EpistemicValue<number>;
  return1W: EpistemicValue<number>;
  return1M: EpistemicValue<number>;
  topPositiveContributors: PortfolioAttributionItem[];
  topNegativeContributors: PortfolioAttributionItem[];
}

export interface PortfolioRiskAnalytics {
  portfolioBeta: EpistemicValue<number>;
  portfolioVolatility: EpistemicValue<number>;
  covarianceMatrix: EpistemicValue<number[][]>;
  correlationMatrix: EpistemicValue<number[][]>;
  securitySymbols: string[];
  marginalContributionToRisk: EpistemicValue<Record<string, number>>;
  percentageContributionToRisk: EpistemicValue<Record<string, number>>;
  peakPortfolioValue: EpistemicValue<number>;
  currentDrawdown: EpistemicValue<number>;
  maxDrawdown: EpistemicValue<number>;
}

export interface PortfolioMetrics {
  portfolioId: string;
  asOfDate: string;
  baseCurrency: string;
  totalValue: number;
  investedValue: number;
  cashValue: number;
  positionCount: number;
  weightsReconciled: boolean;
  sumWeights: number;
  isCrossCurrencySegregated: boolean;
  positions: PortfolioHoldingAnalytics[];
  concentration: ConcentrationMetrics;
  sectorExposure: SectorExposure[];
  marketExposure: MarketExposure[];
  currencyExposure: CurrencyExposure[];
  performance: PortfolioPerformanceAnalytics;
  risk: PortfolioRiskAnalytics;
  segregatedBuckets?: Record<string, {
    currency: string;
    totalValueNative: number;
    totalCostNative: number;
    unrealizedPnLNative: number;
    positionsCount: number;
    positions: PortfolioHoldingAnalytics[];
  }>;
  epistemicStatus: EvidenceEpistemicStatus;
  isSimulated: boolean;
}

export type PortfolioQuestionIntent =
  | 'DRIVERS'
  | 'CONCENTRATION'
  | 'RISK'
  | 'SECTOR'
  | 'MARKET_REGION'
  | 'CURRENCY'
  | 'CHANGE'
  | 'PERFORMANCE'
  | 'DIVERSIFICATION'
  | 'GENERAL';

export interface PortfolioCalculationOptions {
  baseCurrency?: string;
  asOfDate?: string;
  portfolioId?: string;
}

export interface PortfolioAnalysisRequest {
  query: string;
  portfolioId?: string;
  asOfDate?: string;
  portfolioContext?: {
    holdings?: ResearchPortfolioHoldingContext[];
    totalNav?: number;
    metrics?: PortfolioMetrics;
  };
}

export interface PortfolioAnalysisResponse {
  query: string;
  intent: PortfolioQuestionIntent;
  deterministicFacts: {
    nav: number;
    baseCurrency: string;
    dailyPnL: number;
    dailyReturnPct: number;
    unrealizedPnL: number;
    topHoldings: { symbol: string; weightPct: number; pnl: number }[];
    exposures: {
      sectors: Record<string, number>;
      markets: Record<string, number>;
      currencies: Record<string, number>;
    };
    concentration: {
      top1WeightPct: number;
      top5WeightPct: number;
      hhi: number;
    };
    risk: {
      portfolioBeta: number | null;
      topRiskContributors: { symbol: string; riskPct: number }[];
    };
    attribution: {
      topGainers: string[];
      topLosers: string[];
    };
  };
  retrievedEvidence: ResearchEvidenceItem[];
  explanation: {
    headline: string;
    facts: string[];
    inferences: string[];
    uncertainties: string[];
    simulatedNotices: string[];
    unavailableNotices: string[];
    narrative: string;
  };
  causalityDisclaimer: string;
  timestamp: string;
}

// ==========================================
// PHASE 10 — WATCHLIST & ALERT INTELLIGENCE
// ==========================================

export type AlertRuleType =
  // Price rules
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PRICE_CROSSES_ABOVE'
  | 'PRICE_CROSSES_BELOW'
  // Percentage move rules
  | 'DAILY_CHANGE_ABOVE'
  | 'DAILY_CHANGE_BELOW'
  | 'DAILY_CHANGE_ABSOLUTE_ABOVE'
  // Volume rules
  | 'VOLUME_ABOVE'
  | 'VOLUME_MULTIPLE_OF_AVERAGE'
  // Daily range rules
  | 'DAILY_HIGH'
  | 'DAILY_LOW'
  // Portfolio rules (using Phase 9 analytics)
  | 'PORTFOLIO_DAILY_LOSS_ABOVE'
  | 'PORTFOLIO_DRAWDOWN_ABOVE'
  | 'POSITION_WEIGHT_ABOVE'
  | 'SECTOR_WEIGHT_ABOVE'
  | 'RISK_CONTRIBUTION_ABOVE'
  // Research & disclosure rules
  | 'NEW_SEC_FILING'
  | 'MATERIAL_FINANCIAL_CHANGE'
  | 'EVIDENCE_CONFLICT';

export type AlertPriority = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertComparison =
  | '>'
  | '>='
  | '<'
  | '<='
  | '=='
  | 'CROSSES_ABOVE'
  | 'CROSSES_BELOW'
  | 'CONTAINS';

export interface CanonicalWatchlistItem {
  watchlistItemId: string;
  securityId: string;
  symbol: string;
  companyName: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
  provider: string;
  addedAt: string;
  enabled: boolean;
  notes?: string;
  alertRuleIds: string[];
  ticker?: string; // backwards compatibility alias
}

export interface AlertRule {
  alertRuleId: string;
  securityId?: string; // Canonical security ID (e.g. 'us-nvda', 'in-reliance')
  portfolioId?: string; // For portfolio-level alerts
  symbol?: string;
  alertType: AlertRuleType;
  threshold: number | string;
  comparison: AlertComparison;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  cooldownMinutes: number; // e.g. 60
  lastTriggeredAt: string | null;
  lastObservedValue: number | string | null;
  previousObservedValue?: number | string | null;
  priority: AlertPriority;
  metadata?: Record<string, unknown>;
}

export interface AlertEvaluation {
  triggered: boolean;
  alertRuleId: string;
  securityId?: string;
  portfolioId?: string;
  symbol?: string;
  observedValue: number | string | null;
  threshold: number | string;
  comparison: string;
  evaluatedAt: string;
  epistemicStatus: 'REAL' | 'SIMULATED' | 'CALCULATED' | 'UNAVAILABLE' | 'STALE';
  isSimulated: boolean;
  provider: string;
  market?: string;
  exchange?: string;
  currency?: string;
  reason: string;
  fingerprint?: string;
  provenance: {
    retrievedAt: string;
    asOf?: string;
    sourceReference?: string;
    quoteTimestamp?: string;
  };
}

export interface AlertEvent {
  eventId: string;
  alertRuleId: string;
  securityId?: string;
  portfolioId?: string;
  symbol?: string;
  companyName?: string;
  alertType: AlertRuleType;
  priority: AlertPriority;
  observedValue: number | string;
  threshold: number | string;
  triggeredAt: string;
  epistemicStatus: 'REAL' | 'SIMULATED' | 'CALCULATED' | 'UNAVAILABLE';
  isSimulated: boolean;
  provider: string;
  market?: string;
  exchange?: string;
  currency?: string;
  reason: string;
  provenance: {
    retrievedAt: string;
    asOf?: string;
    sourceReference?: string;
    quoteTimestamp?: string;
  };
  contextualAnalysis?: string | null;
  contextualConfidence?: number;
  isRead: boolean;
  isAcknowledged: boolean;
  fingerprint: string;
}

export interface WatchlistAlertState {
  watchlist: CanonicalWatchlistItem[];
  rules: AlertRule[];
  events: AlertEvent[];
  lastEvaluatedAt: string | null;
}

// ==========================================
// PHASE 11: QUANTITATIVE STRATEGY ENGINE CONTRACTS
// ==========================================

export type DataQualityStatus = 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT' | 'INVALID';

export interface DataValidationResult {
  isValid: boolean;
  quality: DataQualityStatus;
  barCount: number;
  errors: string[];
  warnings: string[];
  chronological: boolean;
  hasDuplicates: boolean;
  hasMissingFields: boolean;
  startRange?: string;
  endRange?: string;
}

export type IndicatorType =
  | 'SMA'
  | 'EMA'
  | 'RSI'
  | 'MOMENTUM'
  | 'ROC'
  | 'VOLATILITY'
  | 'HIGHEST_HIGH'
  | 'LOWEST_LOW'
  | 'AVERAGE_VOLUME'
  | 'VOLUME_RATIO'
  | 'ATR'
  | 'CUSTOM';

export interface CalculatedIndicator {
  indicatorId: string;
  name: string;
  type: IndicatorType;
  parameters: Record<string, number | string | boolean>;
  timestamp: string; // Evaluation bar timestamp
  value: number | null; // null if insufficient data / unavailable
  previousValue?: number | null;
  history?: (number | null)[];
  dataWindow: {
    startTimestamp: string;
    endTimestamp: string;
    barCount: number;
    requiredBars: number;
  };
  sourceSecurity: {
    securityId: string;
    symbol: string;
    market: MarketRegion;
    exchange: string;
  };
  provider: string;
  epistemicStatus: EpistemicStatus;
  calculationMethod: string;
  version: string;
  status: 'VALID' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE' | 'INVALID_DATA';
  reason?: string;
}

export type RuleComparisonOperator =
  | 'GREATER_THAN'
  | '>'
  | 'GREATER_THAN_OR_EQUAL'
  | '>='
  | 'LESS_THAN'
  | '<'
  | 'LESS_THAN_OR_EQUAL'
  | '<='
  | 'EQUAL'
  | '=='
  | 'CROSS_ABOVE'
  | 'CROSS_BELOW';

export type RuleCombinator = 'AND' | 'OR' | 'NOT';

export interface RuleOperand {
  type: 'INDICATOR' | 'PRICE' | 'VOLUME' | 'CONSTANT' | 'CALCULATED_VALUE';
  reference?: string; // indicator ID or name
  field?: 'close' | 'open' | 'high' | 'low' | 'volume';
  value?: number; // constant threshold
}

export interface StructuredStrategyRule {
  id: string;
  category: 'ENTRY' | 'EXIT' | 'FILTER' | 'RISK' | 'REBALANCE';
  name: string;
  leftOperand: RuleOperand;
  operator: RuleComparisonOperator;
  rightOperand: RuleOperand;
  combinator?: RuleCombinator;
  subRules?: StructuredStrategyRule[];
  action?: 'BUY' | 'SELL' | 'HOLD';
  priority?: number;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  operator: RuleComparisonOperator;
  currentLeftValue: number | null;
  currentRightValue: number | null;
  previousLeftValue?: number | null;
  previousRightValue?: number | null;
  explanation: string;
}

export interface PositionSizingResult {
  method: PositionSizingRule['method'];
  rawWeightPct: number;
  boundedWeightPct: number;
  targetWeightPct: number; // post risk constraint adjustments
  shares?: number;
  capitalAllocation?: number;
  isConstrained: boolean;
  explanation: string;
}

export interface RiskConstraintEvaluationResult {
  constraintId: string;
  constraintType:
    | 'MAX_POSITION_WEIGHT'
    | 'MAX_SECTOR_WEIGHT'
    | 'MAX_MARKET_WEIGHT'
    | 'MAX_PORTFOLIO_EXPOSURE'
    | 'MAX_POSITION_COUNT'
    | 'STOP_LOSS'
    | 'TAKE_PROFIT';
  passed: boolean;
  observedValue: number;
  limit: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  explanation: string;
  adjustedWeightPct?: number;
}

export interface StrategyEvaluationOptions {
  strategyId?: string;
  strategy?: QuantStrategy;
  securityId?: string;
  symbol?: string;
  market?: MarketRegion;
  exchange?: string;
  currency?: string;
  bars?: HistoricalPriceBar[]; // Caller can supply bars directly (for testing / backtest replay)
  asOfDate?: string; // Point-in-time boundary: evaluate only data <= asOfDate
  parameters?: Record<string, number | string | boolean>; // Parameter overrides
  portfolioContext?: {
    totalPortfolioValue?: number;
    currentHoldings?: {
      securityId: string;
      symbol: string;
      weightPct: number;
      sector?: string;
      market?: MarketRegion;
    }[];
    cashReservePct?: number;
  };
  dryRun?: boolean;
}

export interface StrategyEvaluationResult {
  strategyId: string;
  strategyName: string;
  strategyVersion: string;
  securityId: string;
  symbol: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
  evaluatedAt: string;
  asOfDate: string;
  dataQuality: DataQualityStatus;
  dataValidation: DataValidationResult;
  indicators: Record<string, CalculatedIndicator>;
  ruleEvaluations: RuleEvaluationResult[];
  signal: AnalyticalSignal;
  positionSizing: PositionSizingResult;
  riskConstraints: RiskConstraintEvaluationResult[];
  targetPosition: {
    securityId: string;
    symbol: string;
    direction: SignalDirection;
    requestedWeightPct: number;
    constrainedWeightPct: number;
    isConstrained: boolean;
    currency: string;
  };
  epistemicStatus: EpistemicStatus;
  provider: string;
  provenance: PointInTimeProvenance;
  warnings: string[];
  auditTrail: {
    timestamp: string;
    reason: string;
    indicatorSnapshots: Record<string, { current: number | null; previous: number | null }>;
    ruleOutcomes: { ruleId: string; passed: boolean; explanation: string }[];
  };
  isAnalyticalOnly: true;
  executionProhibited: true;
}

// ==========================================
// PHASE 13: INVESTMENT RESEARCH NOTEBOOK & RESEARCH INTELLIGENCE
// ==========================================

export type ResearchQueryType =
  | 'INVESTMENT_THESIS'
  | 'FUNDAMENTAL_ANALYSIS'
  | 'VALUATION'
  | 'GROWTH'
  | 'RISK'
  | 'CATALYSTS'
  | 'COMPETITIVE_POSITION'
  | 'MANAGEMENT'
  | 'EARNINGS'
  | 'RECENT_CHANGES'
  | 'BULL_CASE'
  | 'BEAR_CASE'
  | 'PORTFOLIO_IMPACT'
  | 'QUANT_SIGNAL_EXPLANATION'
  | 'CUSTOM';

export type ResearchClaimClassification =
  | 'FACT'
  | 'INFERENCE'
  | 'UNCERTAINTY'
  | 'SIMULATED'
  | 'UNAVAILABLE';

export interface ResearchClaim {
  claimId: string;
  statement: string;
  classification: ResearchClaimClassification;
  confidence: number;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  asOfDate: string;
  provenance?: PointInTimeProvenance | EvidenceSourceReference;
}

export interface ResearchRisk {
  riskId: string;
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceIds: string[];
  confidence: number;
  asOfDate?: string;
}

export interface ResearchCatalyst {
  catalystId: string;
  title: string;
  description: string;
  hasEvidence: boolean;
  evidenceIds: string[];
  isUncertainty: boolean;
}

export interface SourceCoverage {
  availableSources: string[];
  missingSources: string[];
  unavailableProviders: string[];
  latestSourceDate: string | null;
  oldestSourceDate: string | null;
  sourceCount: number;
  evidenceCount: number;
  status: 'HIGH_EVIDENCE_COVERAGE' | 'MODERATE_EVIDENCE_COVERAGE' | 'LIMITED_EVIDENCE_COVERAGE' | 'INSUFFICIENT_EVIDENCE';
}

export interface ResearchSourceItem {
  sourceId: string;
  securityId: string;
  sourceType: EvidenceSourceType;
  provider: string;
  title: string;
  documentType?: string;
  publishedAt: string;
  filingDate?: string;
  retrievedAt: string;
  sourceReference?: EvidenceSourceReference;
  epistemicStatus: EvidenceEpistemicStatus;
  isSimulated: boolean;
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'LIMITED';
}

export interface InvestmentThesis {
  executiveThesis: string;
  bullCase: {
    summary: string;
    points: string[];
    evidenceIds: string[];
    claims?: ResearchClaim[];
  };
  bearCase: {
    summary: string;
    points: string[];
    evidenceIds: string[];
    claims?: ResearchClaim[];
  };
  catalysts: ResearchCatalyst[];
  risks: ResearchRisk[];
  whatChanged: {
    status: string;
    hasPriorSnapshot: boolean;
    changes: string[];
    newEvidenceCount: number;
    previousSnapshotDate?: string | null;
    newDocumentCount?: number;
    newChunkCount?: number;
    thesisImpact?: {
      bullCase: 'Strengthened' | 'Unchanged' | 'Weakened';
      bearCase: 'Strengthened' | 'Unchanged' | 'Weakened';
      summary: string;
    };
    newRisks?: string[];
    newCatalysts?: string[];
    evidenceCoverageDelta?: string;
  };
  evidenceGaps: {
    available: string[];
    missing: string[];
    unavailable: string[];
  };
  contradictions: {
    topic: string;
    sideA: string;
    sideB: string;
    evidenceIdsA: string[];
    evidenceIdsB: string[];
  }[];
  quantitativeContext?: {
    signal?: string;
    strategyName?: string;
    epistemicStatus?: EpistemicStatus;
    metrics?: Record<string, any>;
    backtestSummary?: string;
    isSimulated?: boolean;
  };
  portfolioContext?: {
    isHeld: boolean;
    positionWeight?: number;
    riskContribution?: number;
    shares?: number;
    currency?: string;
  };
  thesisInvalidationConditions: string[];
  confidenceCoverage: 'HIGH_EVIDENCE_COVERAGE' | 'MODERATE_EVIDENCE_COVERAGE' | 'LIMITED_EVIDENCE_COVERAGE' | 'INSUFFICIENT_EVIDENCE';
}

export interface ResearchNotebook {
  notebookId: string;
  securityId: string;
  symbol: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  evidenceCount: number;
  lastResearchDate: string | null;
  researchAsOfDate: string | null;
  sourceCoverage: SourceCoverage;
  provenance: PointInTimeProvenance;
  ownerUserId?: string;
  userId?: string;
}

export interface ResearchSnapshot {
  snapshotId: string;
  notebookId: string;
  securityId: string;
  createdAt: string;
  researchAsOfDate: string;
  evidenceIds: string[];
  queryType?: ResearchQueryType;
  query?: string;
  thesis: InvestmentThesis;
  claims: ResearchClaim[];
  risks: ResearchRisk[];
  catalysts: ResearchCatalyst[];
  conflicts: RetrievalConflict[];
  evidenceGaps: {
    available: string[];
    missing: string[];
    unavailable: string[];
  };
  ownerUserId?: string;
  userId?: string;
}

export interface ResearchNotebookResponse {
  notebook: ResearchNotebook;
  sources: ResearchSourceItem[];
  snapshots: ResearchSnapshot[];
  activeSnapshot?: ResearchSnapshot | null;
}

// ==========================================
// PHASE 14: RESEARCH DOCUMENT INTELLIGENCE & USER-GROUNDED RAG
// ==========================================

export type DocumentProcessingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export type SupportedDocumentFormat =
  | 'PDF'
  | 'TXT'
  | 'MARKDOWN'
  | 'CSV'
  | 'UNSUPPORTED';

export type ResearchDocumentType =
  | 'ANALYST_NOTE'
  | 'BROKER_REPORT'
  | 'EARNINGS_CALL_TRANSCRIPT'
  | 'INDUSTRY_REPORT'
  | 'INTERNAL_MEMO'
  | 'VALUATION_MODEL'
  | 'SEC_DISCLOSURE'
  | 'OTHER'
  | string;

export interface ResearchDocument {
  documentId: string;
  id?: string;
  securityId?: string;
  title: string;
  fileName: string;
  format?: string;
  author?: string;
  publisher?: string;
  documentDate?: string;
  tags?: string[];
  documentType: ResearchDocumentType;
  sourceType: 'RESEARCH_DOCUMENT';
  provider: string;
  publishedAt?: string;
  availableFrom?: string;
  uploadedAt: string;
  uploadedBy?: string;
  ownerUserId?: string;
  userId?: string;
  pageCount?: number;
  characterCount?: number;
  rowCount?: number;
  contentHash: string;
  epistemicStatus: 'REAL' | 'UNAVAILABLE' | 'ERROR' | EvidenceEpistemicStatus;
  epistemicDefault?: EvidenceEpistemicStatus;
  status?: string;
  isSimulated: boolean;
  processingStatus: DocumentProcessingStatus;
  extractionWarnings?: string[];
  evidenceIds?: string[];
  extractedEvidenceIds?: string[];
  chunkIds?: string[];
  chunkCount?: number;
  evidenceCount?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentUploadRequest {
  title?: string;
  fileName: string;
  securityId?: string;
  provider?: string;
  author?: string;
  publisher?: string;
  documentDate?: string;
  tags?: string[];
  epistemicDefault?: EvidenceEpistemicStatus;
  publishedAt?: string;
  availableFrom?: string;
  fileContentBase64?: string;
  fileText?: string;
  fileContent?: string;
  documentType?: ResearchDocumentType;
  uploadedBy?: string;
}

export interface DocumentUploadResult {
  document: ResearchDocument;
  evidenceItemsCount: number;
  chunksCount: number;
  evidenceCount?: number;
  chunkCount?: number;
  pageCount?: number;
  rowCount?: number;
  warnings?: string[];
  extractionWarnings: string[];
  isDuplicate: boolean;
}

export interface DocumentRegistryStats {
  totalDocuments: number;
  readyDocuments: number;
  failedDocuments: number;
  totalEvidenceItems: number;
  totalChunks: number;
  documentsBySecurity: Record<string, number>;
  documentsByType: Record<string, number>;
}

export type ResearchSourceFilter =
  | 'ALL'
  | 'OFFICIAL_FILINGS'
  | 'MARKET_DATA'
  | 'RESEARCH_DOCUMENTS'
  | 'PORTFOLIO'
  | 'QUANTITATIVE';

// ============================================================================
// PHASE 15: INVESTMENT DECISION INTELLIGENCE TYPES
// ============================================================================

export type DecisionOverallAssessment =
  | 'POSITIVE'
  | 'CONSTRUCTIVE'
  | 'NEUTRAL'
  | 'CAUTIOUS'
  | 'NEGATIVE'
  | 'INSUFFICIENT_EVIDENCE';

export type DecisionConviction =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INSUFFICIENT';

export type DecisionDimensionKey =
  | 'fundamentalQuality'
  | 'growthTrend'
  | 'valuationContext'
  | 'marketTrend'
  | 'quantitativeSignal'
  | 'backtestContext'
  | 'riskProfile'
  | 'portfolioFit'
  | 'evidenceCoverage'
  | 'thesisStatus';

export interface DecisionDimensionAssessment {
  dimension: DecisionDimensionKey;
  dimensionName: string;
  assessment: string; // e.g. 'STRONG', 'POSITIVE', 'ELEVATED', 'BULLISH', 'MIXED', 'SUPPORTIVE', 'CAUTIOUS', etc.
  category: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'CAUTIOUS' | 'INSUFFICIENT';
  score: number; // normalized [-1.0 to 1.0]
  weight: number; // relative weight in overall assessment
  rationale: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  dataStatus: 'REAL' | 'CALCULATED' | 'SIMULATED' | 'UNAVAILABLE' | 'MIXED';
  limitations?: string[];
  metrics?: Record<string, string | number | boolean | null | string[]>;
}

export interface DecisionInvalidationCondition {
  conditionId: string;
  category: 'FUNDAMENTAL' | 'VALUATION' | 'TECHNICAL' | 'PORTFOLIO' | 'FILING' | 'CATALYST';
  condition: string;
  threshold?: string;
  measurable: boolean;
  falsifiable: boolean;
  triggered: boolean;
  status: 'ACTIVE_GUARD' | 'TRIGGERED' | 'NOT_APPLICABLE';
  evidenceIds?: string[];
}

export interface DecisionKeyRisk {
  riskId: string;
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  evidenceIds: string[];
}

export interface DecisionCatalyst {
  catalystId: string;
  title: string;
  description: string;
  type: 'DISCLOSED' | 'FORWARD_LOOKING';
  timeline?: string;
  evidenceIds: string[];
}

export interface DecisionFrameworkConfiguration {
  version: string;
  fundamentalWeight: number;
  growthWeight: number;
  valuationWeight: number;
  marketTrendWeight: number;
  quantitativeWeight: number;
  backtestWeight: number;
  riskWeight: number;
  portfolioFitWeight: number;
  evidenceCoverageWeight?: number;
  thesisStatusWeight?: number;
  minimumEvidenceThreshold: number;
}

export interface InvestmentDecisionAssessment {
  decisionId: string;
  securityId: string;
  canonicalSecurity: CanonicalSecurity;
  asOfDate: string;
  generatedAt: string;
  frameworkVersion: string;
  overallAssessment: DecisionOverallAssessment;
  conviction: DecisionConviction;
  compositeScore: number;
  dimensionAssessments: Record<DecisionDimensionKey, DecisionDimensionAssessment>;
  dimensionsList: DecisionDimensionAssessment[];
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  evidenceCoverage: {
    rating: 'HIGH' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';
    totalEvidenceCount: number;
    availableCategories: string[];
    missingCategories: string[];
    details: string;
  };
  keyDrivers: string[];
  counterEvidence: string[];
  keyRisks: DecisionKeyRisk[];
  catalysts: DecisionCatalyst[];
  thesisStatus: {
    status: 'STRENGTHENING' | 'STABLE' | 'WEAKENING' | 'INVALIDATED' | 'NO_PRIOR_THESIS' | 'INSUFFICIENT_EVIDENCE';
    notebookId?: string;
    snapshotId?: string;
    summary: string;
  };
  invalidationConditions: DecisionInvalidationCondition[];
  portfolioContext: {
    isHeld: boolean;
    currentWeightPct?: number;
    shares?: number;
    marketValue?: number;
    unrealizedPnLPct?: number;
    portfolioBetaContribution?: number;
    sectorWeightPct?: number;
    marginalRiskRating: 'FAVORABLE' | 'NEUTRAL' | 'CONSTRAINED' | 'HIGH_CONCENTRATION' | 'NOT_HELD';
    implication: string;
  };
  quantitativeContext: {
    compositeSignal: 'BUY' | 'HOLD' | 'SELL' | 'MIXED' | 'UNAVAILABLE';
    strategiesEvaluated: Array<{
      strategyId: string;
      strategyName: string;
      signal: 'BUY' | 'HOLD' | 'SELL' | 'NEUTRAL';
      indicatorValues: Record<string, number | string>;
      signalTimestamp: string;
      epistemicStatus: 'REAL' | 'CALCULATED' | 'SIMULATED';
    }>;
    agreement: 'UNANIMOUS' | 'MAJORITY' | 'MIXED' | 'INSUFFICIENT';
    summary: string;
  };
  valuationContext: {
    status: 'ATTRACTIVE' | 'FAIR' | 'ELEVATED' | 'EXTREME' | 'INSUFFICIENT_EVIDENCE' | 'UNAVAILABLE';
    peRatio?: number | null;
    priceToSales?: number | null;
    priceToFCF?: number | null;
    evToEbitda?: number | null;
    earningsYield?: number | null;
    availableMetrics: string[];
    missingMetrics: string[];
    rationale: string;
  };
  fundamentalContext: {
    status: 'STRONG' | 'STABLE' | 'WEAK' | 'DETERIORATING' | 'INSUFFICIENT_EVIDENCE';
    revenueTrend?: 'GROWING' | 'FLAT' | 'DECLINING' | 'UNKNOWN';
    operatingMarginTrend?: 'EXPANDING' | 'STABLE' | 'CONTRACTING' | 'UNKNOWN';
    netIncomeTrend?: 'GROWING' | 'FLAT' | 'DECLINING' | 'UNKNOWN';
    operatingCashFlowTrend?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'UNKNOWN';
    availablePeriodsCount: number;
    summary: string;
  };
  marketContext: {
    currentPrice: number;
    currency: string;
    trend: 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'UNKNOWN';
    aboveSma50?: boolean | null;
    aboveSma200?: boolean | null;
    momentumPercent?: number | null;
    annualizedVolatility?: number | null;
    maxDrawdownPercent?: number | null;
    provider: string;
    epistemicStatus: 'REAL' | 'SIMULATED' | 'CALCULATED' | 'UNAVAILABLE';
  };
  backtestContext?: {
    status: 'SUPPORTIVE' | 'NEUTRAL' | 'UNFAVORABLE' | 'HISTORICAL_SIMULATION_ONLY' | 'UNAVAILABLE';
    strategyName?: string;
    sharpeRatio?: number | null;
    cagr?: number | null;
    maxDrawdown?: number | null;
    winRate?: number | null;
    profitFactor?: number | null;
    disclaimer: string;
  };
  dataQuality: {
    providerStatuses: Record<string, string>;
    dataFreshness: string;
    hasSimulatedData: boolean;
    hasStaleData: boolean;
    missingSources: string[];
    conflictingSources: Array<{
      concept: string;
      primarySource: string;
      conflictingSource: string;
    }>;
    epistemicSummary: Record<'REAL' | 'CALCULATED' | 'SIMULATED' | 'UNAVAILABLE', number>;
  };
  explanation: {
    summary: string;
    whyDrivers: string[];
    counterEvidence: string[];
    keyRisksSummary: string[];
    portfolioImplicationSummary: string;
    invalidationSummary: string[];
    disclaimer: string;
    generatedBy: 'DETERMINISTIC_RULES' | 'GEMINI_ENRICHED' | 'DETERMINISTIC_FALLBACK';
  };
  limitations: string[];
  isAnalyticalOnly: true;
  executionProhibited: true;
}

export interface SecurityDecisionComparison {
  comparisonId: string;
  asOfDate: string;
  generatedAt: string;
  securityA: InvestmentDecisionAssessment;
  securityB: InvestmentDecisionAssessment;
  dimensionComparisons: Array<{
    dimension: DecisionDimensionKey;
    dimensionName: string;
    securityAAssessment: string;
    securityBAssessment: string;
    advantage: 'SECURITY_A' | 'SECURITY_B' | 'TIED' | 'INCOMPARABLE';
    reason: string;
  }>;
  overallAdvantage: 'SECURITY_A' | 'SECURITY_B' | 'BALANCED' | 'INSUFFICIENT_EVIDENCE';
  summary: string;
  disclaimer: string;
  isAnalyticalOnly: true;
  executionProhibited: true;
}

export interface DecisionEvaluateRequest {
  securityId: string;
  asOfDate?: string;
  configuration?: Partial<DecisionFrameworkConfiguration>;
  forceRefresh?: boolean;
}

export interface DecisionCompareRequest {
  securityIdA: string;
  securityIdB: string;
  asOfDate?: string;
  configuration?: Partial<DecisionFrameworkConfiguration>;
}

// ==========================================
// PHASE 16: PERSISTENCE & AUDIT ARCHITECTURE
// ==========================================

export type PersistenceStatusCode = 'CONNECTED' | 'DEVELOPMENT_ADAPTER' | 'UNCONFIGURED' | 'ERROR';
export type PersistenceProviderType = 'POSTGRES' | 'DISK_STORAGE' | 'IN_MEMORY';

export interface PersistenceStatusResponse {
  status: PersistenceStatusCode;
  provider: PersistenceProviderType;
  environment: string;
  isPostgresConfigured: boolean;
  migrationVersion: number;
  entityCounts: {
    securities: number;
    documents: number;
    evidence: number;
    notebooks: number;
    snapshots: number;
    decisions: number;
    strategies: number;
    backtests: number;
    alerts: number;
    queries: number;
  };
  details: {
    diskBacked: boolean;
    storagePath?: string;
    schemaVersion: string;
    lastPersistedAt?: string;
  };
}

// ==========================================
// PHASE 17: AUTHENTICATION, AUTHORIZATION & USER DATA ISOLATION
// ==========================================

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  userId: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface SafeUser {
  userId: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  ipAddress?: string;
  userAgent?: string;
  isValid: boolean;
}

export interface AuthResponse {
  authenticated: boolean;
  user: SafeUser | null;
  session?: {
    sessionId: string;
    expiresAt: string;
  };
  message?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}



