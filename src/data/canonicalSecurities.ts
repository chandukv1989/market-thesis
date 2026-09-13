/**
 * Canonical Securities Registry and Multi-Market Resolver
 * 
 * Provides canonical security identities across US and Indian equities.
 * Universal identity combines Security ID, Market, Exchange, and Currency
 * rather than relying solely on the ticker symbol.
 */

import { SecurityIdentifier, MarketRegion, SearchSecurityMatch, SearchMatchType } from '../types';

export const CANONICAL_SECURITIES: SecurityIdentifier[] = [
  // ==========================================
  // US EQUITIES (NASDAQ / NYSE)
  // ==========================================
  {
    id: 'us-nvda',
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    country: 'US',
    currency: 'USD',
    isin: 'US67066G1040',
    sector: 'Technology',
    industry: 'Semiconductors',
    assetType: 'EQUITY'
  },
  {
    id: 'us-msft',
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    country: 'US',
    currency: 'USD',
    isin: 'US5949181045',
    sector: 'Technology',
    industry: 'Infrastructure & Cloud Software',
    assetType: 'EQUITY'
  },
  {
    id: 'us-asml',
    symbol: 'ASML',
    companyName: 'ASML Holding N.V.',
    market: 'US',
    exchange: 'NASDAQ',
    country: 'NL',
    currency: 'USD',
    isin: 'USN070592100',
    sector: 'Technology',
    industry: 'Semiconductor Equipment',
    assetType: 'EQUITY'
  },
  {
    id: 'us-tsm',
    symbol: 'TSM',
    companyName: 'Taiwan Semiconductor Manufacturing Co.',
    market: 'US',
    exchange: 'NYSE',
    country: 'TW',
    currency: 'USD',
    isin: 'US8740391003',
    sector: 'Technology',
    industry: 'Pure-Play Foundry',
    assetType: 'EQUITY'
  },
  {
    id: 'us-avgo',
    symbol: 'AVGO',
    companyName: 'Broadcom Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    country: 'US',
    currency: 'USD',
    isin: 'US11135F1012',
    sector: 'Technology',
    industry: 'Custom Silicon & Enterprise Infrastructure',
    assetType: 'EQUITY'
  },
  {
    id: 'us-amzn',
    symbol: 'AMZN',
    companyName: 'Amazon.com, Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    country: 'US',
    currency: 'USD',
    isin: 'US0231351067',
    sector: 'Consumer Discretionary',
    industry: 'Cloud Computing & Digital Commerce',
    assetType: 'EQUITY'
  },
  {
    id: 'us-aapl',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    country: 'US',
    currency: 'USD',
    isin: 'US0378331005',
    sector: 'Technology',
    industry: 'Consumer Technology Ecosystem',
    assetType: 'EQUITY'
  },
  {
    id: 'us-pltr',
    symbol: 'PLTR',
    companyName: 'Palantir Technologies Inc.',
    market: 'US',
    exchange: 'NYSE',
    country: 'US',
    currency: 'USD',
    isin: 'US69608A1088',
    sector: 'Technology',
    industry: 'Enterprise AI & Defense Analytics',
    assetType: 'EQUITY'
  },
  {
    id: 'us-lly',
    symbol: 'LLY',
    companyName: 'Eli Lilly and Company',
    market: 'US',
    exchange: 'NYSE',
    country: 'US',
    currency: 'USD',
    isin: 'US5324571083',
    sector: 'Healthcare & Bio',
    industry: 'Pharmaceuticals & Metabolic Therapeutics',
    assetType: 'EQUITY'
  },
  {
    id: 'us-jpm',
    symbol: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    market: 'US',
    exchange: 'NYSE',
    country: 'US',
    currency: 'USD',
    isin: 'US46625H1005',
    sector: 'Financial Services',
    industry: 'Diversified Global Banking',
    assetType: 'EQUITY'
  },

  // ==========================================
  // INDIAN EQUITIES (NSE / BSE)
  // ==========================================
  {
    id: 'in-reliance',
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE002A01018',
    sector: 'Energy & Conglomerates',
    industry: 'Refining, Petrochemicals, Telecom & Retail',
    assetType: 'EQUITY'
  },
  {
    id: 'in-hdfcbank',
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE040A01034',
    sector: 'Financial Services',
    industry: 'Private Sector Commercial Banking',
    assetType: 'EQUITY'
  },
  {
    id: 'in-icicibank',
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE090A01021',
    sector: 'Financial Services',
    industry: 'Private Sector Commercial Banking',
    assetType: 'EQUITY'
  },
  {
    id: 'in-tcs',
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE467B01029',
    sector: 'Technology',
    industry: 'Global IT Services & Digital Transformation',
    assetType: 'EQUITY'
  },
  {
    id: 'in-infy',
    symbol: 'INFY',
    companyName: 'Infosys Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE009A01021',
    sector: 'Technology',
    industry: 'Global IT Services & Consulting',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bhartiartl',
    symbol: 'BHARTIARTL',
    companyName: 'Bharti Airtel Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE397D01024',
    sector: 'Telecommunication',
    industry: 'Wireless Telecommunications & Digital Infra',
    assetType: 'EQUITY'
  },
  {
    id: 'in-lt',
    symbol: 'LT',
    companyName: 'Larsen & Toubro Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE018A01030',
    sector: 'Industrials & Infra',
    industry: 'Heavy Engineering, EPC & Infrastructure',
    assetType: 'EQUITY'
  },
  {
    id: 'in-hcltech',
    symbol: 'HCLTECH',
    companyName: 'HCL Technologies Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE860A01027',
    sector: 'Technology',
    industry: 'Engineering R&D & Digital IT Services',
    assetType: 'EQUITY'
  },
  {
    id: 'in-wipro',
    symbol: 'WIPRO',
    companyName: 'Wipro Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE075A01022',
    sector: 'Technology',
    industry: 'IT Services, Business Consulting & Cloud',
    assetType: 'EQUITY'
  },
  {
    id: 'in-sbin',
    symbol: 'SBIN',
    companyName: 'State Bank of India',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE062A01020',
    sector: 'Financial Services',
    industry: 'Public Sector Commercial Banking',
    assetType: 'EQUITY'
  },
  {
    id: 'in-kotakbank',
    symbol: 'KOTAKBANK',
    companyName: 'Kotak Mahindra Bank Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE237A01028',
    sector: 'Financial Services',
    industry: 'Private Banking & Financial Services',
    assetType: 'EQUITY'
  },
  {
    id: 'in-itc',
    symbol: 'ITC',
    companyName: 'ITC Limited',
    market: 'INDIA',
    exchange: 'NSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE154A01025',
    sector: 'Consumer Staples',
    industry: 'Diversified FMCG, Cigarettes, Hotels & Agri-Business',
    assetType: 'EQUITY'
  },

  // ==========================================
  // INDIAN EQUITIES (BSE DUAL-LISTINGS)
  // ==========================================
  {
    id: 'in-bse-reliance',
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE002A01018',
    sector: 'Energy & Conglomerates',
    industry: 'Refining, Petrochemicals, Telecom & Retail',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-hdfcbank',
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE040A01034',
    sector: 'Financial Services',
    industry: 'Private Sector Commercial Banking',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-icicibank',
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE090A01021',
    sector: 'Financial Services',
    industry: 'Private Sector Commercial Banking',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-tcs',
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE467B01029',
    sector: 'Technology',
    industry: 'Global IT Services & Digital Transformation',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-infy',
    symbol: 'INFY',
    companyName: 'Infosys Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE009A01021',
    sector: 'Technology',
    industry: 'Global IT Services & Consulting',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-bhartiartl',
    symbol: 'BHARTIARTL',
    companyName: 'Bharti Airtel Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE397D01024',
    sector: 'Telecommunication',
    industry: 'Wireless Telecommunications & Digital Infra',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-lt',
    symbol: 'LT',
    companyName: 'Larsen & Toubro Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE018A01030',
    sector: 'Industrials & Infra',
    industry: 'Heavy Engineering, EPC & Infrastructure',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-hcltech',
    symbol: 'HCLTECH',
    companyName: 'HCL Technologies Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE860A01027',
    sector: 'Technology',
    industry: 'Engineering R&D & Digital IT Services',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-wipro',
    symbol: 'WIPRO',
    companyName: 'Wipro Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE075A01022',
    sector: 'Technology',
    industry: 'IT Services, Business Consulting & Cloud',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-sbin',
    symbol: 'SBIN',
    companyName: 'State Bank of India',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE062A01020',
    sector: 'Financial Services',
    industry: 'Public Sector Commercial Banking',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-kotakbank',
    symbol: 'KOTAKBANK',
    companyName: 'Kotak Mahindra Bank Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE237A01028',
    sector: 'Financial Services',
    industry: 'Private Banking & Financial Services',
    assetType: 'EQUITY'
  },
  {
    id: 'in-bse-itc',
    symbol: 'ITC',
    companyName: 'ITC Limited',
    market: 'INDIA',
    exchange: 'BSE',
    country: 'IN',
    currency: 'INR',
    isin: 'INE154A01025',
    sector: 'Consumer Staples',
    industry: 'Diversified FMCG, Cigarettes, Hotels & Agri-Business',
    assetType: 'EQUITY'
  }
];

