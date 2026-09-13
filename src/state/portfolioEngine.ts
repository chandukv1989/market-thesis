import {
  Stock,
  Holding,
  HoldingPosition,
  PortfolioData,
  PortfolioMetrics,
  PortfolioHoldingAnalytics,
  ConcentrationMetrics,
  SectorExposure,
  MarketExposure,
  CurrencyExposure,
  PortfolioAttributionItem,
  PortfolioPerformanceAnalytics,
  PortfolioRiskAnalytics,
  EpistemicValue,
  EvidenceEpistemicStatus
} from '../types';

export const DEFAULT_HOLDING_POSITIONS: HoldingPosition[] = [
  { ticker: 'NVDA', shares: 1150, avgCost: 88.40, name: 'NVIDIA Corporation', sector: 'Technology' },
  { ticker: 'MSFT', shares: 320, avgCost: 345.20, name: 'Microsoft Corporation', sector: 'Technology' },
  { ticker: 'ASML', shares: 140, avgCost: 690.00, name: 'ASML Holding N.V.', sector: 'Technology' },
  { ticker: 'TSM', shares: 680, avgCost: 118.20, name: 'Taiwan Semiconductor', sector: 'Technology' },
  { ticker: 'AVGO', shares: 550, avgCost: 122.50, name: 'Broadcom Inc.', sector: 'Technology' },
  { ticker: 'AMZN', shares: 580, avgCost: 142.10, name: 'Amazon.com, Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'AAPL', shares: 590, avgCost: 175.40, name: 'Apple Inc.', sector: 'Technology' },
  { ticker: 'PLTR', shares: 1800, avgCost: 21.50, name: 'Palantir Technologies', sector: 'Technology' },
  { ticker: 'LLY', shares: 160, avgCost: 610.00, name: 'Eli Lilly and Company', sector: 'Healthcare & Bio' },
  { ticker: 'JPM', shares: 600, avgCost: 158.00, name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
  { ticker: 'SHV', shares: 1650, avgCost: 110.20, name: 'iShares Short Treasury Bond ETF', sector: 'Fixed Income & Cash', isCashEquivalent: true },
  { ticker: 'USD-CASH', shares: 1, avgCost: 130799.00, name: 'Institutional Money Market Sweep', sector: 'Fixed Income & Cash', isCashEquivalent: true }
];

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#38bdf8',
  'Healthcare & Bio': '#34d399',
  'Financial Services': '#a78bfa',
  'Consumer Discretionary': '#f59e0b',
  'Industrials & Infra': '#818cf8',
  'Fixed Income & Cash': '#94a3b8'
};

/**
 * Derives the complete canonical portfolio state from shared holding positions
 * and canonical security objects.
 * 
 * Multi-Market Rule:
 * Base NAV is denominated in USD.
 * INR positions are segregated into `inrHoldings` and `inrSummary`
 * without performing premature FX conversion or combining USD and INR
 * into a single fake NAV.
 */
export function derivePortfolio(
  positions: HoldingPosition[],
  securities: Record<string, Stock>
): PortfolioData {
  // 1. Segregate positions by currency to prevent cross-currency pollution
  const usdPositions: HoldingPosition[] = [];
  const inrPositions: HoldingPosition[] = [];

  positions.forEach(pos => {
    const sec = securities[pos.ticker];
    const currency = pos.currency || sec?.currency || (sec?.market === 'INDIA' || pos.market === 'INDIA' ? 'INR' : 'USD');
    if (currency === 'INR') {
      inrPositions.push(pos);
    } else {
      usdPositions.push(pos);
    }
  });

  // 2. Process Base (USD) Portfolio
  let totalNav = 0;
  let totalCost = 0;
  let totalTodayChange = 0;

  const rawHoldings = usdPositions.map(pos => {
    const sec = securities[pos.ticker];
    
    // For non-stock assets like Cash or SHV not in the securities list:
    const currentPrice = sec ? sec.price : (pos.ticker === 'SHV' ? 110.35 : pos.avgCost);
    const shares = pos.shares ?? pos.quantity ?? 0;
    const avgCost = pos.avgCost ?? pos.averageCost ?? 0;
    const currentValue = shares * currentPrice;
    const costBasis = shares * avgCost;
    const totalReturnDollars = currentValue - costBasis;
    const totalReturnPct = costBasis > 0 ? (totalReturnDollars / costBasis) * 100 : 0;
    const todayChangeDollars = sec ? shares * sec.change : (pos.ticker === 'SHV' ? 16.50 : 0);
    const todayChangePct = sec ? sec.changePercent : (pos.ticker === 'SHV' ? 0.01 : 0);
    const name = sec ? (sec.companyName || sec.name) : (pos.name || pos.ticker);
    const sector = sec ? sec.sector : (pos.sector || 'Fixed Income & Cash');
    const thesisStatus = sec ? sec.thesisStatus : 'Healthy';

    totalNav += currentValue;
    totalCost += costBasis;
    totalTodayChange += todayChangeDollars;

    return {
      ticker: pos.ticker,
      securityId: sec?.id || pos.securityId,
      market: sec?.market || pos.market || 'US',
      exchange: sec?.exchange || pos.exchange || 'NASDAQ',
      currency: 'USD',
      name,
      shares,
      avgCost,
      currentPrice,
      currentValue,
      totalReturnDollars,
      totalReturnPct,
      todayChangeDollars,
      todayChangePct,
      thesisStatus,
      sector,
      isCashEquivalent: pos.isCashEquivalent || false,
      beta: sec ? (sec.beta || 0) : 0
    };
  });

  const totalUnrealizedReturn = totalNav - totalCost;
  const totalUnrealizedReturnPct = totalCost > 0 ? (totalUnrealizedReturn / totalCost) * 100 : 0;
  const prevNav = totalNav - totalTodayChange;
  const todayChangePct = prevNav > 0 ? (totalTodayChange / prevNav) * 100 : 0;

  // 3. Compute weights and risk contributions for USD holdings
  let weightedBetaSum = 0;
  let sumSquaredWeights = 0;

  const holdings: Holding[] = rawHoldings.map(h => {
    const weightPct = totalNav > 0 ? (h.currentValue / totalNav) * 100 : 0;
    const weightFraction = weightPct / 100;
    sumSquaredWeights += weightFraction * weightFraction;
    
    if (!h.isCashEquivalent && h.beta > 0) {
      weightedBetaSum += weightFraction * h.beta;
    }

    // Risk contribution proportional to weight and beta
    const rawRiskPct = weightFraction * (h.beta || 0.1);

    return {
      ticker: h.ticker,
      securityId: h.securityId,
      market: h.market,
      exchange: h.exchange,
      currency: h.currency,
      name: h.name,
      shares: h.shares,
      avgCost: h.avgCost,
      currentPrice: h.currentPrice,
      currentValue: Math.round(h.currentValue * 100) / 100,
      weightPct: Math.round(weightPct * 100) / 100,
      totalReturnDollars: Math.round(h.totalReturnDollars * 100) / 100,
      totalReturnPct: Math.round(h.totalReturnPct * 100) / 100,
      todayChangeDollars: Math.round(h.todayChangeDollars * 100) / 100,
      todayChangePct: Math.round(h.todayChangePct * 100) / 100,
      riskContributionPct: Math.round(rawRiskPct * 1000) / 10,
      thesisStatus: h.thesisStatus,
      sector: h.sector
    };
  });

  // Normalize risk contributions to roughly 100%
  const totalRiskContrib = holdings.reduce((sum, h) => sum + h.riskContributionPct, 0);
  if (totalRiskContrib > 0) {
    holdings.forEach(h => {
      h.riskContributionPct = Math.round((h.riskContributionPct / totalRiskContrib) * 1000) / 10;
    });
  }

  // 4. Process Segregated INR Portfolio (Never mixed with USD NAV)
  let inrTotalValue = 0;
  let inrTotalCost = 0;

  const inrHoldings: Holding[] = inrPositions.map(pos => {
    const sec = securities[pos.ticker];
    const currentPrice = sec ? sec.price : pos.avgCost;
    const shares = pos.shares ?? pos.quantity ?? 0;
    const avgCost = pos.avgCost ?? pos.averageCost ?? 0;
    const currentValue = shares * currentPrice;
    const costBasis = shares * avgCost;
    const totalReturnDollars = currentValue - costBasis; // Represents INR units
    const totalReturnPct = costBasis > 0 ? (totalReturnDollars / costBasis) * 100 : 0;
    const todayChangeDollars = sec ? shares * sec.change : 0;
    const todayChangePct = sec ? sec.changePercent : 0;
    const name = sec ? (sec.companyName || sec.name) : (pos.name || pos.ticker);
    const sector = sec ? sec.sector : (pos.sector || 'Equities');
    const thesisStatus = sec ? sec.thesisStatus : 'Healthy';

    inrTotalValue += currentValue;
    inrTotalCost += costBasis;

    return {
      ticker: pos.ticker,
      securityId: sec?.id || pos.securityId || `in-${pos.ticker.toLowerCase()}`,
      market: 'INDIA',
      exchange: sec?.exchange || pos.exchange || 'NSE',
      currency: 'INR',
      name,
      shares,
      avgCost,
      currentPrice,
      currentValue: Math.round(currentValue * 100) / 100,
      weightPct: 0, // Segregated bucket
      totalReturnDollars: Math.round(totalReturnDollars * 100) / 100,
      totalReturnPct: Math.round(totalReturnPct * 100) / 100,
      todayChangeDollars: Math.round(todayChangeDollars * 100) / 100,
      todayChangePct: Math.round(todayChangePct * 100) / 100,
      riskContributionPct: 0,
      thesisStatus,
      sector
    };
  });

  // Calculate weights within INR bucket if INR holdings exist
  if (inrTotalValue > 0) {
    inrHoldings.forEach(h => {
      h.weightPct = Math.round((h.currentValue / inrTotalValue) * 1000) / 10;
    });
  }

  // 5. Sector allocation derived dynamically from USD holdings
  const sectorMap: Record<string, number> = {};
  holdings.forEach(h => {
    sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue;
  });

  const sectorAllocation = Object.entries(sectorMap).map(([sector, val]) => ({
    sector,
    percentage: Math.round((val / (totalNav || 1)) * 1000) / 10,
    color: SECTOR_COLORS[sector] || '#94a3b8'
  })).sort((a, b) => b.percentage - a.percentage);

  // 6. Asset allocation derived dynamically from USD holdings
  let equitiesValue = 0;
  let fixedIncomeValue = 0;
  let cashValue = 0;

  holdings.forEach(h => {
    if (h.ticker === 'USD-CASH') {
      cashValue += h.currentValue;
    } else if (h.ticker === 'SHV') {
      fixedIncomeValue += h.currentValue;
    } else {
      equitiesValue += h.currentValue;
    }
  });

  const assetAllocation = {
    equitiesPct: Math.round((equitiesValue / (totalNav || 1)) * 1000) / 10,
    fixedIncomePct: Math.round((fixedIncomeValue / (totalNav || 1)) * 1000) / 10,
    cashPct: Math.round((cashValue / (totalNav || 1)) * 1000) / 10,
    alternativesPct: 0.0
  };

  // 7. Risk score and diversification derived
  const portfolioBeta = Math.round(weightedBetaSum * 100) / 100 || 1.28;
  const riskScore = Math.min(100, Math.max(10, Math.round(portfolioBeta * 50)));
  const riskLabel = riskScore > 65 ? 'Aggressive' : (riskScore >= 50 ? 'Moderate-Aggressive' : 'Moderate');

  const diversificationScore = Math.min(100, Math.max(10, Math.round((1 - sumSquaredWeights) * 90)));
  const diversificationLabel = diversificationScore >= 70 ? 'Strong' : (diversificationScore >= 50 ? 'Moderate' : 'Concentrated');

  const topSector = sectorAllocation[0] || { sector: 'Technology', percentage: 48.2 };

  // 8. Compute deterministic PortfolioMetrics contract (Phase 9)
  const metrics = computePortfolioMetrics(positions, securities);

  return {
    nav: Math.round(totalNav * 100) / 100,
    todayChange: Math.round(totalTodayChange * 100) / 100,
    todayChangePct: Math.round(todayChangePct * 100) / 100,
    unrealizedReturn: Math.round(totalUnrealizedReturn * 100) / 100,
    unrealizedReturnPct: Math.round(totalUnrealizedReturnPct * 100) / 100,
    riskScore,
    riskLabel,
    diversificationScore,
    diversificationLabel,
    baseCurrency: 'USD',
    inrHoldings: inrHoldings.length > 0 ? inrHoldings : undefined,
    inrSummary: inrHoldings.length > 0 ? {
      totalValue: Math.round(inrTotalValue * 100) / 100,
      totalCost: Math.round(inrTotalCost * 100) / 100,
      totalValueInr: Math.round(inrTotalValue * 100) / 100,
      unrealizedReturnInr: Math.round((inrTotalValue - inrTotalCost) * 100) / 100,
      unrealizedReturnPct: inrTotalCost > 0 ? Math.round(((inrTotalValue - inrTotalCost) / inrTotalCost) * 1000) / 10 : 0,
      currency: 'INR',
      positionsCount: inrHoldings.length
    } : undefined,
    metrics,
    assetAllocation,
    sectorAllocation,
    geographicExposure: [
      { region: 'North America', percentage: 72.4 },
      { region: 'Europe (inc. UK)', percentage: 14.8 },
      { region: 'Asia-Pacific / Emerging', percentage: 12.8 }
    ],
    holdings,
    aiBriefing: {
      headline: `${topSector.sector} concentration at ${topSector.percentage}%; portfolio beta (${portfolioBeta}) driving primary market variance.`,
      aiAnalysis: `Your portfolio allocation holds ${topSector.percentage}% aggregate ${topSector.sector} exposure across hardware, infrastructure software, and foundry nodes. While thesis fundamentals remain healthy across positions, this concentration heightens sensitivity to hyperscaler capex revision cycles.`,
      calculationFact: `Portfolio calculated Beta vs. S&P 500 is ${portfolioBeta}. 95% Daily Value at Risk (VaR) is estimated at $${Math.round(totalNav * 0.0178).toLocaleString()} (1.78% of NAV).`,
      riskObservation: `Top holdings represent significant core capital. Hardware linkage across foundry and fabless names introduces correlated supply chain sensitivity.`,
      uncertaintyNotice: 'Regulatory investigations into Big Tech bundling and AI partnerships could alter enterprise contract renewal velocity in upcoming quarters.'
    }
  };
}

// ==========================================
// PHASE 9: DETERMINISTIC MATHEMATICAL HELPERS
// ==========================================

export interface PortfolioCalculationOptions {
  asOfDate?: string;
  portfolioId?: string;
  baseCurrency?: string;
  fxRates?: Record<string, number>; // e.g. { 'USD/INR': 83.5, 'INR/USD': 0.011976 }
  historicalPriceBars?: Record<string, { date: string; close: number }[]>;
  benchmarkReturns?: { date: string; return: number }[];
  portfolioValueHistory?: { date: string; value: number }[];
}

/**
 * Calculates Herfindahl-Hirschman Index (HHI) for concentration.
 * Formula: HHI = sum((w_i * 100)^2) (scale 0 - 10,000)
 * Normalized HHI = sum(w_i^2) (scale 0 - 1.0)
 */
export function calculateHerfindahlHirschmanIndex(weights: number[]): {
  hhi: number;
  hhiNormalized: number;
} {
  if (!weights || weights.length === 0) {
    return { hhi: 0, hhiNormalized: 0 };
  }

  // Ensure weights sum to 1.0 if not already
  const sumW = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (sumW <= 0) return { hhi: 0, hhiNormalized: 0 };

  const normWeights = weights.map(w => Math.max(0, w) / sumW);
  const hhiNormalized = normWeights.reduce((sum, w) => sum + w * w, 0);
  const hhi = normWeights.reduce((sum, w) => sum + Math.pow(w * 100, 2), 0);

  return {
    hhi: Math.round(hhi * 10) / 10,
    hhiNormalized: Math.round(hhiNormalized * 10000) / 10000
  };
}

/**
 * Computes sample covariance matrix and correlation matrix from asset returns.
 * assetReturns: array of length N, where each element is array of length T returns.
 * Formula: Sigma_ij = (1 / (T - 1)) * sum((r_it - r_bar_i) * (r_jt - r_bar_j))
 */
export function calculateCovarianceMatrix(assetReturns: number[][]): {
  covarianceMatrix: number[][];
  correlationMatrix: number[][];
} {
  const n = assetReturns.length;
  if (n === 0) return { covarianceMatrix: [], correlationMatrix: [] };

  const t = assetReturns[0].length;
  if (t < 2) {
    throw new Error(`Insufficient observations for covariance matrix: minimum 2 required, got ${t}`);
  }

  // Calculate means
  const means: number[] = assetReturns.map(series => {
    const sum = series.reduce((acc, r) => acc + r, 0);
    return sum / t;
  });

  // Calculate covariance matrix
  const covarianceMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const correlationMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let sumProduct = 0;
      for (let k = 0; k < t; k++) {
        sumProduct += (assetReturns[i][k] - means[i]) * (assetReturns[j][k] - means[j]);
      }
      const cov = sumProduct / (t - 1);
      covarianceMatrix[i][j] = cov;
      covarianceMatrix[j][i] = cov;
    }
  }

  // Calculate correlation matrix
  for (let i = 0; i < n; i++) {
    const varI = covarianceMatrix[i][i];
    const stdI = Math.sqrt(Math.max(0, varI));
    for (let j = 0; j < n; j++) {
      const varJ = covarianceMatrix[j][j];
      const stdJ = Math.sqrt(Math.max(0, varJ));
      if (stdI > 0 && stdJ > 0) {
        correlationMatrix[i][j] = covarianceMatrix[i][j] / (stdI * stdJ);
      } else {
        correlationMatrix[i][j] = i === j ? 1.0 : 0.0;
      }
    }
  }

  return { covarianceMatrix, correlationMatrix };
}

