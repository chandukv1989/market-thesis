/**
 * Dedicated Research Engine Abstraction (Phase 7A)
 * 
 * Provides an isolated contract for research synthesis over verified application evidence.
 * Decouples client components from LLM provider implementations.
 */

import {
  ResearchRequest,
  ResearchResponse,
  ResearchAnalysisType,
  ResearchEvidenceItem,
  SecurityIdentifier
} from '../../../src/types';
import { financialDataService } from '../financialDataService';

export interface ResearchEngine {
  analyze(request: ResearchRequest): Promise<ResearchResponse>;
  getEngineName(): string;
  isConfigured(): boolean;
}

/**
 * Classifies research queries into canonical analysis types
 */
export function classifyAnalysisType(query: string, securities: SecurityIdentifier[]): ResearchAnalysisType {
  const q = (query || '').toLowerCase().trim();

  // 1. Portfolio Context & Impact
  if (q.includes('impact on portfolio') || q.includes('portfolio impact') || q.includes('risk contribution impact')) {
    return 'PORTFOLIO_IMPACT';
  }
  if (q.includes('portfolio') || q.includes('my holding') || q.includes('my position') || q.includes('allocation')) {
    return 'PORTFOLIO_CONTEXT';
  }

  // 2. Comparison (multiple securities or explicit compare keywords)
  if (
    securities.length >= 2 ||
    q.includes('compare') ||
    q.includes('versus') ||
    q.includes(' vs ') ||
    q.includes(' vs. ') ||
    q.includes('difference between')
  ) {
    return 'COMPARISON';
  }

  // 3. Quantitative Signal Explanation
  if (q.includes('quant signal') || q.includes('strategy signal') || q.includes('quantitative signal') || q.includes('backtest') || q.includes('indicator agree')) {
    return 'QUANT_SIGNAL_EXPLANATION';
  }

  // 4. Investment Thesis / Invalidation
  if (q.includes('investment thesis') || q.includes('invalidation') || q.includes('invalidate') || q.includes('core thesis')) {
    return 'INVESTMENT_THESIS';
  }

  // 5. Bull Case & Bear Case
  if (q.includes('bull case') || q.includes('upside case') || q.includes('bullish case')) {
    return 'BULL_CASE';
  }
  if (q.includes('bear case') || q.includes('downside case') || q.includes('bearish case')) {
    return 'BEAR_CASE';
  }

  // 6. Catalysts
  if (q.includes('catalyst') || q.includes('upcoming catalyst') || q.includes('near-term catalyst')) {
    return 'CATALYSTS';
  }

  // 7. Recent Changes / What Changed
  if (q.includes('what changed') || q.includes('recent change') || q.includes('last two quarters') || q.includes('changed in the last')) {
    return 'RECENT_CHANGES';
  }

  // 8. Valuation
  if (q.includes('valuation') || q.includes('undervalued') || q.includes('overvalued') || q.includes('fair value') || q.includes('dcf') || q.includes('p/e ratio')) {
    return 'VALUATION';
  }

  // 9. Growth
  if (q.includes('growth') || q.includes('revenue acceleration') || q.includes('expansion trajectory')) {
    return 'GROWTH';
  }

  // 10. Management & Commentary
  if (q.includes('management') || q.includes('guidance') || q.includes('ceo') || q.includes('commentary') || q.includes('management saying')) {
    return 'MANAGEMENT';
  }

  // 11. Competitive Position & Moat
  if (q.includes('competitive') || q.includes('moat') || q.includes('market share') || q.includes('competitor')) {
    return 'COMPETITIVE_POSITION';
  }

  // 12. Earnings
  if (q.includes('earnings') || q.includes('quarterly result') || q.includes('eps') || q.includes('quarterly beat')) {
    return 'EARNINGS';
  }

  // 13. Why Moved (price action, earnings reaction, dip, rally)
  if (
    q.includes('why is') ||
    q.includes('why did') ||
    q.includes('down today') ||
    q.includes('up today') ||
    q.includes('falling') ||
    q.includes('dropping') ||
    q.includes('surging') ||
    q.includes('plunging') ||
    q.includes('selloff') ||
    q.includes('rally') ||
    q.includes('moving') ||
    q.includes('moved')
  ) {
    return 'WHY_MOVED';
  }

  // 14. Fundamentals
  if (
    q.includes('fundamental') ||
    q.includes('revenue') ||
    q.includes('income') ||
    q.includes('margin') ||
    q.includes('cash flow') ||
    q.includes('balance sheet') ||
    q.includes('10-k') ||
    q.includes('10-q') ||
    q.includes('sec filing')
  ) {
    return 'FUNDAMENTALS';
  }

  // 15. Risk Analysis
  if (
    q.includes('risk') ||
    q.includes('threat') ||
    q.includes('downside') ||
    q.includes('headwind') ||
    q.includes('vulnerability')
  ) {
    return 'RISK_ANALYSIS';
  }

  // 16. Company Analysis / Overview / Thesis
  if (
    q.includes('analyze') ||
    q.includes('deep dive') ||
    q.includes('overview') ||
    q.includes('thesis') ||
    q.includes('business model')
  ) {
    return 'COMPANY_ANALYSIS';
  }

  return 'GENERAL_ANALYSIS';
}

