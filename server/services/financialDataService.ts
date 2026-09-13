/**
 * Server-Side Financial Data Service
 * Orchestrates SEC EDGAR and Multi-Market Data providers, tracks provider health,
 * and normalizes financial intelligence into canonical domain records.
 */

import { secEdgarProvider } from '../providers/secEdgarProvider';
import { marketDataProvider } from '../providers/marketDataProvider';
import { NormalizedFinancialsResult } from '../providers/types';
import {
  DataSourcesHealth,
  NormalizedQuote,
  FilingRecord,
  MarketDataRequest,
  HistoricalPricesRequest,
  HistoricalPricesResponse,
  MarketStatusRequest,
  MarketStatusResponse
} from '../../src/types';

export class FinancialDataService {
  public async getSecurityFinancials(ticker: string): Promise<NormalizedFinancialsResult> {
    return secEdgarProvider.getFinancialFacts(ticker);
  }

  public async getRecentFilings(ticker: string): Promise<FilingRecord[]> {
    return secEdgarProvider.getRecentFilings(ticker);
  }

  public async getSECSubmissions(ticker: string) {
    return secEdgarProvider.getCompanySubmissions(ticker);
  }

  public async getSECCompanyFacts(ticker: string) {
    return secEdgarProvider.getCompanyFacts(ticker);
  }

  public async getQuote(requestOrTicker: MarketDataRequest | string): Promise<NormalizedQuote> {
    return marketDataProvider.getQuote(requestOrTicker);
  }

  public async getQuotes(requests: (MarketDataRequest | string)[]): Promise<NormalizedQuote[]> {
    return marketDataProvider.getQuotes(requests);
  }

  public async getHistoricalPrices(request: HistoricalPricesRequest): Promise<HistoricalPricesResponse> {
    return marketDataProvider.getHistoricalPrices(request);
  }

  public async getMarketStatus(request: MarketStatusRequest): Promise<MarketStatusResponse> {
    return marketDataProvider.getMarketStatus(request);
  }

  public getDataSourcesHealth(): DataSourcesHealth {
    const regional = marketDataProvider.getRegionalHealth();
    return {
      secEdgar: secEdgarProvider.getHealthStatus(),
      marketData: marketDataProvider.getHealthStatus(),
      usMarketData: regional.us,
      indiaMarketData: regional.india,
      fyersMarketData: marketDataProvider.indiaProvider.fyersProvider.getHealthStatus(),
      trueDataMarketData: {
        name: 'India Market Data (TrueData)',
        status: marketDataProvider.indiaProvider.isTrueDataConfigured() ? 'Connected' : 'UNCONFIGURED',
        lastSuccessfulRetrieval: null,
        dataFreshness: marketDataProvider.indiaProvider.isTrueDataConfigured() ? 'TrueData Configured' : 'TrueData Unconfigured',
        isSimulated: !marketDataProvider.indiaProvider.isTrueDataConfigured()
      }
    };
  }

  public clearCache(): void {
    secEdgarProvider.clearCache();
    marketDataProvider.clearCache();
  }
}

export const financialDataService = new FinancialDataService();