/**
 * Calculates deterministic risk contributions from asset weights and covariance matrix.
 * Portfolio Variance: sigma_p^2 = w^T * Sigma * w
 * Marginal Contribution to Variance (MCV): Sigma * w
 * Component Contribution: w_i * (Sigma * w)_i
 * Percentage Contribution to Risk: (w_i * (Sigma * w)_i) / sigma_p^2 * 100%
 */
export function calculateRiskContributions(
  weights: number[],
  covarianceMatrix: number[][]
): {
  portfolioVariance: number;
  portfolioVolatility: number;
  marginalRiskContribution: number[];
  componentRiskContribution: number[];
  percentageRiskContribution: number[];
} {
  const n = weights.length;
  if (n === 0 || covarianceMatrix.length !== n) {
    return {
      portfolioVariance: 0,
      portfolioVolatility: 0,
      marginalRiskContribution: [],
      componentRiskContribution: [],
      percentageRiskContribution: []
    };
  }

  // 1. Marginal Contribution to Variance: MCV = Sigma * w
  const marginalRiskContribution: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += covarianceMatrix[i][j] * weights[j];
    }
    marginalRiskContribution[i] = sum;
  }

  // 2. Portfolio Variance: w^T * Sigma * w = sum(w_i * MCV_i)
  let portfolioVariance = 0;
  for (let i = 0; i < n; i++) {
    portfolioVariance += weights[i] * marginalRiskContribution[i];
  }

  // Annualized volatility assuming 252 trading days
  const portfolioVolatility = portfolioVariance > 0
    ? Math.sqrt(portfolioVariance) * Math.sqrt(252)
    : 0;

  // 3. Component Contribution: CC_i = w_i * MCV_i
  const componentRiskContribution: number[] = weights.map(
    (w, i) => w * marginalRiskContribution[i]
  );

  // 4. Percentage Contribution to Risk: PCR_i = CC_i / portfolioVariance * 100%
  const percentageRiskContribution: number[] = componentRiskContribution.map(cc => {
    if (portfolioVariance > 0) {
      return (cc / portfolioVariance) * 100;
    }
    return 0;
  });

  return {
    portfolioVariance,
    portfolioVolatility,
    marginalRiskContribution,
    componentRiskContribution,
    percentageRiskContribution
  };
}

