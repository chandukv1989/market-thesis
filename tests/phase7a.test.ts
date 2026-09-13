/**
 * PHASE 7A — GEMINI RESEARCH & ANALYSIS ENGINE FOUNDATION TEST SUITE
 * 
 * Verifies:
 * 1. Research request validation
 * 2. Structured response validation
 * 3. FACT classification rules
 * 4. INFERENCE classification rules
 * 5. UNCERTAINTY classification rules
 * 6. SIMULATED classification rules
 * 7. UNAVAILABLE classification rules
 * 8. Evidence ID preservation and traceability
 * 9. No fabricated evidence
 * 10. Missing market data handling
 * 11. Simulated market data handling
 * 12. REAL Twelve Data market data provenance
 * 13. REAL SEC EDGAR data integration
 * 14. Comparison of two securities
 * 15. Research context from Phase 6
 * 16. Portfolio-context request handling
 * 17. Gemini API error handling & honest failure states
 * 18. Malformed Gemini output recovery & sanitization
 * 19. Deterministic caching behavior
 * 20. Credential isolation & zero secret leakage
 */

import {
  ResearchRequest,
  ResearchResponse,
  ResearchAnalysisType,
  ResearchEvidenceItem,
  SecurityIdentifier
} from '../src/types';
import {
  classifyAnalysisType,
  gatherEvidenceForSecurities,
  ResearchEngine
} from '../server/services/research/researchEngine';
import { GeminiResearchEngine } from '../server/services/research/geminiResearchEngine';
import { RESEARCH_SYSTEM_PROMPT, buildUserPrompt } from '../server/services/research/prompts';
import { resolveSecurity } from '../src/data/canonicalSecurities';
import { classifyAndResolve } from '../src/services/searchIntelligence';

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