export interface ResolveSecurityOptions {
  market?: MarketRegion;
  exchange?: string;
  country?: string;
}

/**
 * Known canonical aliases for companies and brand names
 */
export const CANONICAL_ALIASES: Record<string, string> = {
  // US Equities
  'nvidia': 'NVDA',
  'nvidia corp': 'NVDA',
  'nvidia corporation': 'NVDA',
  'microsoft': 'MSFT',
  'microsoft corp': 'MSFT',
  'microsoft corporation': 'MSFT',
  'apple': 'AAPL',
  'apple inc': 'AAPL',
  'apple corporation': 'AAPL',
  'amazon': 'AMZN',
  'amazon.com': 'AMZN',
  'amazon com': 'AMZN',
  'amazon com inc': 'AMZN',
  'asml': 'ASML',
  'asml holding': 'ASML',
  'asml holding n.v.': 'ASML',
  'tsmc': 'TSM',
  'taiwan semi': 'TSM',
  'taiwan semiconductor': 'TSM',
  'taiwan semiconductor manufacturing': 'TSM',
  'taiwan semiconductor manufacturing company': 'TSM',
  'broadcom': 'AVGO',
  'broadcom inc': 'AVGO',
  'palantir': 'PLTR',
  'palantir technologies': 'PLTR',
  'eli lilly': 'LLY',
  'lilly': 'LLY',
  'jpmorgan': 'JPM',
  'jpmorgan chase': 'JPM',
  'jp morgan': 'JPM',
  'jpm': 'JPM',

  // Indian Equities
  'reliance': 'RELIANCE',
  'reliance industries': 'RELIANCE',
  'reliance industries limited': 'RELIANCE',
  'ril': 'RELIANCE',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  'tata consultancy services limited': 'TCS',
  'tcs': 'TCS',
  'infosys': 'INFY',
  'infosys limited': 'INFY',
  'infy': 'INFY',
  'hdfc bank': 'HDFCBANK',
  'hdfc bank limited': 'HDFCBANK',
  'hdfc': 'HDFCBANK',
  'icici bank': 'ICICIBANK',
  'icici bank limited': 'ICICIBANK',
  'icici': 'ICICIBANK',
  'bharti airtel': 'BHARTIARTL',
  'bharti airtel limited': 'BHARTIARTL',
  'airtel': 'BHARTIARTL',
  'bharti': 'BHARTIARTL',
  'larsen & toubro': 'LT',
  'larsen and toubro': 'LT',
  'l&t': 'LT',
  'l and t': 'LT',
  'hcl technologies': 'HCLTECH',
  'hcl tech': 'HCLTECH',
  'hcl': 'HCLTECH',
  'wipro': 'WIPRO',
  'wipro limited': 'WIPRO',
  'state bank of india': 'SBIN',
  'sbi': 'SBIN',
  'kotak mahindra bank': 'KOTAKBANK',
  'kotak bank': 'KOTAKBANK',
  'kotak': 'KOTAKBANK',
  'itc': 'ITC',
  'itc limited': 'ITC'
};

