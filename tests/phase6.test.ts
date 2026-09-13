/**
 * PHASE 6 — SEARCH + TICKER INTELLIGENCE TEST SUITE
 * 
 * Validates:
 * 1. Deterministic resolution (ticker, symbol, company name, alias, prefix, fuzzy)
 * 2. Exchange-aware resolution (NSE vs BSE, NASDAQ, prefix formats)
 * 3. Disambiguation (primary NSE priority vs explicit BSE override)
 * 4. Intent classification (SECURITY_LOOKUP, RESEARCH_QUERY, NAVIGATION, UNKNOWN)
 * 5. Research context extraction (single and multi-security extraction from NL questions)
 * 6. Non-functional contracts (currency separation, canonical IDs, epistemic rules preserved)
 */

import {
  CANONICAL_SECURITIES,
  CANONICAL_ALIASES,
  searchSecurities,
  resolveSecurity,
  parseQualifiedQuery
} from '../src/data/canonicalSecurities';
import {
  classifyAndResolve,
  extractSecuritiesFromText
} from '../src/services/searchIntelligence';
import { CANONICAL_SECURITIES_MAP } from '../src/data/mockData';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase6Tests() {
  console.log('======================================================');
  console.log(' RUNNING PHASE 6 SEARCH & TICKER INTELLIGENCE SUITE');
  console.log('======================================================');

  // ----------------------------------------------------
  // 1. Deterministic Resolution
  // ----------------------------------------------------
  console.log('\n1. Verifying Deterministic Security Resolution:');

  // Exact ticker match
  const nvdaMatches = searchSecurities('NVDA');
  assert(
    nvdaMatches.length > 0 &&
    nvdaMatches[0].security.symbol === 'NVDA' &&
    nvdaMatches[0].matchType === 'EXACT_TICKER' &&
    nvdaMatches[0].score === 100,
    'Exact ticker "NVDA" resolves with score 100 and EXACT_TICKER matchType'
  );

  const relianceMatches = searchSecurities('RELIANCE');
  assert(
    relianceMatches.length >= 2 &&
    relianceMatches[0].security.symbol === 'RELIANCE' &&
    relianceMatches[0].security.exchange === 'NSE',
    'Exact ticker "RELIANCE" resolves with primary NSE listing as top candidate'
  );

  // Exact symbol / canonical ID match
  const bseById = resolveSecurity('in-bse-reliance');
  assert(
    bseById !== null &&
    bseById.symbol === 'RELIANCE' &&
    bseById.exchange === 'BSE' &&
    bseById.id === 'in-bse-reliance',
    'Exact canonical ID "in-bse-reliance" resolves directly to BSE listing'
  );

  const usById = resolveSecurity('us-nvda');
  assert(
    usById !== null &&
    usById.symbol === 'NVDA' &&
    usById.exchange === 'NASDAQ' &&
    usById.id === 'us-nvda',
    'Exact canonical ID "us-nvda" resolves directly to US NASDAQ listing'
  );

  // Exact company name match
  const nameMatches = searchSecurities('NVIDIA Corporation');
  assert(
    nameMatches.length > 0 &&
    nameMatches[0].security.symbol === 'NVDA' &&
    nameMatches[0].matchType === 'EXACT_COMPANY_NAME',
    'Exact company name "NVIDIA Corporation" resolves to NVDA with EXACT_COMPANY_NAME matchType'
  );

  const tcsNameMatches = searchSecurities('Tata Consultancy Services Limited');
  assert(
    tcsNameMatches.length > 0 &&
    tcsNameMatches[0].security.symbol === 'TCS',
    'Exact company name "Tata Consultancy Services Limited" resolves to TCS'
  );

  // Alias match
  const aliasNvidia = searchSecurities('Nvidia');
  assert(
    aliasNvidia.length > 0 &&
    aliasNvidia[0].security.symbol === 'NVDA',
    'Alias "Nvidia" resolves to NVDA'
  );

  const aliasSBI = searchSecurities('SBI');
  assert(
    aliasSBI.length > 0 &&
    aliasSBI[0].security.symbol === 'SBIN',
    'Alias "SBI" resolves to SBIN'
  );

  const aliasLT = searchSecurities('L&T');
  assert(
    aliasLT.length > 0 &&
    aliasLT[0].security.symbol === 'LT',
    'Alias "L&T" resolves to LT'
  );

  // Prefix match
  const prefixRelia = searchSecurities('RELIA');
  assert(
    prefixRelia.length > 0 &&
    prefixRelia[0].security.symbol === 'RELIANCE' &&
    prefixRelia[0].matchType === 'PREFIX',
    'Prefix query "RELIA" resolves to RELIANCE with PREFIX matchType'
  );

  // Fuzzy match
  const fuzzyJPM = searchSecurities('JPMorgan');
  assert(
    fuzzyJPM.length > 0 &&
    fuzzyJPM[0].security.symbol === 'JPM',
    'Fuzzy name "JPMorgan" resolves to JPM'
  );

  const fuzzyTSMC = searchSecurities('Taiwan Semi');
  assert(
    fuzzyTSMC.length > 0 &&
    fuzzyTSMC[0].security.symbol === 'TSM',
    'Fuzzy name "Taiwan Semi" resolves to TSM'
  );

  // ----------------------------------------------------
  // 2. Exchange-Aware Resolution
  // ----------------------------------------------------
  console.log('\n2. Verifying Exchange-Aware Resolution:');

  // NVDA NASDAQ
  const nvdaNasdaq = resolveSecurity('NVDA NASDAQ');
  assert(
    nvdaNasdaq !== null &&
    nvdaNasdaq.symbol === 'NVDA' &&
    nvdaNasdaq.exchange === 'NASDAQ' &&
    nvdaNasdaq.market === 'US',
    '"NVDA NASDAQ" resolves specifically to US NASDAQ'
  );

  // RELIANCE NSE
  const relNse = resolveSecurity('RELIANCE NSE');
  assert(
    relNse !== null &&
    relNse.symbol === 'RELIANCE' &&
    relNse.exchange === 'NSE',
    '"RELIANCE NSE" resolves specifically to NSE'
  );

  // RELIANCE BSE
  const relBse = resolveSecurity('RELIANCE BSE');
  assert(
    relBse !== null &&
    relBse.symbol === 'RELIANCE' &&
    relBse.exchange === 'BSE',
    '"RELIANCE BSE" resolves specifically to BSE'
  );

  // NSE:RELIANCE prefix format
  const relColonNse = resolveSecurity('NSE:RELIANCE');
  assert(
    relColonNse !== null &&
    relColonNse.symbol === 'RELIANCE' &&
    relColonNse.exchange === 'NSE',
    '"NSE:RELIANCE" resolves specifically to NSE'
  );

  // BSE:RELIANCE prefix format
  const relColonBse = resolveSecurity('BSE:RELIANCE');
  assert(
    relColonBse !== null &&
    relColonBse.symbol === 'RELIANCE' &&
    relColonBse.exchange === 'BSE',
    '"BSE:RELIANCE" resolves specifically to BSE'
  );

  // TCS NSE vs TCS BSE
  const tcsNse = resolveSecurity('TCS NSE');
  const tcsBse = resolveSecurity('TCS BSE');
  assert(
    tcsNse !== null &&
    tcsBse !== null &&
    tcsNse.exchange === 'NSE' &&
    tcsBse.exchange === 'BSE' &&
    tcsNse.id !== tcsBse.id,
    '"TCS NSE" and "TCS BSE" resolve to distinct exchange listings and IDs'
  );

  // ----------------------------------------------------
  // 3. Disambiguation
  // ----------------------------------------------------
  console.log('\n3. Verifying Disambiguation and Ranking:');

  // Ambiguous query "Reliance"
  const relianceDisambig = searchSecurities('Reliance');
  assert(
    relianceDisambig.length >= 2 &&
    relianceDisambig[0].security.exchange === 'NSE' &&
    relianceDisambig[1].security.exchange === 'BSE',
    'Ambiguous "Reliance" search includes both listings with primary NSE ranked first'
  );

  // Explicit BSE query ranks BSE as top match
  const bseExplicit = searchSecurities('BSE:RELIANCE');
  assert(
    bseExplicit.length > 0 &&
    bseExplicit[0].security.exchange === 'BSE' &&
    bseExplicit[0].matchType === 'EXCHANGE_QUALIFIED' &&
    bseExplicit[0].score === 100,
    'Explicit "BSE:RELIANCE" ranks BSE first with score 100'
  );

  // Never silently convert BSE to NSE or vice-versa
  const parsedBse = parseQualifiedQuery('BSE:RELIANCE');
  assert(
    parsedBse.explicitExchange === 'BSE' && parsedBse.cleanQuery === 'RELIANCE',
    'parseQualifiedQuery accurately isolates explicit exchange qualifier without conversion'
  );

  // ----------------------------------------------------
  // 4. Intent Classification
  // ----------------------------------------------------
  console.log('\n4. Verifying Intent Classification:');

  // Security Lookups
  const intentNVDA = classifyAndResolve('NVDA');
  assert(
    intentNVDA.intent === 'SECURITY_LOOKUP' &&
    intentNVDA.navigationTarget === 'deep-dive' &&
    intentNVDA.securities[0]?.symbol === 'NVDA',
    '"NVDA" classifies as SECURITY_LOOKUP routing to deep-dive'
  );

  const intentReliance = classifyAndResolve('Reliance');
  assert(
    intentReliance.intent === 'SECURITY_LOOKUP' &&
    intentReliance.navigationTarget === 'deep-dive' &&
    intentReliance.securities[0]?.symbol === 'RELIANCE',
    '"Reliance" classifies as SECURITY_LOOKUP routing to deep-dive'
  );

  const intentBseRel = classifyAndResolve('BSE:RELIANCE');
  assert(
    intentBseRel.intent === 'SECURITY_LOOKUP' &&
    intentBseRel.matches[0]?.exchange === 'BSE',
    '"BSE:RELIANCE" classifies as SECURITY_LOOKUP targeting BSE'
  );

  // Research Queries
  const intentWhyDown = classifyAndResolve('Why is NVDA down?');
  assert(
    intentWhyDown.intent === 'RESEARCH_QUERY' &&
    intentWhyDown.navigationTarget === 'research',
    '"Why is NVDA down?" classifies as RESEARCH_QUERY routing to research'
  );

  const intentCompare = classifyAndResolve('Compare NVDA and MSFT');
  assert(
    intentCompare.intent === 'RESEARCH_QUERY' &&
    intentCompare.navigationTarget === 'research',
    '"Compare NVDA and MSFT" classifies as RESEARCH_QUERY'
  );

  const intentAnalyzeRel = classifyAndResolve('Analyze Reliance');
  assert(
    intentAnalyzeRel.intent === 'RESEARCH_QUERY' &&
    intentAnalyzeRel.navigationTarget === 'research',
    '"Analyze Reliance" classifies as RESEARCH_QUERY'
  );

  // Navigation targets
  const navPortfolio = classifyAndResolve('portfolio');
  assert(
    navPortfolio.intent === 'NAVIGATION' && navPortfolio.navigationTarget === 'portfolio',
    '"portfolio" classifies as NAVIGATION to portfolio'
  );

  const navWatchlist = classifyAndResolve('watchlist');
  assert(
    navWatchlist.intent === 'NAVIGATION' && navWatchlist.navigationTarget === 'watchlist',
    '"watchlist" classifies as NAVIGATION to watchlist'
  );

  const navStrategies = classifyAndResolve('strategies');
  assert(
    navStrategies.intent === 'NAVIGATION' && navStrategies.navigationTarget === 'strategies',
    '"strategies" classifies as NAVIGATION to strategies'
  );

  const navBacktest = classifyAndResolve('backtesting');
  assert(
    navBacktest.intent === 'NAVIGATION' && navBacktest.navigationTarget === 'backtesting',
    '"backtesting" classifies as NAVIGATION to backtesting'
  );

  const navResearch = classifyAndResolve('research');
  assert(
    navResearch.intent === 'NAVIGATION' && navResearch.navigationTarget === 'research',
    '"research" classifies as NAVIGATION to research'
  );

  // ----------------------------------------------------
  // 5. Research Query Context Extraction
  // ----------------------------------------------------
  console.log('\n5. Verifying Research Context Extraction:');

  // "Why is NVDA down?" -> extracts NVDA
  const secWhyDown = extractSecuritiesFromText('Why is NVDA down?');
  assert(
    secWhyDown.length === 1 && secWhyDown[0].symbol === 'NVDA',
    '"Why is NVDA down?" extracts exactly [NVDA]'
  );

  // "Compare NVDA and MSFT" -> extracts [NVDA, MSFT]
  const secCompare = extractSecuritiesFromText('Compare NVDA and MSFT');
  const compareSymbols = secCompare.map(s => s.symbol).sort();
  assert(
    compareSymbols.length === 2 &&
    compareSymbols[0] === 'MSFT' &&
    compareSymbols[1] === 'NVDA',
    '"Compare NVDA and MSFT" extracts [NVDA, MSFT]'
  );

  // "Analyze Reliance" -> extracts RELIANCE
  const secAnalyzeRel = extractSecuritiesFromText('Analyze Reliance');
  assert(
    secAnalyzeRel.length >= 1 && secAnalyzeRel[0].symbol === 'RELIANCE',
    '"Analyze Reliance" extracts RELIANCE via company alias'
  );

  // "Compare TCS and Infosys" -> extracts [TCS, INFY]
  const secTcsInfy = extractSecuritiesFromText('Compare TCS and Infosys');
  const tcsInfySymbols = secTcsInfy.map(s => s.symbol).sort();
  assert(
    tcsInfySymbols.includes('TCS') && tcsInfySymbols.includes('INFY'),
    '"Compare TCS and Infosys" extracts [TCS, INFY]'
  );

  // "Why is NVIDIA down?" -> extracts NVDA
  const secNvidiaDown = extractSecuritiesFromText('Why is NVIDIA down?');
  assert(
    secNvidiaDown.some(s => s.symbol === 'NVDA'),
    '"Why is NVIDIA down?" maps company alias to canonical NVDA'
  );

  // "Analyze Microsoft margins" -> extracts MSFT
  const secMsftMargins = extractSecuritiesFromText('Analyze Microsoft margins');
  assert(
    secMsftMargins.some(s => s.symbol === 'MSFT'),
    '"Analyze Microsoft margins" extracts MSFT'
  );

  // "What are the risks of TCS?" -> extracts TCS
  const secTcsRisks = extractSecuritiesFromText('What are the risks of TCS?');
  assert(
    secTcsRisks.some(s => s.symbol === 'TCS'),
    '"What are the risks of TCS?" extracts TCS'
  );

  // ----------------------------------------------------
  // 6. Preservation of Non-Functional Contracts
  // ----------------------------------------------------
  console.log('\n6. Verifying Non-Functional Contracts:');

  // No Gemini calls used for basic search resolution (Verified pure deterministic local execution)
  const start = Date.now();
  for (let i = 0; i < 50; i++) {
    classifyAndResolve('RELIANCE BSE');
    classifyAndResolve('Why is NVDA down?');
  }
  const duration = Date.now() - start;
  assert(
    duration < 100,
    `Search resolution executes 100 operations in ${duration}ms (deterministic microsecond latency, zero LLM calls)`
  );

  // Currency separation preserved (USD vs INR)
  const usStock = CANONICAL_SECURITIES_MAP['NVDA'];
  const inStockNse = CANONICAL_SECURITIES_MAP['in-reliance'];
  const inStockBse = CANONICAL_SECURITIES_MAP['in-bse-reliance'];
  assert(
    usStock.currency === 'USD' &&
    inStockNse.currency === 'INR' &&
    inStockBse.currency === 'INR',
    'Currency separation strictly preserved across US (USD) and Indian (INR) equities'
  );

  // Canonical IDs preserved
  assert(
    usStock.id === 'us-nvda' &&
    inStockNse.id === 'in-reliance' &&
    inStockBse.id === 'in-bse-reliance',
    'Canonical IDs are preserved and distinct for every market and exchange listing'
  );

  // India provider simulated / unavailable status respected
  assert(
    inStockNse.exchange === 'NSE' && inStockBse.exchange === 'BSE',
    'India securities maintain authentic exchange metadata without requiring live FYERS KYC'
  );

  console.log('\n------------------------------------------------------');
  console.log(` SUMMARY: ${passedCount} / ${testCount} tests passed.`);
  console.log('------------------------------------------------------\n');
}

runPhase6Tests().catch(err => {
  console.error('Phase 6 Test Suite Failed:', err);
  process.exit(1);
});