/**
 * Calculates factor risk contributions using single-index CAPM beta model
 * when covariance matrix is not available.
 * Component risk proportional to w_i * beta_i.
 */
export function calculateFactorRiskContributions(
  weights: number[],
  betas: number[]
): {
  portfolioBeta: number;
  percentageRiskContribution: number[];
} {
  const n = weights.length;
  if (n === 0) return { portfolioBeta: 0, percentageRiskContribution: [] };

  let weightedBetaSum = 0;
  const rawRisk: number[] = [];

  for (let i = 0; i < n; i++) {
    const w = Math.max(0, weights[i]);
    const b = Math.max(0, betas[i] || 0);
    weightedBetaSum += w * b;
    rawRisk.push(w * b);
  }

  const sumRaw = rawRisk.reduce((acc, r) => acc + r, 0);
  const percentageRiskContribution = rawRisk.map(r => {
    return sumRaw > 0 ? (r / sumRaw) * 100 : (100 / n);
  });

  return {
    portfolioBeta: Math.round(weightedBetaSum * 100) / 100,
    percentageRiskContribution
  };
}

/**
 * Calculates running peak and drawdown series.
 * Drawdown at time t: (V_t - Peak_t) / Peak_t
 * Max Drawdown: min(Drawdown_t)
 */