export interface ParsedQualifiedQuery {
  raw: string;
  normalized: string;
  explicitExchange?: string;
  explicitMarket?: MarketRegion;
  symbolOrNameCandidate: string;
  cleanQuery: string;
}

/**
 * Normalizes user input and extracts exchange / market qualifiers
 * Supports:
 * - "NASDAQ:NVDA", "NSE:RELIANCE", "BSE:RELIANCE", "NSE:TCS"
 * - "NVDA NASDAQ", "MSFT NASDAQ", "RELIANCE NSE", "RELIANCE BSE", "TCS NSE", "TCS BSE"
 * - "NVIDIA US", "RELIANCE INDIA", "TCS IN"
 */
export function parseQualifiedQuery(rawQuery: string): ParsedQualifiedQuery {
  const trimmed = (rawQuery || '').trim().replace(/\s+/g, ' ');
  let explicitExchange: string | undefined = undefined;
  let explicitMarket: MarketRegion | undefined = undefined;
  let candidate = trimmed;

  // 1. Prefix format: EXCHANGE:SYMBOL or MARKET:SYMBOL (e.g. "NASDAQ:NVDA", "NSE:RELIANCE", "BSE:TCS", "US:NVDA")
  const prefixColonMatch = candidate.match(/^([A-Za-z]+):([A-Za-z0-9_.-]+)$/);
  if (prefixColonMatch) {
    const p1 = prefixColonMatch[1].toUpperCase();
    const p2 = prefixColonMatch[2];
    if (['NASDAQ', 'NYSE', 'NSE', 'BSE'].includes(p1)) {
      explicitExchange = p1;
      candidate = p2;
    } else if (['US', 'USA'].includes(p1)) {
      explicitMarket = 'US';
      candidate = p2;
    } else if (['IN', 'INDIA'].includes(p1)) {
      explicitMarket = 'INDIA';
      candidate = p2;
    }
  }

  // 2. Trailing exchange or market qualifier (e.g. "RELIANCE NSE", "NVIDIA US", "TCS BSE", "MSFT NASDAQ")
  if (!explicitExchange && !explicitMarket) {
    const trailingParts = candidate.split(' ');
    if (trailingParts.length >= 2) {
      const last = trailingParts[trailingParts.length - 1].toUpperCase();
      if (['NASDAQ', 'NYSE', 'NSE', 'BSE'].includes(last)) {
        explicitExchange = last;
        candidate = trailingParts.slice(0, -1).join(' ');
      } else if (['US', 'USA'].includes(last)) {
        explicitMarket = 'US';
        candidate = trailingParts.slice(0, -1).join(' ');
      } else if (['IN', 'INDIA'].includes(last)) {
        explicitMarket = 'INDIA';
        candidate = trailingParts.slice(0, -1).join(' ');
      }
    }
  }

  return {
    raw: rawQuery,
    normalized: trimmed,
    explicitExchange,
    explicitMarket,
    symbolOrNameCandidate: candidate.trim(),
    cleanQuery: candidate.trim()
  };
}

