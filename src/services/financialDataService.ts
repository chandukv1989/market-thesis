/**
 * Client-Side Financial Data Service
 * Safely calls server-side financial provider endpoints to retrieve
 * SEC EDGAR facts, filings, and quotes without exposing internal API details.
 */

import {
  DataSourcesHealth,
  FinancialFact,
  FilingRecord,
  NormalizedQuote,
  MarketDataRequest,
  HistoricalPricesRequest,
  HistoricalPricesResponse,
  SearchResult,
  ResearchResponse,
  ResearchAnalysisType,
  ResearchPortfolioHoldingContext,
  RetrievalResult,
  EvidenceQuery,
  ResearchNotebook,
  ResearchSourceItem,
  SourceCoverage,
  ResearchSnapshot,
  ResearchQueryType,
  ResearchDocument,
  DocumentUploadRequest,
  DocumentUploadResult,
  DocumentRegistryStats,
  ResearchSourceFilter
} from '../types';
import { classifyAndResolve } from './searchIntelligence';

export interface ClientFinancialsResponse {
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

export class FinancialDataClient {
  public async getDataSourcesHealth(): Promise<DataSourcesHealth | null> {
    try {
      const res = await fetch('/api/data-status');
      if (!res.ok) return null;
      return (await res.json()) as DataSourcesHealth;
    } catch {
      return null;
    }
  }

  public async getSecurityFinancials(ticker: string): Promise<ClientFinancialsResponse | null> {
    try {
      const res = await fetch(`/api/sec/financials/${encodeURIComponent(ticker.toUpperCase())}`);
      if (!res.ok) return null;
      return (await res.json()) as ClientFinancialsResponse;
    } catch {
      return null;
    }
  }

  public async getRecentFilings(ticker: string): Promise<FilingRecord[]> {
    try {
      const res = await fetch(`/api/sec/filings/${encodeURIComponent(ticker.toUpperCase())}`);
      if (!res.ok) return [];
      return (await res.json()) as FilingRecord[];
    } catch {
      return [];
    }
  }

  public async getQuote(requestOrTicker: MarketDataRequest | string): Promise<NormalizedQuote | null> {
    try {
      const ticker = typeof requestOrTicker === 'string' ? requestOrTicker : requestOrTicker.symbol;
      const market = typeof requestOrTicker === 'object' ? requestOrTicker.market : undefined;
      const exchange = typeof requestOrTicker === 'object' ? requestOrTicker.exchange : undefined;

      const queryParams = new URLSearchParams();
      if (market) queryParams.set('market', market);
      if (exchange) queryParams.set('exchange', exchange);
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await fetch(`/api/market/quote/${encodeURIComponent(ticker.toUpperCase())}${queryStr}`);
      if (!res.ok) return null;
      return (await res.json()) as NormalizedQuote;
    } catch {
      return null;
    }
  }

  public async getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse | null> {
    try {
      const ticker = request.symbol;
      const queryParams = new URLSearchParams();
      if (request.market) queryParams.set('market', request.market);
      if (request.exchange) queryParams.set('exchange', request.exchange);
      if (request.period) queryParams.set('period', request.period);
      if (request.interval) queryParams.set('interval', request.interval);
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await fetch(`/api/market/history/${encodeURIComponent(ticker.toUpperCase())}${queryStr}`);
      if (!res.ok) return null;
      return (await res.json()) as HistoricalPricesResponse;
    } catch {
      return null;
    }
  }