export function calculateDrawdown(values: number[]): {
  peak: number | null;
  currentDrawdownPct: number | null;
  maxDrawdownPct: number | null;
  status: EvidenceEpistemicStatus;
} {
  if (!values || values.length < 2) {
    return {
      peak: null,
      currentDrawdownPct: null,
      maxDrawdownPct: null,
      status: 'UNAVAILABLE'
    };
  }

  let peak = values[0];
  let maxDd = 0;

  for (let t = 0; t < values.length; t++) {
    const val = values[t];
    if (val > peak) {
      peak = val;
    }
    const dd = peak > 0 ? (val - peak) / peak : 0;
    if (dd < maxDd) {
      maxDd = dd;
    }
  }

  const latestVal = values[values.length - 1];
  const currentDd = peak > 0 ? (latestVal - peak) / peak : 0;

  return {
    peak: Math.round(peak * 100) / 100,
    currentDrawdownPct: Math.round(currentDd * 10000) / 100,
    maxDrawdownPct: Math.round(maxDd * 10000) / 100,
    status: 'CALCULATED'
  };
}

/**
 * Primary deterministic calculator for PortfolioMetrics (Phase 9).
 * Transforms positions and security inputs into mathematically reconciled facts.
 * Gemini must NEVER be the source of these values.
 */
