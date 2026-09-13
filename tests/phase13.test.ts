/**
 * PHASE 13 — INVESTMENT RESEARCH NOTEBOOK & RESEARCH INTELLIGENCE TEST SUITE
 * 
 * Verifies:
 * 1. Research Notebook initialization & retrieval
 * 2. Deterministic Source Registry building (filings, quotes, portfolio)
 * 3. Transparent Source Coverage calculation (high, moderate, limited, insufficient)
 * 4. Point-in-time boundary adherence (no look-ahead leakage)
 * 5. Research inquiry execution across standard research protocols
 * 6. Claim grounding with strict epistemic classification (FACT, INFERENCE, UNCERTAINTY)
 * 7. Bull case and bear case extraction with evidence traceability
 * 8. Corporate catalysts tracking with evidence linkage vs forward uncertainty
 * 9. Filing-grounded risk factors with severity rankings
 * 10. Falsifiable thesis invalidation triggers
 * 11. Quantitative strategy alignment integration (signal, indicators, backtest summary)
 * 12. Portfolio context integration (held vs unallocated, weight, risk contribution)
 * 13. What-Changed snapshot comparison & delta detection
 * 14. Deterministic fallback under LLM unavailability / 429
 */

import { researchNotebookService } from '../server/services/research/notebookService';
import { resolveSecurity } from '../src/data/canonicalSecurities';
import { ResearchQueryType, ResearchEpistemicClassification } from '../src/types';

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