  public async search(query: string): Promise<SearchResult> {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        return classifyAndResolve(query);
      }
      return (await res.json()) as SearchResult;
    } catch {
      return classifyAndResolve(query);
    }
  }

  public async clearCache(): Promise<boolean> {
    try {
      const res = await fetch('/api/sec/cache/clear', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async analyzeResearch(params: {
    query: string;
    securityIds?: string[];
    analysisType?: ResearchAnalysisType;
    portfolioContext?: {
      holdings?: ResearchPortfolioHoldingContext[];
      totalNav?: number;
    };
  }): Promise<ResearchResponse> {
    const res = await fetch('/api/research/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Research request failed' }));
      throw new Error(errData.message || errData.error || `HTTP ${res.status}: Failed to synthesize research`);
    }

    return (await res.json()) as ResearchResponse;
  }

  public async getResearchEngineStatus(): Promise<{ engine: string; isConfigured: boolean }> {
    try {
      const res = await fetch('/api/research/status');
      if (!res.ok) return { engine: 'Unavailable', isConfigured: false };
      return await res.json();
    } catch {
      return { engine: 'Unavailable', isConfigured: false };
    }
  }

  public async searchEvidence(params: EvidenceQuery): Promise<RetrievalResult> {
    const res = await fetch('/api/evidence/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Search failed' }));
      throw new Error(err.message || err.error || 'Failed to search evidence');
    }

    return (await res.json()) as RetrievalResult;
  }

  // ==========================================
  // PHASE 13: INVESTMENT RESEARCH NOTEBOOK CLIENT
  // ==========================================

  public async getResearchNotebook(securityId: string, asOfDate?: string): Promise<ResearchNotebook> {
    const query = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
    const res = await fetch(`/api/research/notebook/${encodeURIComponent(securityId)}${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load notebook' }));
      throw new Error(err.message || err.error || 'Failed to load research notebook');
    }
    return (await res.json()) as ResearchNotebook;
  }

  public async getNotebookSources(securityId: string, asOfDate?: string): Promise<ResearchSourceItem[]> {
    const query = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
    const res = await fetch(`/api/research/notebook/${encodeURIComponent(securityId)}/sources${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sources || []) as ResearchSourceItem[];
  }

  public async getNotebookCoverage(securityId: string, asOfDate?: string): Promise<SourceCoverage> {
    const query = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
    const res = await fetch(`/api/research/notebook/${encodeURIComponent(securityId)}/coverage${query}`);
    if (!res.ok) {
      throw new Error('Failed to retrieve source coverage');
    }
    return (await res.json()) as SourceCoverage;
  }

  public async executeResearchNotebook(
    securityId: string,
    params: {
      queryType?: ResearchQueryType;
      customQuery?: string;
      asOfDate?: string;
      portfolioContext?: any;
      sourceFilter?: ResearchSourceFilter;
    }
  ): Promise<ResearchSnapshot> {
    const res = await fetch(`/api/research/notebook/${encodeURIComponent(securityId)}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Research execution failed' }));
      throw new Error(err.message || err.error || 'Failed to execute research');
    }
    return (await res.json()) as ResearchSnapshot;
  }

  public async getNotebookSnapshots(securityId: string): Promise<ResearchSnapshot[]> {
    const res = await fetch(`/api/research/notebook/${encodeURIComponent(securityId)}/snapshots`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.snapshots || []) as ResearchSnapshot[];
  }

  public async getResearchSnapshot(snapshotId: string): Promise<ResearchSnapshot> {
    const res = await fetch(`/api/research/snapshot/${encodeURIComponent(snapshotId)}`);
    if (!res.ok) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    return (await res.json()) as ResearchSnapshot;
  }

  // ==========================================
  // PHASE 14: RESEARCH DOCUMENT INTELLIGENCE CLIENT
  // ==========================================

  public async uploadDocument(request: DocumentUploadRequest): Promise<DocumentUploadResult> {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload and parse document');
    }
    return data as DocumentUploadResult;
  }

  public async validateDocument(request: DocumentUploadRequest): Promise<{ valid: boolean; format: string; error?: string; metadata?: any }> {
    const res = await fetch('/api/documents/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to validate document');
    }
    return data;
  }

  public async getDocuments(securityId?: string): Promise<ResearchDocument[]> {
    const query = securityId ? `?securityId=${encodeURIComponent(securityId)}` : '';
    const res = await fetch(`/api/documents${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || []) as ResearchDocument[];
  }

  public async getDocument(documentId: string): Promise<ResearchDocument> {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
    if (!res.ok) {
      throw new Error(`Document ${documentId} not found`);
    }
    return (await res.json()) as ResearchDocument;
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.success;
  }

  public async getDocumentStats(): Promise<DocumentRegistryStats> {
    const res = await fetch('/api/documents/stats');
    if (!res.ok) {
      throw new Error('Failed to retrieve document registry stats');
    }
    return (await res.json()) as DocumentRegistryStats;
  }
}

export const financialClient = new FinancialDataClient();