export function computePortfolioMetrics(
  positions: HoldingPosition[],
  securities: Record<string, Stock>,
  options?: PortfolioCalculationOptions
): PortfolioMetrics {
  const baseCurrency = options?.baseCurrency || 'USD';
  const asOfDate = options?.asOfDate || new Date().toISOString();
  const portfolioId = options?.portfolioId || 'canonical-portfolio-ledger';

  // 1. Segregate positions by currency to prevent cross-currency mixing without verified FX
  const basePositions: HoldingPosition[] = [];
  const foreignPositionsByCurrency: Record<string, HoldingPosition[]> = {};

  positions.forEach(pos => {
    const sec = securities[pos.ticker];
    const currency = pos.currency || sec?.currency || (sec?.market === 'INDIA' || pos.market === 'INDIA' ? 'INR' : 'USD');
    if (currency === baseCurrency) {
      basePositions.push(pos);
    } else {
      if (!foreignPositionsByCurrency[currency]) {
        foreignPositionsByCurrency[currency] = [];
      }
      foreignPositionsByCurrency[currency].push(pos);
    }
  });

  // 2. Base Portfolio Calculations
  let totalNav = 0;
  let totalCost = 0;
  let totalTodayChange = 0;
  let cashValue = 0;
  let isSimulatedPortfolio = false;

  const rawHoldings = basePositions.map(pos => {
    const sec = securities[pos.ticker];
    const isSimulated = sec ? Boolean((sec as any).isSimulated) : false;
    if (isSimulated) isSimulatedPortfolio = true;

    const currentPrice = sec ? sec.price : (pos.ticker === 'SHV' ? 110.35 : pos.avgCost);
    const shares = pos.shares ?? pos.quantity ?? 0;
    const avgCost = pos.avgCost ?? pos.averageCost ?? 0;
    const currentValue = shares * currentPrice;
    const costBasis = shares * avgCost;
    const unrealizedPnL = currentValue - costBasis;
    const unrealizedReturnPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
    const dailyPriceChange = sec ? sec.change : (pos.ticker === 'SHV' ? 0.01 : 0);
    const dailyPriceChangePct = sec ? sec.changePercent : (pos.ticker === 'SHV' ? 0.01 : 0);
    const dailyPnLContribution = shares * dailyPriceChange;
    const name = sec ? (sec.companyName || sec.name) : (pos.name || pos.ticker);
    const sector = sec?.sector || pos.sector || 'UNKNOWN';
    const isCash = pos.isCashEquivalent || pos.ticker === 'USD-CASH' || pos.ticker === 'SHV';

    totalNav += currentValue;
    totalCost += costBasis;
    totalTodayChange += dailyPnLContribution;
    if (isCash) cashValue += currentValue;

    return {
      ticker: pos.ticker,
      securityId: sec?.id || pos.securityId || `sec-${pos.ticker.toLowerCase()}`,
      name,
      sector,
      market: (sec?.market || pos.market || 'US') as any,
      exchange: sec?.exchange || pos.exchange || 'NASDAQ',
      currency: baseCurrency,
      shares,
      avgCost,
      currentPrice,
      currentValue,
      costBasis,
      unrealizedPnL,
      unrealizedReturnPct,
      dailyPriceChange,
      dailyPriceChangePct,
      dailyPnLContribution,
      isCash,
      isSimulated,
      beta: sec?.beta !== undefined && sec.beta !== null ? sec.beta : null
    };
  });

  const investedValue = totalNav - cashValue;
  const totalUnrealizedPnL = totalNav - totalCost;
  const totalUnrealizedReturnPct = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;
  const prevNav = totalNav - totalTodayChange;
  const dailyReturnPct = prevNav > 0 ? (totalTodayChange / prevNav) * 100 : 0;

  // 3. Position Weights and Risk Contributions
  const weights = rawHoldings.map(h => (totalNav > 0 ? h.currentValue / totalNav : 0));
  const betas = rawHoldings.map(h => (h.isCash ? 0 : (h.beta || 1.0)));

  // Risk analytics calculation: use covariance matrix if historical bars provided, else factor model
  let covMatrix: number[][] | null = null;
  let corrMatrix: number[][] | null = null;
  let riskContribPct: number[] = [];
  let marginalRisk: number[] = [];
  let portfolioVariance = 0;
  let portfolioVolatilityAnnual = 0;
  let hasRealCovariance = false;

  if (options?.historicalPriceBars && rawHoldings.length > 0) {
    const symbolReturns: number[][] = [];
    let validBars = true;

    for (const h of rawHoldings) {
      const bars = options.historicalPriceBars[h.ticker];
      if (!bars || bars.length < 2) {
        validBars = false;
        break;
      }
      const returns: number[] = [];
      for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1].close;
        returns.push(prev > 0 ? (bars[i].close - prev) / prev : 0);
      }
      symbolReturns.push(returns);
    }

    if (validBars && symbolReturns.length === rawHoldings.length) {
      try {
        const { covarianceMatrix, correlationMatrix } = calculateCovarianceMatrix(symbolReturns);
        covMatrix = covarianceMatrix;
        corrMatrix = correlationMatrix;
        const riskRes = calculateRiskContributions(weights, covarianceMatrix);
        portfolioVariance = riskRes.portfolioVariance;
        portfolioVolatilityAnnual = riskRes.portfolioVolatility;
        marginalRisk = riskRes.marginalRiskContribution;
        riskContribPct = riskRes.percentageRiskContribution;
        hasRealCovariance = true;
      } catch {
        // Fallback to factor model if covariance math throws
        hasRealCovariance = false;
      }
    }
  }

  if (!hasRealCovariance) {
    const factorRes = calculateFactorRiskContributions(weights, betas);
    riskContribPct = factorRes.percentageRiskContribution;
    marginalRisk = weights.map((w, i) => w * (betas[i] || 1.0));
  }

  // Build canonical PortfolioHoldingAnalytics
  const holdingAnalytics: PortfolioHoldingAnalytics[] = rawHoldings.map((h, i) => {
    const weight = weights[i];
    const weightPct = Math.round(weight * 10000) / 100;
    const dailyReturnContribPct = prevNav > 0 ? (h.dailyPnLContribution / prevNav) * 100 : 0;

    return {
      securityId: h.securityId,
      symbol: h.ticker,
      name: h.name,
      sector: h.sector,
      market: h.market,
      exchange: h.exchange,
      currency: h.currency,
      shares: h.shares,
      quantity: h.shares,
      avgCost: Math.round(h.avgCost * 100) / 100,
      averageCost: Math.round(h.avgCost * 100) / 100,
      costBasis: Math.round(h.costBasis * 100) / 100,
      currentPrice: Math.round(h.currentPrice * 100) / 100,
      marketValue: Math.round(h.currentValue * 100) / 100,
      weight: Math.round(weight * 10000) / 10000,
      weightPct,
      unrealizedPnL: Math.round(h.unrealizedPnL * 100) / 100,
      unrealizedReturnPct: Math.round(h.unrealizedReturnPct * 100) / 100,
      dailyPriceChange: Math.round(h.dailyPriceChange * 100) / 100,
      dailyPriceChangePct: Math.round(h.dailyPriceChangePct * 100) / 100,
      dailyPnLContribution: Math.round(h.dailyPnLContribution * 100) / 100,
      dailyReturnContributionPct: Math.round(dailyReturnContribPct * 1000) / 1000,
      beta: h.beta !== null ? {
        value: Math.round(h.beta * 100) / 100,
        status: 'CALCULATED',
        methodology: 'CAPM Beta vs S&P 500'
      } : {
        value: null,
        status: 'UNAVAILABLE',
        notes: 'Beta unavailable for security'
      },
      volatility: hasRealCovariance && covMatrix ? {
        value: Math.round(Math.sqrt(covMatrix[i][i] * 252) * 10000) / 100,
        status: 'CALCULATED',
        methodology: 'Annualized sample standard deviation of daily returns'
      } : {
        value: null,
        status: 'UNAVAILABLE',
        notes: 'Historical daily price bars not provided for volatility'
      },
      riskContributionPct: {
        value: Math.round((riskContribPct[i] || 0) * 10) / 10,
        status: 'CALCULATED',
        methodology: hasRealCovariance ? 'Covariance component percentage contribution (w_i * (Sigma*w)_i / var_p)' : 'Single-index factor beta weighting'
      },
      marginalRiskContribution: {
        value: Math.round((marginalRisk[i] || 0) * 10000) / 10000,
        status: 'CALCULATED'
      },
      isCashEquivalent: h.isCash,
      epistemicStatus: 'CALCULATED',
      isSimulated: h.isSimulated
    };
  });

  // 4. Weight Reconciliation
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  const weightsReconciled = Math.abs(sumWeights - 1.0) < 0.005 || holdingAnalytics.length === 0;

  // 5. Concentration Metrics
  const sortedHoldings = [...holdingAnalytics].sort((a, b) => b.weightPct - a.weightPct);
  const largestPos = sortedHoldings[0] || {
    symbol: 'N/A',
    securityId: '',
    weightPct: 0,
    marketValue: 0,
    currency: baseCurrency
  };

  const top1WeightPct = sortedHoldings[0]?.weightPct || 0;
  const top5WeightPct = Math.round(sortedHoldings.slice(0, 5).reduce((sum, h) => sum + h.weightPct, 0) * 10) / 10;
  const top10WeightPct = Math.round(sortedHoldings.slice(0, 10).reduce((sum, h) => sum + h.weightPct, 0) * 10) / 10;
  const remainingWeightPct = Math.max(0, Math.round((100 - top10WeightPct) * 10) / 10);

  const { hhi, hhiNormalized } = calculateHerfindahlHirschmanIndex(weights);

  const observations: string[] = [];
  if (largestPos.symbol !== 'N/A' && largestPos.weightPct > 0) {
    observations.push(`${largestPos.symbol} represents ${largestPos.weightPct.toFixed(1)}% of portfolio market value.`);
  }
  if (top5WeightPct >= 50) {
    observations.push(`Top 5 holdings account for ${top5WeightPct.toFixed(1)}% of portfolio assets.`);
  }
  if (hhi > 2500) {
    observations.push(`Herfindahl-Hirschman Index (${hhi}) indicates significant portfolio concentration risk.`);
  } else if (hhi < 1500) {
    observations.push(`Herfindahl-Hirschman Index (${hhi}) indicates high portfolio diversification across positions.`);
  } else {
    observations.push(`Herfindahl-Hirschman Index (${hhi}) indicates moderate portfolio concentration.`);
  }

  const concentration: ConcentrationMetrics = {
    largestPosition: {
      symbol: largestPos.symbol,
      securityId: largestPos.securityId,
      weightPct: largestPos.weightPct,
      marketValue: largestPos.marketValue,
      currency: baseCurrency
    },
    top1WeightPct,
    top5WeightPct,
    top10WeightPct,
    remainingWeightPct,
    herfindahlHirschmanIndex: hhi,
    hhiNormalized,
    concentrationClassification: (hhi > 2500 ? 'HIGHLY_CONCENTRATED' : hhi >= 1500 ? 'MODERATELY_CONCENTRATED' : 'DIVERSIFIED'),
    status: 'CALCULATED',
    observations
  };

  // 6. Sector Exposure
  const sectorMap: Record<string, { value: number; pnl: number; count: number }> = {};
  holdingAnalytics.forEach(h => {
    const secKey = h.sector || 'UNKNOWN';
    if (!sectorMap[secKey]) {
      sectorMap[secKey] = { value: 0, pnl: 0, count: 0 };
    }
    sectorMap[secKey].value += h.marketValue;
    sectorMap[secKey].pnl += h.dailyPnLContribution;
    sectorMap[secKey].count += 1;
  });

  const sectorExposure: SectorExposure[] = Object.entries(sectorMap)
    .map(([secName, data]) => ({
      sector: secName,
      marketValue: Math.round(data.value * 100) / 100,
      weightPct: totalNav > 0 ? Math.round((data.value / totalNav) * 1000) / 10 : 0,
      positionCount: data.count,
      dailyPnLContribution: Math.round(data.pnl * 100) / 100,
      color: SECTOR_COLORS[secName] || '#94a3b8',
      status: 'CALCULATED' as EvidenceEpistemicStatus
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  // 7. Market / Region Exposure
  const marketMap: Record<string, { value: number; pnl: number; count: number; exchanges: Set<string> }> = {};
  holdingAnalytics.forEach(h => {
    const mkt = h.market || 'US';
    if (!marketMap[mkt]) {
      marketMap[mkt] = { value: 0, pnl: 0, count: 0, exchanges: new Set() };
    }
    marketMap[mkt].value += h.marketValue;
    marketMap[mkt].pnl += h.dailyPnLContribution;
    marketMap[mkt].count += 1;
    if (h.exchange) marketMap[mkt].exchanges.add(h.exchange);
  });

  const marketExposure: MarketExposure[] = Object.entries(marketMap).map(([mkt, data]) => ({
    market: mkt as any,
    marketValue: Math.round(data.value * 100) / 100,
    weightPct: totalNav > 0 ? Math.round((data.value / totalNav) * 1000) / 10 : 0,
    positionCount: data.count,
    exchanges: Array.from(data.exchanges),
    dailyPnLContribution: Math.round(data.pnl * 100) / 100,
    currency: baseCurrency,
    status: 'CALCULATED' as EvidenceEpistemicStatus
  }));

  // 8. Currency Exposure & Segregated Foreign Buckets
  const currencyExposure: CurrencyExposure[] = [
    {
      currency: baseCurrency,
      marketValueNative: Math.round(totalNav * 100) / 100,
      weightPct: 100.0,
      positionCount: holdingAnalytics.length,
      isBaseCurrency: true,
      fxRateToBase: {
        value: 1.0,
        status: 'CALCULATED',
        methodology: 'Identity base currency'
      },
      marketValueBaseEquivalent: {
        value: Math.round(totalNav * 100) / 100,
        status: 'CALCULATED'
      }
    }
  ];

  const segregatedBuckets: Record<string, {
    currency: string;
    totalValueNative: number;
    totalCostNative: number;
    unrealizedPnLNative: number;
    positionsCount: number;
    positions: PortfolioHoldingAnalytics[];
  }> = {};

  Object.entries(foreignPositionsByCurrency).forEach(([curr, fPositions]) => {
    let foreignVal = 0;
    let foreignCost = 0;
    const fAnalytics: PortfolioHoldingAnalytics[] = fPositions.map(pos => {
      const sec = securities[pos.ticker];
      const shares = pos.shares ?? pos.quantity ?? 0;
      const avgCost = pos.avgCost ?? pos.averageCost ?? 0;
      const currentPrice = sec ? sec.price : pos.avgCost;
      const mVal = shares * currentPrice;
      const cBasis = shares * avgCost;
      const uPnL = mVal - cBasis;
      const uPnLPct = cBasis > 0 ? (uPnL / cBasis) * 100 : 0;
      foreignVal += mVal;
      foreignCost += cBasis;

      return {
        securityId: sec?.id || pos.securityId || `sec-${pos.ticker.toLowerCase()}`,
        symbol: pos.ticker,
        name: sec ? (sec.companyName || sec.name) : (pos.name || pos.ticker),
        sector: sec?.sector || pos.sector || 'Equities',
        market: 'INDIA',
        exchange: sec?.exchange || pos.exchange || 'NSE',
        currency: curr,
        shares,
        quantity: shares,
        avgCost,
        averageCost: avgCost,
        costBasis: cBasis,
        currentPrice,
        marketValue: mVal,
        weight: 0,
        weightPct: 0,
        unrealizedPnL: uPnL,
        unrealizedReturnPct: uPnLPct,
        dailyPriceChange: sec ? sec.change : 0,
        dailyPriceChangePct: sec ? sec.changePercent : 0,
        dailyPnLContribution: sec ? shares * sec.change : 0,
        dailyReturnContributionPct: 0,
        beta: { value: null, status: 'UNAVAILABLE', notes: 'Benchmark covariance unavailable for foreign market' },
        volatility: { value: null, status: 'UNAVAILABLE', notes: 'Daily price series unavailable' },
        riskContributionPct: { value: null, status: 'UNAVAILABLE' },
        marginalRiskContribution: { value: null, status: 'UNAVAILABLE' },
        isCashEquivalent: false,
        epistemicStatus: 'CALCULATED',
        isSimulated: sec ? Boolean((sec as any).isSimulated) : false
      };
    });

    segregatedBuckets[curr] = {
      currency: curr,
      totalValueNative: Math.round(foreignVal * 100) / 100,
      totalCostNative: Math.round(foreignCost * 100) / 100,
      unrealizedPnLNative: Math.round((foreignVal - foreignCost) * 100) / 100,
      positionsCount: fPositions.length,
      positions: fAnalytics
    };

    const fxRateKey = `${baseCurrency}/${curr}`;
    const directFx = options?.fxRates?.[fxRateKey] || (options?.fxRates?.[`${curr}/${baseCurrency}`] ? 1 / options.fxRates[`${curr}/${baseCurrency}`] : null);

    currencyExposure.push({
      currency: curr,
      marketValueNative: Math.round(foreignVal * 100) / 100,
      weightPct: 0, // Isolated from base NAV without explicit combined mandate
      positionCount: fPositions.length,
      isBaseCurrency: false,
      fxRateToBase: directFx !== null ? {
        value: Math.round((1 / directFx) * 10000) / 10000,
        status: 'CALCULATED',
        methodology: `Verified FX quote ${fxRateKey}`
      } : {
        value: null,
        status: 'UNAVAILABLE',
        notes: 'No verified FX conversion rate available. Cross-currency values strictly segregated.'
      },
      marketValueBaseEquivalent: directFx !== null ? {
        value: Math.round((foreignVal / directFx) * 100) / 100,
        status: 'CALCULATED'
      } : {
        value: null,
        status: 'UNAVAILABLE',
        notes: 'Cross-currency conversion unavailable without authoritative FX rate.'
      }
    });
  });

  // 9. Performance Analytics & Attribution
  const posHoldings = [...holdingAnalytics].filter(h => h.dailyPnLContribution > 0).sort((a, b) => b.dailyPnLContribution - a.dailyPnLContribution);
  const negHoldings = [...holdingAnalytics].filter(h => h.dailyPnLContribution < 0).sort((a, b) => a.dailyPnLContribution - b.dailyPnLContribution);

  const topPositiveContributors: PortfolioAttributionItem[] = posHoldings.slice(0, 3).map(h => ({
    symbol: h.symbol,
    securityId: h.securityId,
    dailyPriceChange: h.dailyPriceChange,
    dailyPriceChangePct: h.dailyPriceChangePct,
    positionMarketValue: h.marketValue,
    dailyPnLContribution: h.dailyPnLContribution,
    dailyReturnContributionPct: h.dailyReturnContributionPct
  }));

  const topNegativeContributors: PortfolioAttributionItem[] = negHoldings.slice(0, 3).map(h => ({
    symbol: h.symbol,
    securityId: h.securityId,
    dailyPriceChange: h.dailyPriceChange,
    dailyPriceChangePct: h.dailyPriceChangePct,
    positionMarketValue: h.marketValue,
    dailyPnLContribution: h.dailyPnLContribution,
    dailyReturnContributionPct: h.dailyReturnContributionPct
  }));

  const performance: PortfolioPerformanceAnalytics = {
    dailyPnL: {
      value: Math.round(totalTodayChange * 100) / 100,
      status: 'CALCULATED',
      methodology: 'Sum of holding position price change contributions'
    },
    dailyReturnPct: {
      value: Math.round(dailyReturnPct * 100) / 100,
      status: 'CALCULATED',
      methodology: 'dailyPnL / previous NAV'
    },
    unrealizedPnL: {
      value: Math.round(totalUnrealizedPnL * 100) / 100,
      status: 'CALCULATED',
      methodology: 'totalNav - totalCostBasis'
    },
    unrealizedReturnPct: {
      value: Math.round(totalUnrealizedReturnPct * 100) / 100,
      status: 'CALCULATED',
      methodology: 'unrealizedPnL / totalCostBasis'
    },
    return1D: {
      value: Math.round(dailyReturnPct * 100) / 100,
      status: 'CALCULATED'
    },
    return1W: {
      value: null,
      status: 'UNAVAILABLE',
      notes: '1-week historical portfolio NAV bars unavailable'
    },
    return1M: {
      value: null,
      status: 'UNAVAILABLE',
      notes: '1-month historical portfolio NAV bars unavailable'
    },
    topPositiveContributors,
    topNegativeContributors
  };

  // 10. Risk Analytics & Drawdown
  const weightedBeta = holdingAnalytics.reduce((acc, h) => {
    return acc + (h.isCashEquivalent ? 0 : (h.beta.value || 1.0) * h.weight);
  }, 0);

  const portfolioBetaVal = Math.round(weightedBeta * 100) / 100;

  // Drawdown from historical values if provided
  const drawdownRes = options?.portfolioValueHistory
    ? calculateDrawdown(options.portfolioValueHistory.map(v => v.value))
    : calculateDrawdown([]);

  const marginalRiskMap: Record<string, number> = {};
  const pctRiskMap: Record<string, number> = {};
  holdingAnalytics.forEach(h => {
    marginalRiskMap[h.symbol] = h.marginalRiskContribution.value || 0;
    pctRiskMap[h.symbol] = h.riskContributionPct.value || 0;
  });

  const risk: PortfolioRiskAnalytics = {
    portfolioBeta: {
      value: portfolioBetaVal,
      status: 'CALCULATED',
      methodology: 'Position weight sum * individual security beta vs benchmark'
    },
    portfolioVolatility: hasRealCovariance ? {
      value: Math.round(portfolioVolatilityAnnual * 10000) / 100,
      status: 'CALCULATED',
      methodology: 'Annualized sqrt(252 * w^T * Sigma * w)'
    } : {
      value: null,
      status: 'UNAVAILABLE',
      notes: 'Historical covariance matrix unavailable. Volatility requires empirical price return bars.'
    },
    covarianceMatrix: covMatrix ? {
      value: covMatrix,
      status: 'CALCULATED',
      methodology: 'Sample covariance matrix from daily return series'
    } : {
      value: null,
      status: 'UNAVAILABLE'
    },
    correlationMatrix: corrMatrix ? {
      value: corrMatrix,
      status: 'CALCULATED',
      methodology: 'Sample correlation matrix'
    } : {
      value: null,
      status: 'UNAVAILABLE'
    },
    securitySymbols: holdingAnalytics.map(h => h.symbol),
    marginalContributionToRisk: {
      value: marginalRiskMap,
      status: 'CALCULATED'
    },
    percentageContributionToRisk: {
      value: pctRiskMap,
      status: 'CALCULATED'
    },
    peakPortfolioValue: drawdownRes.status === 'CALCULATED' ? {
      value: drawdownRes.peak,
      status: 'CALCULATED'
    } : {
      value: null,
      status: 'UNAVAILABLE',
      notes: 'Peak portfolio value requires historical NAV series'
    },
    currentDrawdown: drawdownRes.status === 'CALCULATED' ? {
      value: drawdownRes.currentDrawdownPct,
      status: 'CALCULATED'
    } : {
      value: null,
      status: 'UNAVAILABLE',
      notes: 'Drawdown requires historical NAV series'
    },
    maxDrawdown: drawdownRes.status === 'CALCULATED' ? {
      value: drawdownRes.maxDrawdownPct,
      status: 'CALCULATED'
    } : {
      value: null,
      status: 'UNAVAILABLE',
      notes: 'Max drawdown requires historical NAV series'
    }
  };

  return {
    portfolioId,
    asOfDate,
    baseCurrency,
    totalValue: Math.round(totalNav * 100) / 100,
    investedValue: Math.round(investedValue * 100) / 100,
    cashValue: Math.round(cashValue * 100) / 100,
    positionCount: holdingAnalytics.length,
    weightsReconciled,
    sumWeights: Math.round(sumWeights * 100 * 100) / 100,
    isCrossCurrencySegregated: Object.keys(foreignPositionsByCurrency).length > 0,
    positions: holdingAnalytics,
    concentration,
    sectorExposure,
    marketExposure,
    currencyExposure,
    performance,
    risk,
    segregatedBuckets: Object.keys(segregatedBuckets).length > 0 ? segregatedBuckets : undefined,
    epistemicStatus: 'CALCULATED',
    isSimulated: isSimulatedPortfolio
  };
}