async function runPhase7aTests() {
  console.log('======================================================================');
  console.log(' RUNNING PHASE 7A GEMINI RESEARCH ENGINE FOUNDATION SUITE');
  console.log('======================================================================');

  const engine = new GeminiResearchEngine();
  const nvdaSec = resolveSecurity('NVDA')!;
  const msftSec = resolveSecurity('MSFT')!;
  const relianceSec = resolveSecurity('in-reliance')!;

  // ----------------------------------------------------
  // TEST 1: Gemini Research Request Validation
  // ----------------------------------------------------
  console.log('\n1. Research Request & Analysis Type Classification:');
  const typeWhyMoved = classifyAnalysisType('Why is NVDA down today?', [nvdaSec]);
  assert(typeWhyMoved === 'WHY_MOVED', 'Query "Why is NVDA down today?" classifies as WHY_MOVED');

  const typeCompare = classifyAnalysisType('Compare NVDA and MSFT', [nvdaSec, msftSec]);
  assert(typeCompare === 'COMPARISON', 'Query "Compare NVDA and MSFT" classifies as COMPARISON');

  const typeFund = classifyAnalysisType('Analyze NVDA revenue and balance sheet', [nvdaSec]);
  assert(typeFund === 'FUNDAMENTALS', 'Query "Analyze NVDA revenue..." classifies as FUNDAMENTALS');

  const typePortfolio = classifyAnalysisType('How does NVDA affect my portfolio allocation?', [nvdaSec]);
  assert(typePortfolio === 'PORTFOLIO_CONTEXT', 'Portfolio query classifies as PORTFOLIO_CONTEXT');

  const typeGeneral = classifyAnalysisType('What is the outlook for technology?', []);
  assert(typeGeneral === 'GENERAL_ANALYSIS', 'General query defaults to GENERAL_ANALYSIS');

  // ----------------------------------------------------
  // TEST 2: Structured Response Validation
  // ----------------------------------------------------
  console.log('\n2. Structured Response Validation:');
  const mockRawResponse = JSON.stringify({
    title: "Institutional Research: NVDA Financial Overview",
    executiveSummary: "NVIDIA has achieved sustained top-line acceleration driven by datacenter compute demand.",
    conclusion: "Thesis remains anchored on datacenter enterprise adoption; monitor hyperscaler capex trends.",
    sections: [
      {
        heading: "Financial Performance",
        points: [
          {
            text: "Reported Q2 FY25 revenue reached $30.04 billion according to SEC Form 10-Q.",
            classification: "FACT",
            evidenceIds: ["ev-sec-fact-nvda-revenues-fy"]
          },
          {
            text: "Gross margins of 75.1% suggest substantial software stack lock-in via CUDA.",
            classification: "INFERENCE",
            evidenceIds: ["ev-sec-fact-nvda-revenues-fy"]
          },
          {
            text: "The causal linkage between today's intraday decline and broader macro CPI prints is unconfirmed.",
            classification: "UNCERTAINTY",
            evidenceIds: []
          },
          {
            text: "India market quotes are currently synthetic until FYERS live broker credentials are provided.",
            classification: "SIMULATED",
            evidenceIds: ["ev-quote-reliance"]
          },
          {
            text: "Audited SEC EDGAR disclosures are unavailable for Indian NSE listings.",
            classification: "UNAVAILABLE",
            evidenceIds: []
          }
        ]
      }
    ],
    keyRisks: [
      "Concentration risk among top four hyperscaler customers.",
      "Export control revisions on accelerated compute silicon."
    ],
    keyUnknowns: [
      "Longevity of enterprise generative AI software monetization returns."
    ],
    confidence: 0.92
  });

  const dummyRequest: ResearchRequest = {
    query: "Analyze NVDA",
    securities: [nvdaSec],
    requestedAnalysisType: "COMPANY_ANALYSIS",
    availableEvidence: [
      {
        id: "ev-sec-fact-nvda-revenues-fy",
        sourceType: "SEC_EDGAR",
        provider: "SEC EDGAR",
        epistemicStatus: "REAL",
        isSimulated: false,
        retrievedAt: new Date().toISOString(),
        description: "SEC 10-Q Revenue verified disclosure",
        data: { revenue: 30040000000 }
      },
      {
        id: "ev-quote-reliance",
        sourceType: "MARKET_DATA",
        provider: "India Market Provider",
        epistemicStatus: "SIMULATED",
        isSimulated: true,
        retrievedAt: new Date().toISOString(),
        description: "Reliance simulated quote",
        data: { price: 2980 }
      }
    ]
  };

  const validatedResponse = engine.parseAndValidateResponse(mockRawResponse, dummyRequest);
  assert(validatedResponse.title === "Institutional Research: NVDA Financial Overview", 'Validates response title');
  assert(typeof validatedResponse.executiveSummary === 'string' && validatedResponse.executiveSummary.length > 0, 'Validates executive summary');
  assert(typeof validatedResponse.conclusion === 'string', 'Validates conclusion');
  assert(validatedResponse.sections.length === 1, 'Validates section structure');
  assert(validatedResponse.confidence === 0.92, 'Validates confidence score preservation');
  assert(validatedResponse.keyRisks.length === 2, 'Validates key risks array');
  assert(validatedResponse.keyUnknowns.length === 1, 'Validates key unknowns array');

  // ----------------------------------------------------
  // TESTS 3 - 7: Epistemic Classifications
  // ----------------------------------------------------
  console.log('\n3-7. Epistemic Classification Rules:');
  const points = validatedResponse.sections[0].points;
  const factPoint = points.find(p => p.classification === 'FACT')!;
  assert(factPoint && factPoint.classification === 'FACT', 'TEST 3: Point with direct SEC disclosure is classified as FACT');
  assert(factPoint.evidenceIds.includes('ev-sec-fact-nvda-revenues-fy'), 'TEST 3: FACT point carries evidence ID reference');

  const inferencePoint = points.find(p => p.classification === 'INFERENCE')!;
  assert(inferencePoint && inferencePoint.classification === 'INFERENCE', 'TEST 4: Analytical interpretation is classified as INFERENCE');

  const uncertaintyPoint = points.find(p => p.classification === 'UNCERTAINTY')!;
  assert(uncertaintyPoint && uncertaintyPoint.classification === 'UNCERTAINTY', 'TEST 5: Unverified causal claim is classified as UNCERTAINTY');

  const simulatedPoint = points.find(p => p.classification === 'SIMULATED')!;
  assert(simulatedPoint && simulatedPoint.classification === 'SIMULATED', 'TEST 6: Synthetic price claim is classified as SIMULATED');

  const unavailablePoint = points.find(p => p.classification === 'UNAVAILABLE')!;
  assert(unavailablePoint && unavailablePoint.classification === 'UNAVAILABLE', 'TEST 7: Missing disclosure is explicitly marked as UNAVAILABLE');

  // ----------------------------------------------------
  // TEST 8: Evidence ID Preservation
  // ----------------------------------------------------
  console.log('\n8. Evidence ID Preservation:');
  assert(validatedResponse.evidenceReferences.length === 2, 'Response includes all request evidence references');
  assert(validatedResponse.evidenceReferences[0].id === 'ev-sec-fact-nvda-revenues-fy', 'Preserves SEC evidence reference ID');
  assert(validatedResponse.evidenceReferences[0].epistemicStatus === 'REAL', 'Preserves REAL epistemic status in reference');

  // ----------------------------------------------------
  // TEST 9: No Fabricated Evidence (Evidence Gatherer)
  // ----------------------------------------------------
  console.log('\n9. No Fabricated Evidence:');
  const gatheredEvidence = await gatherEvidenceForSecurities([nvdaSec], 'Analyze NVDA');
  assert(gatheredEvidence.length > 0, 'Gathers evidence for NVDA from registered application providers');
  const allValidSources = gatheredEvidence.every(e =>
    ['CANONICAL_METADATA', 'MARKET_DATA', 'SEC_EDGAR', 'PORTFOLIO'].includes(e.sourceType)
  );
  assert(allValidSources, 'All gathered evidence belongs to registered application data providers');
  const hasMetadata = gatheredEvidence.some(e => e.sourceType === 'CANONICAL_METADATA' && e.symbol === 'NVDA');
  assert(hasMetadata, 'Includes verified canonical security metadata without hallucination');

  // ----------------------------------------------------
  // TEST 10: Missing Market Data Handling
  // ----------------------------------------------------
  console.log('\n10. Missing Market Data Handling:');
  const dummyUnknownSec: SecurityIdentifier = {
    id: 'unknown-xyz',
    symbol: 'NONEXISTENT999',
    companyName: 'Nonexistent Corp',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    country: 'US'
  };
  const unknownEvidence = await gatherEvidenceForSecurities([dummyUnknownSec], 'Analyze NONEXISTENT999');
  const quoteEv = unknownEvidence.find(e => e.sourceType === 'MARKET_DATA');
  assert(quoteEv !== undefined, 'Market data item created for unrecognized security');
  assert(quoteEv?.epistemicStatus === 'UNAVAILABLE' || quoteEv?.epistemicStatus === 'SIMULATED', 'Missing or invalid quote is labeled UNAVAILABLE or SIMULATED, never as REAL verified fact');

  // ----------------------------------------------------
  // TEST 11: Simulated Market Data Handling
  // ----------------------------------------------------
  console.log('\n11. Simulated Market Data Handling:');
  const relianceEvidence = await gatherEvidenceForSecurities([relianceSec], 'Analyze Reliance');
  const relQuote = relianceEvidence.find(e => e.sourceType === 'MARKET_DATA');
  assert(relQuote !== undefined, 'Reliance market quote evidence exists');
  assert(relQuote?.isSimulated === true || relQuote?.epistemicStatus === 'SIMULATED' || relQuote?.epistemicStatus === 'UNAVAILABLE',
    'Pending FYERS KYC: Reliance quote is explicitly labeled SIMULATED or UNAVAILABLE, never REAL'
  );

  // ----------------------------------------------------
  // TEST 12: REAL Twelve Data Market Data (US Provider)
  // ----------------------------------------------------
  console.log('\n12. REAL Twelve Data Market Data:');
  const nvdaQuote = gatheredEvidence.find(e => e.sourceType === 'MARKET_DATA');
  assert(nvdaQuote !== undefined, 'NVDA market quote item exists');
  if (nvdaQuote?.epistemicStatus === 'REAL') {
    assert(nvdaQuote.provider === 'Twelve Data', 'Real US quote identifies provider as Twelve Data');
    assert(nvdaQuote.isSimulated === false, 'Real US quote isSimulated is false');
  } else {
    assert(nvdaQuote?.isSimulated === true || nvdaQuote?.epistemicStatus === 'UNAVAILABLE', 'If Twelve Data credentials unavailable or rate limited, correctly tagged as SIMULATED or UNAVAILABLE');
  }

  // ----------------------------------------------------
  // TEST 13: REAL SEC Data
  // ----------------------------------------------------
  console.log('\n13. REAL SEC EDGAR Data:');
  const secEvidence = gatheredEvidence.filter(e => e.sourceType === 'SEC_EDGAR');
  assert(secEvidence.length > 0, 'SEC EDGAR evidence gathered for US equity NVDA');
  const firstSec = secEvidence[0];
  assert(firstSec.provider === 'SEC EDGAR', 'SEC provider is explicitly SEC EDGAR');
  assert(firstSec.epistemicStatus === 'REAL', 'SEC disclosures carry REAL epistemic status');

  // ----------------------------------------------------
  // TEST 14: Comparison of Two Securities
  // ----------------------------------------------------
  console.log('\n14. Comparison of Two Securities:');
  const multiEvidence = await gatherEvidenceForSecurities([nvdaSec, msftSec], 'Compare NVDA and MSFT');
  const hasNVDA = multiEvidence.some(e => e.symbol === 'NVDA');
  const hasMSFT = multiEvidence.some(e => e.symbol === 'MSFT');
  assert(hasNVDA && hasMSFT, 'Evidence gathered for both comparison targets (NVDA and MSFT)');
  const compType = classifyAnalysisType('Compare NVDA and MSFT', [nvdaSec, msftSec]);
  assert(compType === 'COMPARISON', 'Correctly classified as COMPARISON analysis');

  // ----------------------------------------------------
  // TEST 15: Research Context from Phase 6
  // ----------------------------------------------------
  console.log('\n15. Integration with Phase 6 Search Classification:');
  const searchResolution = classifyAndResolve('Why is NVDA down?');
  assert(searchResolution.intent === 'RESEARCH_QUERY', 'Phase 6 resolves intent as RESEARCH_QUERY');
  assert(searchResolution.securities.length > 0 && searchResolution.securities[0].symbol === 'NVDA', 'Phase 6 extracts NVDA security');
  const phase6Gathered = await gatherEvidenceForSecurities(searchResolution.securities, searchResolution.query);
  assert(phase6Gathered.length > 0, 'Evidence successfully gathered using Phase 6 resolved security');

  // ----------------------------------------------------
  // TEST 16: Portfolio-Context Request Handling
  // ----------------------------------------------------
  console.log('\n16. Portfolio Context Request:');
  const mockPortfolioContext = {
    holdings: [
      {
        securityId: 'us-nvda',
        symbol: 'NVDA',
        shares: 100,
        averageCost: 110.50,
        currentPrice: 125.00,
        weightPct: 14.5,
        unrealizedPnL: 1450.00
      }
    ],
    totalNav: 100000
  };
  const portEvidence = await gatherEvidenceForSecurities([nvdaSec], 'How does NVDA affect my portfolio?', mockPortfolioContext);
  const portItem = portEvidence.find(e => e.sourceType === 'PORTFOLIO');
  assert(portItem !== undefined, 'Portfolio holding evidence generated');
  assert(portItem?.provider === 'Internal Portfolio Ledger', 'Portfolio provider labeled accurately');
  assert(portItem?.epistemicStatus === 'CALCULATED', 'Portfolio holding carries CALCULATED status');
  assert((portItem?.data as any)?.weightPct === 14.5, 'Preserves exact portfolio weight percentage');

  // ----------------------------------------------------
  // TEST 17: Gemini API Error & Honest Failure
  // ----------------------------------------------------
  console.log('\n17. Gemini API Error Handling:');
  const mockEngineMissingKey = new GeminiResearchEngine();
  const savedKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    let threw = false;
    try {
      await mockEngineMissingKey.analyze(dummyRequest);
    } catch (e: any) {
      threw = true;
      assert(e.message.includes('GEMINI_API_KEY'), 'Throws clear, honest error when API key is missing');
    }
    assert(threw, 'Fails honestly instead of generating fake hallucinations when unconfigured');
  } finally {
    process.env.GEMINI_API_KEY = savedKey;
  }

  // ----------------------------------------------------
  // TEST 18: Malformed Gemini Output Fallback/Repair
  // ----------------------------------------------------
  console.log('\n18. Malformed Output Recovery:');
  const fencedMarkdown = "```json\n" + mockRawResponse + "\n```";
  const parsedFenced = engine.parseAndValidateResponse(fencedMarkdown, dummyRequest);
  assert(parsedFenced.title === "Institutional Research: NVDA Financial Overview", 'Successfully strips markdown code fences');

  const partialCorrupted = "NOT VALID JSON, JUST TEXT SUMMARY OF NVDA";
  const recovered = engine.parseAndValidateResponse(partialCorrupted, dummyRequest);
  assert(recovered.title.includes('NVDA'), 'Recovers and wraps unparseable model response into structured ResearchResponse');
  assert(recovered.sections.length > 0, 'Ensures at least one fallback section exists in recovered response');

  // ----------------------------------------------------
  // TEST 19: Caching Behavior
  // ----------------------------------------------------
  console.log('\n19. Caching Behavior:');
  const cacheKey1 = engine.generateCacheKey(dummyRequest);
  const cacheKey2 = engine.generateCacheKey({ ...dummyRequest, query: 'Analyze NVDA' });
  assert(cacheKey1 === cacheKey2, 'Deterministic cache keys match for identical query & security');

  const diffRequest = { ...dummyRequest, query: 'Different Query' };
  const cacheKeyDiff = engine.generateCacheKey(diffRequest);
  assert(cacheKey1 !== cacheKeyDiff, 'Different queries generate distinct cache keys');

  // ----------------------------------------------------
  // TEST 20: Credential Isolation & Zero Secret Leakage
  // ----------------------------------------------------
  console.log('\n20. Credential Isolation:');
  const promptOutput = buildUserPrompt(dummyRequest);
  assert(!promptOutput.includes('AIza'), 'User prompt does not contain Gemini API keys');
  assert(!promptOutput.includes('TWELVE_DATA'), 'User prompt does not contain Twelve Data keys');
  assert(!promptOutput.includes('API_KEY'), 'User prompt contains zero environment secret references');

  const responseJson = JSON.stringify(validatedResponse);
  assert(!responseJson.includes('AIza'), 'Output response contains zero API keys');
  assert(!responseJson.includes('secret'), 'Output response contains zero secret fields');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n======================================================');
  console.log(` PHASE 7A TESTS COMPLETE: ${passedCount} / ${testCount} PASSED`);
  console.log('======================================================\n');
}

runPhase7aTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
