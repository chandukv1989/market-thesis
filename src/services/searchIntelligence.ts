/**
 * Deterministic Search & Ticker Intelligence Engine (Phase 6)
 * 
 * Pipeline:
 * USER QUERY
 *     ↓
 * INTENT CLASSIFICATION (SECURITY_LOOKUP | RESEARCH_QUERY | NAVIGATION | UNKNOWN)
 *     ↓
 * SECURITY RESOLUTION or RESEARCH CONTEXT EXTRACTION
 *     ↓
 * CORRECT APPLICATION DESTINATION (Deep Dive | Research & RAG | Navigation Target)
 */

import {
  ActiveScreen,
  SecurityIdentifier,
  SearchIntent,
  SearchResult,
  SearchSecurityMatch
} from '../types';
import {
  CANONICAL_SECURITIES,
  CANONICAL_ALIASES,
  searchSecurities,
  resolveSecurity,
  parseQualifiedQuery
} from '../data/canonicalSecurities';

// ==========================================
// NAVIGATION MAPPINGS
// ==========================================

const NAVIGATION_KEYWORDS: Record<string, ActiveScreen> = {
  'portfolio': 'portfolio',
  'my portfolio': 'portfolio',
  'holdings': 'portfolio',
  'positions': 'portfolio',
  'watchlist': 'watchlist',
  'my watchlist': 'watchlist',
  'strategies': 'strategies',
  'strategy': 'strategies',
  'quant strategies': 'strategies',
  'backtesting': 'backtesting',
  'backtest': 'backtesting',
  'backtests': 'backtesting',
  'research': 'research',
  'rag': 'research',
  'research workspace': 'research',
  'research & rag': 'research',
  'research and rag': 'research',
  'dashboard': 'dashboard',
  'home': 'dashboard',
  'terminal': 'dashboard',
  'discover': 'discover',
  'market discover': 'discover',
  'screener': 'discover',
  'alerts': 'alerts',
  'alert': 'alerts',
  'notifications': 'alerts',
  'deep dive': 'deep-dive',
  'deepdive': 'deep-dive'
};

// ==========================================
// RESEARCH INTENT PATTERNS
// ==========================================

const RESEARCH_INTERROGATIVE_STARTS = [
  'why',
  'what',
  'how',
  'is',
  'are',
  'can',
  'will',
  'does',
  'should',
  'could',
  'where',
  'when',
  'explain'
];

const RESEARCH_ANALYTICAL_KEYWORDS = [
  'compare',
  'versus',
  'vs',
  'analyze',
  'analysis',
  'investigate',
  'eval',
  'evaluate',
  'margins',
  'margin',
  'revenue',
  'growth',
  'capex',
  'cash flow',
  'fcf',
  'roic',
  'ebitda',
  'risks',
  'risk',
  'risks of',
  'risk of',
  'bottlenecks',
  'headwinds',
  'tailwinds',
  'attractive',
  'overvalued',
  'undervalued',
  'falling',
  'down',
  'dropping',
  'crashing',
  'rallying',
  'surging',
  'outlook',
  'guidance',
  'thesis',
  'moat',
  'bull case',
  'bear case'
];

/**
 * Extracts all unique canonical securities referenced within a natural language query
 */
export function extractSecuritiesFromText(text: string): SecurityIdentifier[] {
  if (!text || !text.trim()) return [];
  const normalized = text.toLowerCase().replace(/[?.,!/]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);

  const foundSecurities: SecurityIdentifier[] = [];
  const foundSymbols = new Set<string>();

  const addSec = (sec: SecurityIdentifier | null) => {
    if (!sec) return;
    if (foundSymbols.has(sec.symbol)) return;
    foundSymbols.add(sec.symbol);
    foundSecurities.push(sec);
  };

  // 1. Check exact tickers as standalone tokens
  for (const word of words) {
    const upper = word.toUpperCase();
    const match = CANONICAL_SECURITIES.find(s => s.symbol.toUpperCase() === upper);
    if (match) {
      addSec(match);
    }
  }

  // 2. Check canonical alias dictionary against full phrases and individual tokens
  const sortedAliases = Object.keys(CANONICAL_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    // Check if alias exists as distinct word or phrase in text
    const regex = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      const sym = CANONICAL_ALIASES[alias];
      const match = CANONICAL_SECURITIES.find(s => s.symbol.toUpperCase() === sym.toUpperCase());
      if (match) {
        addSec(match);
      }
    }
  }

  // 3. Check exact company names
  for (const s of CANONICAL_SECURITIES) {
    const sName = s.companyName.toLowerCase();
    if (normalized.includes(sName)) {
      addSec(s);
    }
  }

  return foundSecurities;
}