/**
 * Deterministic Search & Ranking Engine for Canonical Securities
 * 
 * Ranking Order (Section 6):
 * 1. Exact ticker (score: 100)
 * 2. Exact canonical symbol (score: 95)
 * 3. Exact company name (score: 90)
 * 4. Exchange-qualified exact match (score: 85)
 * 5. Prefix match (score: 70)
 * 6. Alias match (score: 60)
 * 7. Fuzzy company-name match (score: 50)
 */
export function searchSecurities(
  query: string,
  options?: ResolveSecurityOptions
): SearchSecurityMatch[] {
  if (!query || !query.trim()) return [];
  const parsed = parseQualifiedQuery(query);

  const effectiveExchange = options?.exchange || parsed.explicitExchange;
  const effectiveMarket = options?.market || parsed.explicitMarket;
  const effectiveCountry = options?.country;

  const candidateUpper = parsed.symbolOrNameCandidate.toUpperCase();
  const candidateLower = parsed.symbolOrNameCandidate.toLowerCase();
  const queryLower = parsed.normalized.toLowerCase();

  // Filter candidate universe by explicit options if provided
  const pool = CANONICAL_SECURITIES.filter(sec => {
    if (effectiveMarket && sec.market !== effectiveMarket) return false;
    if (effectiveExchange && sec.exchange.toUpperCase() !== effectiveExchange.toUpperCase()) return false;
    if (effectiveCountry && sec.country.toUpperCase() !== effectiveCountry.toUpperCase()) return false;
    return true;
  });

  const matches: SearchSecurityMatch[] = [];
  const seenIds = new Set<string>();

  const addMatch = (security: SecurityIdentifier, matchType: SearchMatchType, score: number) => {
    if (seenIds.has(security.id)) return;
    seenIds.add(security.id);
    matches.push({
      security,
      matchType,
      score,
      exchange: security.exchange,
      market: security.market,
      currency: security.currency
    });
  };

  // 1. Exact ticker (score 100)
  for (const s of pool) {
    if (s.symbol.toUpperCase() === candidateUpper) {
      if (effectiveExchange && s.exchange.toUpperCase() === effectiveExchange.toUpperCase()) {
        addMatch(s, 'EXCHANGE_QUALIFIED', 100);
      } else if (!effectiveExchange) {
        const isPrimary = s.market === 'INDIA' ? s.exchange === 'NSE' : true;
        addMatch(s, 'EXACT_TICKER', isPrimary ? 100 : 95);
      }
    }
  }

  // 2. Exact Canonical ID (score 95)
  for (const s of pool) {
    if (s.id.toLowerCase() === candidateLower || s.id.toLowerCase() === `us-${candidateLower}` || s.id.toLowerCase() === `in-${candidateLower}`) {
      addMatch(s, 'EXACT_CANONICAL_SYMBOL', 95);
    }
  }

  // 3. Exact Company Name (case-insensitive) (score 90)
  for (const s of pool) {
    if (s.companyName.toLowerCase() === candidateLower || s.companyName.toLowerCase() === queryLower) {
      addMatch(s, 'EXACT_COMPANY_NAME', 90);
    }
  }

  // 4. Exchange-qualified match (score 85)
  if (effectiveExchange) {
    for (const s of pool) {
      if (s.exchange.toUpperCase() === effectiveExchange.toUpperCase()) {
        if (s.symbol.toUpperCase() === candidateUpper || s.companyName.toLowerCase().includes(candidateLower)) {
          addMatch(s, 'EXCHANGE_QUALIFIED', 85);
        }
      }
    }
  }

  // 5. Prefix Match on Symbol or Company Name (score 70)
  for (const s of pool) {
    const sSym = s.symbol.toUpperCase();
    const sName = s.companyName.toLowerCase();
    if (candidateUpper.length >= 2 && sSym.startsWith(candidateUpper)) {
      addMatch(s, 'PREFIX', 70);
    } else if (candidateLower.length >= 3 && sName.startsWith(candidateLower)) {
      addMatch(s, 'PREFIX', 68);
    }
  }

  // 6. Alias Match (score 60)
  const resolvedAlias = CANONICAL_ALIASES[candidateLower] || CANONICAL_ALIASES[queryLower];
  if (resolvedAlias) {
    for (const s of pool) {
      if (s.symbol.toUpperCase() === resolvedAlias.toUpperCase()) {
        addMatch(s, 'ALIAS', 60);
      }
    }
  }

  // 7. Fuzzy / Word Boundary Match (score 50)
  const queryTokens = candidateLower.split(/[\s,.-]+/).filter(t => t.length >= 2);
  for (const s of pool) {
    const sName = s.companyName.toLowerCase();
    const sSym = s.symbol.toLowerCase();
    const matchesAllTokens = queryTokens.length > 0 && queryTokens.every(tok => sName.includes(tok) || sSym.includes(tok));
    if (matchesAllTokens) {
      addMatch(s, 'FUZZY', 50);
    } else if (sName.includes(candidateLower)) {
      addMatch(s, 'FUZZY', 45);
    }
  }

  // Sort strictly by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Universal Security Resolver
 * 
 * Resolves a query deterministically into the best matching SecurityIdentifier.
 * Prioritizes explicit exchange, market, and ranking rules.
 */
export function resolveSecurity(
  query: string,
  options?: ResolveSecurityOptions
): SecurityIdentifier | null {
  if (!query || !query.trim()) return null;
  const matches = searchSecurities(query, options);
  if (matches.length === 0) return null;

  // If user supplied explicit exchange, verify top match conforms
  const parsed = parseQualifiedQuery(query);
  const targetExchange = options?.exchange || parsed.explicitExchange;
  if (targetExchange) {
    const exchangeMatch = matches.find(m => m.exchange.toUpperCase() === targetExchange.toUpperCase());
    if (exchangeMatch) return exchangeMatch.security;
  }

  return matches[0].security;
}
