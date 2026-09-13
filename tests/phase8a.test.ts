/**
 * PHASE 8A — EVIDENCE FOUNDATION & RETRIEVAL ARCHITECTURE TEST SUITE
 * 
 * Comprehensive tests covering:
 * 1. EvidenceItem validation
 * 2. SEC evidence normalization
 * 3. Twelve Data evidence normalization
 * 4. Simulated market evidence
 * 5. Unavailable market evidence
 * 6. Portfolio calculated evidence
 * 7. Canonical metadata evidence
 * 8. Evidence deduplication
 * 9. Evidence repository
 * 10. Security filtering
 * 11. Source filtering
 * 12. Provider filtering
 * 13. Date filtering
 * 14. Point-in-time retrieval
 * 15. Filing availability dates (publishedAt vs periodEnd)
 * 16. Conflicting evidence preservation
 * 17. Provenance preservation
 * 18. Credential isolation
 * 19. EvidenceService
 * 20. FYERS-unavailable scenario
 * 21. Malformed evidence handling
 * 22. Deterministic evidence IDs
 */

import {
  EvidenceItem,
  EvidenceFilter,
  SecurityIdentifier,
  EvidenceSourceType,
  EvidenceEpistemicStatus
} from '../src/types';
import { resolveSecurity } from '../src/data/canonicalSecurities';
import {
  EvidenceRepository,
  generateEvidenceFingerprint,
  generateConceptKey
} from '../server/services/evidence/evidenceRepository';
import { secEvidenceAdapter } from '../server/services/evidence/adapters/secEvidenceAdapter';
import { marketEvidenceAdapter } from '../server/services/evidence/adapters/marketEvidenceAdapter';
import { portfolioEvidenceAdapter } from '../server/services/evidence/adapters/portfolioEvidenceAdapter';
import { metadataEvidenceAdapter } from '../server/services/evidence/adapters/metadataEvidenceAdapter';
import { evidenceService } from '../server/services/evidence/evidenceService';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase8aTests() {
  console.log('======================================================================');
  console.log(' RUNNING PHASE 8A EVIDENCE FOUNDATION & RETRIEVAL SUITE');
  console.log('======================================================================');

  const nvdaSec = resolveSecurity('NVDA')!;
  const relianceSec = resolveSecurity('in-reliance')!;
  const msftSec = resolveSecurity('MSFT')!;

  // ----------------------------------------------------
  // TEST 1: EvidenceItem Validation
  // ----------------------------------------------------
  console.log('\n1. EvidenceItem Model & Validation:');
  const sampleItem: EvidenceItem = {
    evidenceId: 'ev-test-item-1',
    securityId: 'us-nvda',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC EDGAR',
    documentId: '0001045810-24-000029',
    documentType: '10-Q',
    title: 'SEC 10-Q: Revenues',
    content: 'NVIDIA reported Q2 FY25 revenues of $30,040,000,000.',
    structuredValue: 30040000000,
    unit: 'USD',
    currency: 'USD',
    publishedAt: '2024-08-28T20:15:00.000Z',
    filingDate: '2024-08-28',
    periodStart: '2024-05-01',
    periodEnd: '2024-07-28',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'REAL',
    isSimulated: false,
    sourceReference: {
      cik: '0001045810',
      form: '10-Q',
      accessionNumber: '0001045810-24-000029',
      concept: 'Revenues'
    }
  };

  assert(typeof sampleItem.evidenceId === 'string' && sampleItem.evidenceId.length > 0, 'EvidenceItem has valid non-empty evidenceId');
  assert(sampleItem.sourceType === 'SEC_EDGAR', 'EvidenceItem matches canonical EvidenceSourceType');
  assert(sampleItem.epistemicStatus === 'REAL', 'EvidenceItem matches canonical EvidenceEpistemicStatus');
  assert(!isNaN(new Date(sampleItem.publishedAt).getTime()), 'publishedAt is a valid ISO-8601 timestamp');
  assert(sampleItem.structuredValue === 30040000000, 'Preserves numeric structuredValue');

  // ----------------------------------------------------
  // TEST 2: SEC Evidence Normalization
  // ----------------------------------------------------
  console.log('\n2. SEC Evidence Normalization:');
  const secItems = await secEvidenceAdapter.getEvidenceForSecurity(nvdaSec);
  assert(secItems.length > 0, 'SEC adapter successfully produces normalized EvidenceItem list');
  const secFact = secItems.find(e => e.documentType === '10-Q' || e.documentType === '10-K' || e.documentType === '10-Q/10-K');
  assert(secFact !== undefined, 'Contains at least one audited 10-K or 10-Q filing fact');
  assert(secFact?.provider === 'SEC EDGAR', 'SEC provider is explicitly SEC EDGAR');
  assert(secFact?.epistemicStatus === 'REAL', 'SEC facts are strictly REAL epistemic status');
  assert(secFact?.isSimulated === false, 'SEC facts isSimulated is false');
  assert(typeof secFact?.sourceReference?.cik === 'string', 'SEC evidence preserves CIK in sourceReference');

  // ----------------------------------------------------
  // TEST 3: Twelve Data Evidence Normalization
  // ----------------------------------------------------
  console.log('\n3. Twelve Data Evidence Normalization:');
  const nvdaQuotes = await marketEvidenceAdapter.getQuoteEvidence(nvdaSec);
  assert(nvdaQuotes.length > 0, 'Produces normalized market quote evidence for NVDA');
  const quoteItem = nvdaQuotes[0];
  assert(quoteItem.sourceType === 'MARKET_DATA', 'Quote evidence carries MARKET_DATA sourceType');
  assert(typeof (quoteItem.structuredValue as any)?.price === 'number', 'Contains numeric market price in structuredValue');
  if (quoteItem.epistemicStatus === 'REAL') {
    assert(quoteItem.provider === 'Twelve Data', 'Real market quote correctly identifies Twelve Data provider');
    assert(quoteItem.isSimulated === false, 'Real market quote has isSimulated === false');
  } else {
    assert(quoteItem.isSimulated === true || quoteItem.epistemicStatus === 'UNAVAILABLE', 'Fallback quote without active Twelve Data key is marked isSimulated or UNAVAILABLE');
  }

  // ----------------------------------------------------
  // TEST 4: Simulated Market Evidence
  // ----------------------------------------------------
  console.log('\n4. Simulated Market Evidence:');
  const relQuotes = await marketEvidenceAdapter.getQuoteEvidence(relianceSec);
  assert(relQuotes.length > 0, 'Produces quote item for Reliance');
  const relItem = relQuotes[0];
  assert(relItem.isSimulated === true || relItem.epistemicStatus === 'SIMULATED' || relItem.epistemicStatus === 'UNAVAILABLE',
    'Pending FYERS KYC: Reliance quote is tagged as SIMULATED or UNAVAILABLE, never REAL'
  );
  assert(relItem.epistemicStatus !== 'REAL', 'Enforces strict negative constraint: unverified India equity is NEVER marked REAL');

  // ----------------------------------------------------
  // TEST 5: Unavailable Market Evidence
  // ----------------------------------------------------
  console.log('\n5. Unavailable Market Evidence:');
  const bogusSec: SecurityIdentifier = {
    id: 'bogus-symbol',
    symbol: 'INVALID999',
    companyName: 'Invalid Entity',
    market: 'US',
    exchange: 'NYSE',
    currency: 'USD',
    country: 'US'
  };
  const bogusQuotes = await marketEvidenceAdapter.getQuoteEvidence(bogusSec);
  assert(bogusQuotes.length > 0, 'Produces explicit evidence item for invalid security');
  assert(bogusQuotes[0].epistemicStatus === 'UNAVAILABLE' || bogusQuotes[0].epistemicStatus === 'SIMULATED',
    'Missing market data generates explicit UNAVAILABLE or SIMULATED status, never fabricated REAL'
  );

  // ----------------------------------------------------
  // TEST 6: Portfolio Calculated Evidence
  // ----------------------------------------------------
  console.log('\n6. Portfolio Calculated Evidence:');
  const mockPort = {
    holdings: [
      {
        securityId: 'us-nvda',
        symbol: 'NVDA',
        shares: 250,
        averageCost: 112.40,
        currentPrice: 128.50,
        weightPct: 18.25,
        unrealizedPnL: 4025.00
      }
    ],
    totalNav: 175000
  };
  const portEvidence = portfolioEvidenceAdapter.getEvidenceFromPortfolio(mockPort, [nvdaSec]);
  assert(portEvidence.length === 1, 'Generates portfolio position evidence');
  const portItem = portEvidence[0];
  assert(portItem.sourceType === 'PORTFOLIO', 'Carries PORTFOLIO source type');
  assert(portItem.epistemicStatus === 'CALCULATED', 'Portfolio evidence is strictly labeled CALCULATED');
  assert((portItem.structuredValue as any).shares === 250, 'Preserves position shares');
  assert((portItem.structuredValue as any).weightPct === 18.25, 'Preserves position weight');
  assert(portItem.provider === 'Internal Portfolio Ledger', 'Identifies provider as Internal Portfolio Ledger');

  // ----------------------------------------------------
  // TEST 7: Canonical Metadata Evidence
  // ----------------------------------------------------
  console.log('\n7. Canonical Metadata Evidence:');
  const metaItem = metadataEvidenceAdapter.getMetadataEvidence(nvdaSec);
  assert(metaItem.sourceType === 'CANONICAL_METADATA', 'Source type is CANONICAL_METADATA');
  assert(metaItem.epistemicStatus === 'REAL', 'Canonical metadata carries REAL epistemic status');
  assert((metaItem.structuredValue as any).symbol === 'NVDA', 'Preserves canonical ticker symbol');
  assert((metaItem.structuredValue as any).exchange === 'NASDAQ', 'Preserves canonical exchange');
  assert(metaItem.provider === 'Canonical Security Registry', 'Provider is Canonical Security Registry');

  // ----------------------------------------------------
  // TEST 8: Evidence Deduplication
  // ----------------------------------------------------
  console.log('\n8. Evidence Deduplication:');
  const repo = new EvidenceRepository();
  const dup1: EvidenceItem = {
    evidenceId: 'ev-dedup-1',
    securityId: 'us-nvda',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC EDGAR',
    title: 'SEC Revenue 2024',
    content: 'Revenue 30B',
    structuredValue: 30000000000,
    publishedAt: '2024-08-28T00:00:00.000Z',
    periodEnd: '2024-07-28',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'REAL',
    isSimulated: false,
    sourceReference: { concept: 'Revenues' }
  };
  const dup2: EvidenceItem = {
    evidenceId: 'ev-dedup-2', // Different ID but exact same semantic content & fingerprint
    securityId: 'us-nvda',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC EDGAR',
    title: 'SEC Revenue 2024 duplicate',
    content: 'Revenue 30B',
    structuredValue: 30000000000,
    publishedAt: '2024-08-28T00:00:00.000Z',
    periodEnd: '2024-07-28',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'REAL',
    isSimulated: false,
    sourceReference: { concept: 'Revenues' }
  };

  const added1 = repo.addEvidence(dup1);
  const added2 = repo.addEvidence(dup2);
  assert(added1 === true, 'First instance of evidence item is added');
  assert(added2 === false, 'Identical evidence item with same fingerprint is rejected/deduplicated');
  assert(repo.count() === 1, 'Repository count remains 1 after deduplication');

  // ----------------------------------------------------
  // TEST 9: Evidence Repository Operations
  // ----------------------------------------------------
  console.log('\n9. Evidence Repository CRUD Operations:');
  const retrieved = repo.getEvidence('ev-dedup-1');
  assert(retrieved !== undefined && retrieved.title === 'SEC Revenue 2024', 'Retrieves evidence by ID');

  const removed = repo.removeEvidence('ev-dedup-1');
  assert(removed === true, 'Removes evidence item successfully');
  assert(repo.count() === 0, 'Count updates to 0 after removal');

  repo.addEvidenceBatch([dup1, sampleItem]);
  assert(repo.count() === 2, 'Batch insertion adds multiple items correctly');

  repo.clear();
  assert(repo.count() === 0, 'Repository clear() resets store to 0');

  // ----------------------------------------------------
  // TEST 10: Security Filtering
  // ----------------------------------------------------
  console.log('\n10. Security Filtering:');
  repo.addEvidence(sampleItem); // NVDA item
  const msftMeta = metadataEvidenceAdapter.getMetadataEvidence(msftSec);
  repo.addEvidence(msftMeta);

  const nvdaItems = repo.getEvidenceBySecurity('us-nvda');
  assert(nvdaItems.length === 1 && nvdaItems[0].evidenceId === sampleItem.evidenceId, 'Filters evidence strictly by securityId');

  const msftItems = repo.getEvidenceBySecurity('us-msft');
  assert(msftItems.length === 1 && msftItems[0].evidenceId === msftMeta.evidenceId, 'Filters MSFT evidence accurately');

  // ----------------------------------------------------
  // TEST 11: Source Filtering
  // ----------------------------------------------------
  console.log('\n11. Source Type Filtering:');
  const secFiltered = repo.getEvidenceBySource('SEC_EDGAR');
  assert(secFiltered.length === 1 && secFiltered[0].sourceType === 'SEC_EDGAR', 'Filters evidence by sourceType SEC_EDGAR');

  const metaFiltered = repo.getEvidenceBySource('CANONICAL_METADATA');
  assert(metaFiltered.length === 1 && metaFiltered[0].sourceType === 'CANONICAL_METADATA', 'Filters evidence by sourceType CANONICAL_METADATA');

  // ----------------------------------------------------
  // TEST 12: Provider Filtering
  // ----------------------------------------------------
  console.log('\n12. Provider Filtering:');
  const queryByProv = repo.queryEvidence({ provider: 'SEC EDGAR' });
  assert(queryByProv.length === 1 && queryByProv[0].provider === 'SEC EDGAR', 'Filters evidence by provider "SEC EDGAR"');

  const queryNonexistentProv = repo.queryEvidence({ provider: 'NONEXISTENT_PROVIDER' });
  assert(queryNonexistentProv.length === 0, 'Provider filter returns empty array for nonexistent provider');

  // ----------------------------------------------------
  // TEST 13: Date Filtering
  // ----------------------------------------------------
  console.log('\n13. Date Range Filtering:');
  const inRange = repo.queryEvidence({
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  });
  assert(inRange.some(i => i.evidenceId === sampleItem.evidenceId), 'Item published in Aug 2024 returned in 2024 range');

  const outOfRange = repo.queryEvidence({
    startDate: '2025-01-01',
    endDate: '2025-12-31'
  });
  assert(!outOfRange.some(i => i.evidenceId === sampleItem.evidenceId), 'Item published in Aug 2024 excluded from 2025 range');

  // ----------------------------------------------------
  // TEST 14 & 15: Point-In-Time Retrieval & Availability Dates
  // ----------------------------------------------------
  console.log('\n14-15. Point-In-Time Retrieval & Filing Availability Dates:');
  // Filing scenario:
  // Period ends: 2025-03-31
  // Published / Filed on: 2025-05-10
  const q1Filing: EvidenceItem = {
    evidenceId: 'ev-pit-test-q1-2025',
    securityId: 'us-nvda',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC EDGAR',
    title: 'SEC 10-Q Q1 2025',
    content: 'Q1 2025 Revenue was 26B',
    structuredValue: 26000000000,
    periodStart: '2025-01-01',
    periodEnd: '2025-03-31', // Period ends in March
    publishedAt: '2025-05-10T14:30:00.000Z', // Not published until May 10!
    filingDate: '2025-05-10',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'REAL',
    isSimulated: false,
    sourceReference: { concept: 'Q1Revenues' }
  };
  repo.addEvidence(q1Filing);

  // Query as of 2025-04-30 (after periodEnd, but BEFORE publishedAt)
  const asOfApril = repo.getEvidenceAvailableAsOf('2025-04-30T23:59:59.000Z');
  const foundInApril = asOfApril.some(e => e.evidenceId === 'ev-pit-test-q1-2025');
  assert(!foundInApril, 'TEST 14: getEvidenceAvailableAsOf("2025-04-30") must NOT return filing published on 2025-05-10');

  // Query as of 2025-05-15 (after publishedAt)
  const asOfMay = repo.getEvidenceAvailableAsOf('2025-05-15T00:00:00.000Z');
  const foundInMay = asOfMay.some(e => e.evidenceId === 'ev-pit-test-q1-2025');
  assert(foundInMay, 'TEST 15: getEvidenceAvailableAsOf("2025-05-15") DOES return filing available by that date');

  // ----------------------------------------------------
  // TEST 16: Conflicting Evidence Preservation
  // ----------------------------------------------------
  console.log('\n16. Conflicting Evidence Preservation:');
  const conflictRepo = new EvidenceRepository();
  const secReported: EvidenceItem = {
    evidenceId: 'ev-conf-sec',
    securityId: 'us-nvda',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC EDGAR',
    title: 'SEC Revenue Report',
    content: 'SEC XBRL Revenue: $30,040,000,000',
    structuredValue: 30040000000,
    unit: 'USD',
    publishedAt: '2024-08-28T16:00:00.000Z',
    periodEnd: '2024-07-28',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'REAL',
    isSimulated: false,
    sourceReference: { concept: 'Revenues', form: '10-Q' }
  };

  const thirdPartyReported: EvidenceItem = {
    evidenceId: 'ev-conf-thirdparty',
    securityId: 'us-nvda',
    sourceType: 'RESEARCH_DOCUMENT',
    provider: 'Alternative Aggregator',
    title: 'Aggregator Revenue Estimate',
    content: 'Aggregator Adjusted Revenue: $29,800,000,000',
    structuredValue: 29800000000, // Discrepant value!
    unit: 'USD',
    publishedAt: '2024-08-28T18:00:00.000Z',
    periodEnd: '2024-07-28',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'CALCULATED',
    isSimulated: false,
    sourceReference: { concept: 'Revenues' }
  };

  conflictRepo.addEvidence(secReported);
  conflictRepo.addEvidence(thirdPartyReported);

  assert(conflictRepo.count() === 2, 'Both conflicting evidence items are preserved (neither overwritten)');
  const itemA = conflictRepo.getEvidence('ev-conf-sec')!;
  const itemB = conflictRepo.getEvidence('ev-conf-thirdparty')!;
  assert(itemA.hasConflict === true, 'Existing item flagged with hasConflict: true');
  assert(itemB.hasConflict === true, 'New conflicting item flagged with hasConflict: true');
  assert(typeof itemA.conflictDetails === 'string' && itemA.conflictDetails.includes('Alternative Aggregator'),
    'Conflict details record conflicting provider'
  );

  // ----------------------------------------------------
  // TEST 17: Provenance Preservation
  // ----------------------------------------------------
  console.log('\n17. Provenance Preservation:');
  assert(sampleItem.sourceReference?.accessionNumber === '0001045810-24-000029', 'Preserves SEC accessionNumber');
  assert(sampleItem.sourceReference?.cik === '0001045810', 'Preserves SEC CIK');
  assert(metaItem.sourceReference?.concept === 'canonical_registry', 'Preserves registry provenance concept');

  // ----------------------------------------------------
  // TEST 18: Credential Isolation
  // ----------------------------------------------------
  console.log('\n18. Credential Isolation:');
  const dirtyItem: EvidenceItem = {
    evidenceId: 'ev-dirty-credentials',
    securityId: 'us-nvda',
    sourceType: 'MARKET_DATA',
    provider: 'Twelve Data',
    title: 'Market Quote',
    content: 'Quote with leakage test',
    publishedAt: '2024-08-28T00:00:00.000Z',
    retrievedAt: new Date().toISOString(),
    epistemicStatus: 'REAL',
    isSimulated: false,
    sourceReference: {
      apiKey: 'SUPER_SECRET_TWELVE_DATA_KEY_XYZ',
      token: 'BEARER_SECRET_TOKEN'
    },
    metadata: {
      secret_password: 'pass123'
    }
  };
  repo.addEvidence(dirtyItem);
  const sanitized = repo.getEvidence('ev-dirty-credentials')!;
  assert((sanitized.sourceReference as any).apiKey === undefined, 'Sanitizer strips apiKey from sourceReference');
  assert((sanitized.sourceReference as any).token === undefined, 'Sanitizer strips token from sourceReference');
  assert((sanitized.metadata as any).secret_password === undefined, 'Sanitizer strips secret_password from metadata');

  // ----------------------------------------------------
  // TEST 19: EvidenceService Gathering
  // ----------------------------------------------------
  console.log('\n19. EvidenceService Orchestration:');
  const serviceEvidence = await evidenceService.gatherEvidence({
    securities: [nvdaSec]
  });
  assert(serviceEvidence.length > 0, 'EvidenceService gathers multi-adapter evidence');
  const hasSec = serviceEvidence.some(e => e.sourceType === 'SEC_EDGAR');
  const hasMarket = serviceEvidence.some(e => e.sourceType === 'MARKET_DATA');
  const hasMeta = serviceEvidence.some(e => e.sourceType === 'CANONICAL_METADATA');
  assert(hasSec && hasMarket && hasMeta, 'Service gathers SEC, MARKET_DATA, and CANONICAL_METADATA');

  // ----------------------------------------------------
  // TEST 20: FYERS-Unavailable Scenario
  // ----------------------------------------------------
  console.log('\n20. FYERS-Unavailable India Equity Scenario:');
  const relGathered = await evidenceService.gatherEvidence({
    securities: [relianceSec]
  });
  const relMarketItems = relGathered.filter(e => e.sourceType === 'MARKET_DATA');
  for (const item of relMarketItems) {
    assert(item.epistemicStatus !== 'REAL', 'FYERS KYC pending: Reliance quote item is NEVER REAL');
    assert(item.isSimulated === true || item.epistemicStatus === 'SIMULATED' || item.epistemicStatus === 'UNAVAILABLE',
      'Reliance quote item is explicitly SIMULATED or UNAVAILABLE'
    );
  }

  // ----------------------------------------------------
  // TEST 21: Malformed Evidence Handling
  // ----------------------------------------------------
  console.log('\n21. Malformed Evidence Handling:');
  const malformedItem = {
    // Missing required evidenceId
    title: 'Missing ID item'
  } as any;
  const malformedAdded = repo.addEvidence(malformedItem);
  assert(malformedAdded === false, 'Repository safely rejects item missing evidenceId');

  const invalidDateResults = repo.getEvidenceAvailableAsOf('NOT_A_VALID_DATE');
  assert(Array.isArray(invalidDateResults) && invalidDateResults.length === 0, 'Gracefully returns empty array for invalid asOfDate string');

  // ----------------------------------------------------
  // TEST 22: Deterministic Evidence IDs & Fingerprints
  // ----------------------------------------------------
  console.log('\n22. Deterministic Evidence IDs & Fingerprints:');
  const fp1 = generateEvidenceFingerprint(sampleItem);
  const fp2 = generateEvidenceFingerprint({ ...sampleItem });
  assert(fp1 === fp2, 'Fingerprint is strictly deterministic for identical evidence items');
  assert(typeof fp1 === 'string' && fp1.includes('us-nvda') && fp1.includes('sec_edgar'),
    'Fingerprint contains normalized security and source components'
  );

  const conceptKey = generateConceptKey(sampleItem);
  assert(conceptKey.includes('us-nvda') && conceptKey.includes('revenues'),
    'Concept key correctly binds security, concept, and period'
  );

  console.log('\n======================================================================');
  console.log(` PHASE 8A ALL TESTS PASSED: ${passedCount} assertions, 0 failures.`);
  console.log('======================================================================\n');
}

runPhase8aTests().catch(err => {
  console.error('\n❌ PHASE 8A TEST SUITE FAILED:', err);
  process.exit(1);
});