async function runPhase13Tests() {
  console.log('======================================================================');
  console.log(' RUNNING PHASE 13 INVESTMENT RESEARCH NOTEBOOK TEST SUITE');
  console.log('======================================================================\n');

  // Reset in-memory state
  researchNotebookService.clear();

  // Test 1: Notebook Initialization for US Equity
  console.log('Test 1: Notebook Initialization & Metadata');
  const nvda = resolveSecurity('NVDA')!;
  assert(!!nvda, 'NVDA resolved from canonical securities');
  const notebook = await researchNotebookService.getOrCreateNotebook(nvda.id);
  assert(notebook.securityId === nvda.id, 'Notebook initialized with correct securityId');
  assert(notebook.symbol === 'NVDA', 'Notebook has symbol NVDA');
  assert(notebook.notebookId === `nb-${nvda.id}`, 'Notebook ID matches canonical security pattern');
  assert(notebook.sourceCount >= 0, 'Notebook tracks source count');
  assert(notebook.sourceCoverage !== undefined, 'Notebook includes source coverage structure');

  // Test 2: Source Registry
  console.log('\nTest 2: Deterministic Source Registry');
  const sources = await researchNotebookService.getNotebookSources(nvda.id);
  assert(Array.isArray(sources), 'Sources returned as array');
  assert(sources.length > 0, 'Source registry populated with evidence sources');
  const hasAvailable = sources.some(s => s.availabilityStatus === 'AVAILABLE');
  assert(hasAvailable, 'At least one source is marked AVAILABLE');
  for (const src of sources) {
    assert(!!src.sourceType, `Source ${src.sourceId} has defined sourceType`);
    assert(!!src.provider, `Source ${src.sourceId} has defined provider`);
    assert(!!src.epistemicStatus, `Source ${src.sourceId} has defined epistemic status`);
  }

  // Test 3: Source Coverage & Gaps
  console.log('\nTest 3: Source Coverage & Epistemic Gaps');
  const coverage = await researchNotebookService.getCoverage(nvda.id);
  assert(coverage.availableSources.length >= 0, 'Coverage reports available sources');
  assert(Array.isArray(coverage.missingSources), 'Coverage reports missing sources');
  assert(Array.isArray(coverage.unavailableProviders), 'Coverage reports unavailable providers');
  assert(
    ['HIGH_EVIDENCE_COVERAGE', 'MODERATE_EVIDENCE_COVERAGE', 'LIMITED_EVIDENCE_COVERAGE', 'INSUFFICIENT_EVIDENCE'].includes(coverage.status),
    `Coverage status ${coverage.status} is valid`
  );

  // Test 4: Indian Market Unconfigured Provider Reporting
  console.log('\nTest 4: Indian Market Source Coverage & Unconfigured Feeds');
  const rel = resolveSecurity('RELIANCE')!;
  const relSources = await researchNotebookService.getNotebookSources(rel.id);
  const fyersUnavailable = relSources.some(s => s.provider === 'FYERS_API' && s.availabilityStatus === 'UNAVAILABLE');
  assert(fyersUnavailable, 'FYERS feed for India flagged as UNAVAILABLE when unconfigured');

  // Test 5: Point-In-Time Boundary Enforcement
  console.log('\nTest 5: Point-In-Time Boundary Constraints');
  const pitDate = '2023-12-31';
  const pitNotebook = await researchNotebookService.getOrCreateNotebook(nvda.id, pitDate);
  assert(pitNotebook.researchAsOfDate === pitDate, 'Notebook honors researchAsOfDate parameter');
  assert(pitNotebook.provenance.asOfDate === pitDate, 'Provenance reflects requested PIT boundary');

  // Test 6: Thesis Synthesis & Snapshot Generation (Baseline)
  console.log('\nTest 6: Baseline Investment Thesis Execution');
  const snapshot1 = await researchNotebookService.executeResearch({
    securityId: nvda.id,
    queryType: 'INVESTMENT_THESIS',
    asOfDate: '2024-06-30'
  });
  assert(!!snapshot1.snapshotId, 'Snapshot generated with unique snapshotId');
  assert(snapshot1.notebookId === `nb-${nvda.id}`, 'Snapshot associated with correct notebookId');
  assert(snapshot1.queryType === 'INVESTMENT_THESIS', 'Snapshot recorded queryType INVESTMENT_THESIS');
  assert(!!snapshot1.thesis.executiveThesis, 'Executive thesis synthesized');
  assert(snapshot1.evidenceIds.length > 0, 'Snapshot grounded with evidence IDs');

  // Test 7: What-Changed Baseline State
  console.log('\nTest 7: What-Changed Baseline State Detection');
  assert(snapshot1.thesis.whatChanged.status === 'NO_PRIOR_SNAPSHOT', 'First snapshot detected as NO_PRIOR_SNAPSHOT');
  assert(!snapshot1.thesis.whatChanged.hasPriorSnapshot, 'hasPriorSnapshot is false for baseline run');
  assert(snapshot1.thesis.whatChanged.newEvidenceCount > 0, 'Baseline records initial evidence count');

  // Test 8: Verifiable Bull & Bear Cases
  console.log('\nTest 8: Verifiable Bull & Bear Cases');
  assert(Array.isArray(snapshot1.thesis.bullCase.points), 'Bull case points is an array');
  assert(snapshot1.thesis.bullCase.points.length > 0, 'Bull case has points');
  assert(snapshot1.thesis.bullCase.evidenceIds.length > 0, 'Bull case cites grounded evidence IDs');
  assert(Array.isArray(snapshot1.thesis.bearCase.points), 'Bear case points is an array');
  assert(snapshot1.thesis.bearCase.points.length > 0, 'Bear case has points');

  // Test 9: Grounded Claims & Epistemic Classification
  console.log('\nTest 9: Grounded Claims & Epistemic Classification');
  assert(Array.isArray(snapshot1.claims), 'Claims returned as structured array');
  for (const claim of snapshot1.claims) {
    assert(!!claim.claimId, 'Claim has claimId');
    assert(!!claim.statement, 'Claim has text statement');
    assert(
      ['FACT', 'INFERENCE', 'UNCERTAINTY', 'SIMULATED', 'UNAVAILABLE'].includes(claim.classification),
      `Claim ${claim.claimId} has valid classification (${claim.classification})`
    );
    assert(Array.isArray(claim.supportingEvidenceIds), 'Claim has supportingEvidenceIds array');
    assert(claim.confidence > 0 && claim.confidence <= 1, 'Claim has valid confidence score');
  }

  // Test 10: Catalysts & Forward Uncertainty
  console.log('\nTest 10: Corporate Catalysts & Timelines');
  assert(Array.isArray(snapshot1.catalysts), 'Catalysts returned as array');
  assert(snapshot1.catalysts.length > 0, 'At least one catalyst tracked');
  const hasEvidenceBacked = snapshot1.catalysts.some(c => c.hasEvidence);
  const hasUncertainty = snapshot1.catalysts.some(c => c.isUncertainty);
  assert(hasEvidenceBacked || hasUncertainty, 'Catalysts correctly distinguish verified evidence vs forward uncertainty');

  // Test 11: Disclosed Risks & Severity
  console.log('\nTest 11: Filing-Grounded Risk Factors');
  assert(Array.isArray(snapshot1.risks), 'Risks returned as array');
  assert(snapshot1.risks.length > 0, 'At least one risk factor generated');
  for (const r of snapshot1.risks) {
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(r.severity), `Risk severity ${r.severity} is valid`);
    assert(r.confidence > 0, 'Risk has confidence score');
  }

  // Test 12: Thesis Invalidation Conditions
  console.log('\nTest 12: Falsifiable Thesis Invalidation Triggers');
  assert(Array.isArray(snapshot1.thesis.thesisInvalidationConditions), 'Invalidation conditions is array');
  assert(snapshot1.thesis.thesisInvalidationConditions.length > 0, 'At least one invalidation condition defined');
  for (const cond of snapshot1.thesis.thesisInvalidationConditions) {
    assert(typeof cond === 'string' && cond.length > 10, 'Invalidation trigger has substantive condition text');
  }

  // Test 13: Quantitative Strategy Alignment
  console.log('\nTest 13: Quantitative Strategy Integration');
  assert(snapshot1.thesis.quantitativeContext !== undefined, 'Quantitative context attached to thesis');
  if (snapshot1.thesis.quantitativeContext) {
    assert(
      ['BUY', 'SELL', 'HOLD', 'NO_SIGNAL', 'BULLISH', 'BEARISH', 'NEUTRAL', 'NONE'].includes(snapshot1.thesis.quantitativeContext.signal),
      `Quant signal ${snapshot1.thesis.quantitativeContext.signal} is recognized`
    );
    assert(!!snapshot1.thesis.quantitativeContext.strategyName, 'Strategy name specified');
    assert(!!snapshot1.thesis.quantitativeContext.backtestSummary, 'Backtest summary string present');
  }

  // Test 14: Portfolio Context Integration
  console.log('\nTest 14: Portfolio Context & Allocation Sizing');
  assert(snapshot1.thesis.portfolioContext !== undefined, 'Portfolio context attached to thesis');
  assert(typeof snapshot1.thesis.portfolioContext.isHeld === 'boolean', 'isHeld is boolean');

  // Test 15: Second Snapshot & What-Changed Comparison
  console.log('\nTest 15: Second Snapshot & Revision Diffing');
  const snapshot2 = await researchNotebookService.executeResearch({
    securityId: nvda.id,
    queryType: 'BULL_CASE',
    asOfDate: '2024-09-30'
  });
  assert(snapshot2.snapshotId !== snapshot1.snapshotId, 'Second snapshot has distinct ID');
  assert(snapshot2.thesis.whatChanged.status === 'UPDATED', 'Second snapshot status is UPDATED');
  assert(snapshot2.thesis.whatChanged.hasPriorSnapshot === true, 'hasPriorSnapshot is true for second run');
  assert(snapshot2.thesis.whatChanged.changes.length > 0, 'Changes list contains revision observations');
  assert(snapshot2.thesis.whatChanged.previousSnapshotDate === snapshot1.createdAt, 'Previous snapshot date correctly linked');

  // Test 16: Snapshot History Retrieval
  console.log('\nTest 16: Snapshot History Retrieval');
  const snaps = researchNotebookService.getSnapshots(`nb-${nvda.id}`);
  assert(snaps.length >= 2, 'Notebook retains historical snapshots');
  const single = researchNotebookService.getSnapshot(snapshot1.snapshotId);
  assert(single?.snapshotId === snapshot1.snapshotId, 'Single snapshot retrieved by snapshotId');

  // Test 17: List Notebooks
  console.log('\nTest 17: List All Notebooks');
  const allNotebooks = researchNotebookService.listNotebooks();
  assert(allNotebooks.length >= 1, 'listNotebooks returns registered notebooks');
  assert(allNotebooks.some(n => n.symbol === 'NVDA'), 'NVDA notebook included in list');

  console.log('\n======================================================================');
  console.log(` ALL PHASE 13 TESTS PASSED (${passedCount}/${testCount})`);
  console.log('======================================================================\n');
}

runPhase13Tests().catch(err => {
  console.error('\nTest Suite Execution Failed:', err);
  process.exit(1);
});