/**
 * Evidence Gatherer
 * 
 * Assembles factual evidence from actual application state and active providers.
 * Strictly labels source provenance, epistemic status, and distinguishes REAL vs SIMULATED vs UNAVAILABLE.
 * Never invents evidence.
 */
export async function gatherEvidenceForSecurities(
  securities: SecurityIdentifier[],
  query: string,
  portfolioContext?: ResearchRequest['context']['portfolioContext']
): Promise<ResearchEvidenceItem[]> {
  const evidenceItems: ResearchEvidenceItem[] = [];
  const now = new Date().toISOString();

  // 1. Canonical Security Metadata Evidence
  for (const sec of securities) {
    evidenceItems.push({
      id: `ev-meta-${sec.symbol.toLowerCase()}-${sec.exchange.toLowerCase()}`,
      securityId: sec.id,
      symbol: sec.symbol,
      sourceType: 'CANONICAL_METADATA',
      provider: 'Canonical Security Registry',
      epistemicStatus: 'REAL',
      isSimulated: false,
      retrievedAt: now,
      description: `Canonical registration for ${sec.companyName} (${sec.symbol} on ${sec.exchange}, Country: ${sec.country || 'US'}, Currency: ${sec.currency})`,
      data: {
        symbol: sec.symbol,
        companyName: sec.companyName,
        market: sec.market,
        exchange: sec.exchange,
        currency: sec.currency,
        country: sec.country,
        sector: sec.sector,
        industry: sec.industry,
        isin: sec.isin
      }
    });
  }

  // 2. Real / Simulated Market Quotes
  for (const sec of securities) {
    try {
      const quote = await financialDataService.getQuote({
        symbol: sec.symbol,
        market: sec.market,
        exchange: sec.exchange
      });

      const isSimulated = quote.isSimulated ?? (quote.epistemicStatus === 'SIMULATED');
      const epistemicStatus = quote.epistemicStatus || (isSimulated ? 'SIMULATED' : 'REAL');

      evidenceItems.push({
        id: `ev-quote-${sec.symbol.toLowerCase()}`,
        securityId: sec.id,
        symbol: sec.symbol,
        sourceType: 'MARKET_DATA',
        provider: quote.provider || (sec.market === 'US' ? 'Twelve Data' : 'India Market Provider'),
        epistemicStatus: epistemicStatus as 'REAL' | 'SIMULATED' | 'UNAVAILABLE',
        isSimulated,
        retrievedAt: quote.retrievedAt || now,
        description: `Market quote for ${sec.symbol}: Price ${quote.price} ${quote.currency}, Change ${quote.change >= 0 ? '+' : ''}${quote.change} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent?.toFixed(2)}%) on ${quote.exchange}. Epistemic Status: ${epistemicStatus}${isSimulated ? ' (SIMULATED - Not verified live quote)' : ''}.`,
        data: {
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          currency: quote.currency,
          exchange: quote.exchange,
          providerTimestamp: quote.asOf || quote.retrievedAt,
          epistemicStatus,
          isSimulated
        }
      });
    } catch (err: unknown) {
      evidenceItems.push({
        id: `ev-quote-${sec.symbol.toLowerCase()}-unavailable`,
        securityId: sec.id,
        symbol: sec.symbol,
        sourceType: 'MARKET_DATA',
        provider: sec.market === 'US' ? 'Twelve Data' : 'India Market Provider',
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        retrievedAt: now,
        description: `Market quote for ${sec.symbol} is currently UNAVAILABLE.`,
        data: null
      });
    }
  }

  // 3. SEC EDGAR Normalized Financial Facts (for US securities)
  for (const sec of securities) {
    if (sec.market === 'US') {
      try {
        const financials = await financialDataService.getSecurityFinancials(sec.symbol);
        if (financials && financials.facts && financials.facts.length > 0) {
          // Select key grounded facts (revenue, net income, EPS, gross profit, cash)
          const keyMetrics = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'NetIncomeLoss', 'EarningsPerShareDiluted', 'GrossProfit', 'CashAndCashEquivalentsAtCarryingValue'];
          const matchedFacts = financials.facts.filter(f => keyMetrics.includes(f.metric) || f.label.toLowerCase().includes('revenue') || f.label.toLowerCase().includes('net income'));

          for (const fact of matchedFacts.slice(0, 10)) {
            evidenceItems.push({
              id: `ev-sec-fact-${sec.symbol.toLowerCase()}-${fact.metric.toLowerCase()}-${fact.fiscalPeriod || 'FY'}`,
              securityId: sec.id,
              symbol: sec.symbol,
              sourceType: 'SEC_EDGAR',
              provider: 'SEC EDGAR',
              epistemicStatus: 'REAL',
              isSimulated: false,
              retrievedAt: fact.retrievedAt || now,
              filingDate: fact.filedDate,
              accessionNumber: fact.accessionNumber,
              description: `SEC Form ${fact.form || '10-Q/10-K'} verified filing: ${fact.label} = ${fact.value.toLocaleString()} ${fact.unit} for period ${fact.fiscalPeriod || ''} ${fact.fiscalYear || ''} (Filed: ${fact.filedDate || 'N/A'}, Accession: ${fact.accessionNumber || 'SEC-XBRL'}).`,
              data: {
                metric: fact.metric,
                label: fact.label,
                value: fact.value,
                unit: fact.unit,
                fiscalYear: fact.fiscalYear,
                fiscalPeriod: fact.fiscalPeriod,
                form: fact.form,
                filedDate: fact.filedDate,
                accessionNumber: fact.accessionNumber,
                sourceUrl: fact.sourceUrl
              }
            });
          }
        }

        // Recent verified filings list
        const filings = await financialDataService.getRecentFilings(sec.symbol);
        if (filings && filings.length > 0) {
          for (const filing of filings.slice(0, 3)) {
            evidenceItems.push({
              id: `ev-sec-filing-${sec.symbol.toLowerCase()}-${filing.form.toLowerCase()}`,
              securityId: sec.id,
              symbol: sec.symbol,
              sourceType: 'SEC_EDGAR',
              provider: 'SEC EDGAR',
              epistemicStatus: 'REAL',
              isSimulated: false,
              retrievedAt: now,
              filingDate: filing.filingDate,
              accessionNumber: filing.accessionNumber,
              description: `Verified SEC filing ${filing.form} for ${sec.symbol} filed on ${filing.filingDate}. Primary doc: ${filing.primaryDocument || 'filing.htm'} (Accession: ${filing.accessionNumber}).`,
              data: {
                form: filing.form,
                filingDate: filing.filingDate,
                reportDate: filing.reportDate,
                accessionNumber: filing.accessionNumber,
                primaryDocument: filing.primaryDocument
              }
            });
          }
        }
      } catch (err: unknown) {
        // SEC data unavailable or error
        evidenceItems.push({
          id: `ev-sec-${sec.symbol.toLowerCase()}-unavailable`,
          securityId: sec.id,
          symbol: sec.symbol,
          sourceType: 'SEC_EDGAR',
          provider: 'SEC EDGAR',
          epistemicStatus: 'UNAVAILABLE',
          isSimulated: false,
          retrievedAt: now,
          description: `SEC EDGAR facts for ${sec.symbol} are currently UNAVAILABLE.`,
          data: null
        });
      }
    } else if (sec.market === 'INDIA') {
      // SEC not applicable to Indian equities
      evidenceItems.push({
        id: `ev-sec-${sec.symbol.toLowerCase()}-not-applicable`,
        securityId: sec.id,
        symbol: sec.symbol,
        sourceType: 'SEC_EDGAR',
        provider: 'SEC EDGAR',
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        retrievedAt: now,
        description: `SEC EDGAR filings are NOT APPLICABLE to non-US Indian equities listed on ${sec.exchange}. Statutory reporting follows Indian SEBI / Exchange disclosures.`,
        data: null
      });
    }
  }

  // 4. Portfolio Context Evidence (if provided)
  if (portfolioContext?.holdings && portfolioContext.holdings.length > 0) {
    for (const h of portfolioContext.holdings) {
      // Include if it matches one of the requested securities or if general portfolio query
      const isRelevant = securities.length === 0 || securities.some(s => s.symbol === h.symbol || s.id === h.securityId);
      if (isRelevant) {
        evidenceItems.push({
          id: `ev-port-${h.symbol.toLowerCase()}`,
          securityId: h.securityId,
          symbol: h.symbol,
          sourceType: 'PORTFOLIO',
          provider: 'Internal Portfolio Ledger',
          epistemicStatus: 'CALCULATED',
          isSimulated: false,
          retrievedAt: now,
          description: `Portfolio position in ${h.symbol}: ${h.shares} shares @ avg cost ${h.averageCost}, current price ${h.currentPrice}, weight ${h.weightPct?.toFixed(2)}% of NAV, unrealized P&L ${h.unrealizedPnL >= 0 ? '+' : ''}${h.unrealizedPnL}.`,
          data: {
            shares: h.shares,
            averageCost: h.averageCost,
            currentPrice: h.currentPrice,
            weightPct: h.weightPct,
            unrealizedPnL: h.unrealizedPnL,
            totalNav: portfolioContext.totalNav
          }
        });
      }
    }
  }

  return evidenceItems;
}