/**
 * Deterministic First-Pass Intent Classifier
 * 
 * Classifies queries into:
 * - SECURITY_LOOKUP
 * - RESEARCH_QUERY
 * - NAVIGATION
 * - UNKNOWN
 */
export function classifyAndResolve(rawQuery: string): SearchResult {
  if (!rawQuery || !rawQuery.trim()) {
    return {
      query: '',
      intent: 'UNKNOWN',
      securities: [],
      confidence: 0.0,
      matches: [],
      message: 'Empty query'
    };
  }

  const query = rawQuery.trim();
  const lowerQuery = query.toLowerCase().replace(/\s+/g, ' ');
  const parsed = parseQualifiedQuery(query);

  // ----------------------------------------------------
  // STEP 1: NAVIGATION CHECK
  // ----------------------------------------------------
  const navTarget = NAVIGATION_KEYWORDS[lowerQuery];
  if (navTarget) {
    return {
      query,
      intent: 'NAVIGATION',
      securities: [],
      navigationTarget: navTarget,
      confidence: 1.0,
      matches: [],
      message: `Navigating to ${navTarget}`
    };
  }

  // ----------------------------------------------------
  // STEP 2: RESEARCH QUERY CHECK
  // (Rule: Do NOT interpret natural-language research question as ticker lookup)
  // ----------------------------------------------------
  const tokens = lowerQuery.replace(/[?.,!/]/g, ' ').split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] || '';
  const endsWithQuestion = query.endsWith('?');

  const isInterrogativeStart = RESEARCH_INTERROGATIVE_STARTS.includes(firstToken);
  const hasAnalyticalKeyword = RESEARCH_ANALYTICAL_KEYWORDS.some(kw => {
    if (kw.includes(' ')) {
      return lowerQuery.includes(kw);
    }
    return tokens.includes(kw);
  });

  const isResearchQuery = endsWithQuestion || isInterrogativeStart || hasAnalyticalKeyword;

  if (isResearchQuery) {
    const extractedSecurities = extractSecuritiesFromText(query);
    return {
      query,
      intent: 'RESEARCH_QUERY',
      securities: extractedSecurities,
      navigationTarget: 'research',
      confidence: 0.95,
      matches: extractedSecurities.map(sec => ({
        security: sec,
        matchType: 'EXACT_TICKER',
        score: 95,
        exchange: sec.exchange,
        market: sec.market,
        currency: sec.currency
      })),
      message: `Identified research query with ${extractedSecurities.length} security context reference(s)`
    };
  }

  // ----------------------------------------------------
  // STEP 3: SECURITY LOOKUP CHECK
  // ----------------------------------------------------
  const matches = searchSecurities(query);

  if (matches.length > 0) {
    // If top match has a solid score, classify as SECURITY_LOOKUP
    const topMatch = matches[0];
    const confidence = topMatch.score >= 80 ? 1.0 : topMatch.score >= 50 ? 0.8 : 0.6;

    return {
      query,
      intent: 'SECURITY_LOOKUP',
      securities: matches.map(m => m.security),
      navigationTarget: 'deep-dive',
      confidence,
      matches,
      message: `Resolved security candidate: ${topMatch.security.symbol} (${topMatch.security.exchange})`
    };
  }

  // ----------------------------------------------------
  // STEP 4: UNKNOWN
  // ----------------------------------------------------
  return {
    query,
    intent: 'UNKNOWN',
    securities: [],
    confidence: 0.0,
    matches: [],
    message: `Query "${query}" could not be confidently classified`
  };
}
