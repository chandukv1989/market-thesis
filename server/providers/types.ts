/**
 * Financial Data Provider Interfaces and Types (Server-side)
 */

import {
  FinancialFact,
  FilingRecord,
  NormalizedQuote,
  ProviderHealth,
  DataSourcesHealth,
  MarketDataRequest,
  MarketStatusRequest,
  MarketStatusResponse,
  HistoricalPricePoint,
  HistoricalPricesRequest,
  HistoricalPriceBar,
  HistoricalPricesResponse,
  EpistemicStatus
} from '../../src/types';

export interface SECSubmissionsResponse {
  cik: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  fiscalYearEnd?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      act: string[];
      form: string[];
      fileNumber: string[];
      filmNumber: string[];
      items: string[];
      size: number[];
      isXBRL: number[];
      isInlineXBRL: number[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

export interface SECCompanyFactsResponse {
  cik: number;
  entityName: string;
  facts: {
    'us-gaap'?: Record<string, SECXBRLConcept>;
    'dei'?: Record<string, SECXBRLConcept>;
    'ifrs-full'?: Record<string, SECXBRLConcept>;
  };
}

export interface SECXBRLConcept {
  label: string;
  description: string;
  units: {
    USD?: SECXBRLUnitItem[];
    shares?: SECXBRLUnitItem[];
    pure?: SECXBRLUnitItem[];
    [unit: string]: SECXBRLUnitItem[] | undefined;
  };
}

export interface SECXBRLUnitItem {
  end: string;
  val: number;
  fy?: number;
  fp?: string; // 'Q1', 'Q2', 'Q3', 'Q4', 'FY'
  form?: string; // '10-K', '10-Q', '20-F'
  filed?: string;
  frame?: string;
  start?: string;
  accn: string;
}

export interface NormalizedFinancialsResult {
  ticker: string;
  cik: string;
  companyName: string;
  retrievedAt: string;
  isSimulated: boolean;
  facts: FinancialFact[];
  filings: FilingRecord[];
  derivedQuarters: {
    period: string;
    fiscalYear?: number | string;
    fiscalPeriod?: string;
    revenue: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingIncome: number;
    netIncome: number;
    operatingCashFlow: number;
    capex: number;
    freeCashFlow: number;
    form: string;
    filedDate: string;
    accessionNumber: string;
    sourceUrl: string;
    isSimulated: boolean;
  }[];
  summaryMetrics: {
    latestAnnualRevenue?: number;
    latestQuarterlyRevenue?: number;
    latestGrossMarginPct?: number;
    latestOperatingMarginPct?: number;
    latestFCF?: number;
    sharesOutstanding?: number;
    totalAssets?: number;
    totalLiabilities?: number;
    cashAndEquivalents?: number;
    totalDebt?: number;
  };
  provenance: {
    primarySource: string;
    sourceType: string;
    cik: string;
    recordsCount: number;
    retrievedAt: string;
  };
}

export interface SECDataProvider {
  resolveCIK(ticker: string): string | null;
  getCompanySubmissions(ticker: string): Promise<SECSubmissionsResponse>;
  getCompanyFacts(ticker: string): Promise<SECCompanyFactsResponse>;
  getFinancialFacts(ticker: string): Promise<NormalizedFinancialsResult>;
  getRecentFilings(ticker: string): Promise<FilingRecord[]>;
  getHealthStatus(): ProviderHealth;
}

export interface MarketDataProvider {
  getQuote(request: MarketDataRequest | string): Promise<NormalizedQuote>;
  getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse>;
  getMarketStatus(request: MarketStatusRequest): Promise<MarketStatusResponse>;
  getHealthStatus(): ProviderHealth;
  getProviderHealth(): ProviderHealth;
  getRegionalHealth(): { us: ProviderHealth; india: ProviderHealth };
}

export interface RegionalMarketProvider {
  readonly market: 'US' | 'INDIA' | 'GLOBAL';
  readonly supportedExchanges: string[];
  getQuote(request: MarketDataRequest): Promise<NormalizedQuote>;
  getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse>;
  getMarketStatus(exchange?: string): Promise<MarketStatusResponse>;
  getHealthStatus(): ProviderHealth;
}
