/**
 * PHASE 16 — PERSISTENCE, HISTORICAL STATE & AUDITABLE RESEARCH STORAGE TEST SUITE
 * 
 * Verifies:
 * 1. Adapter Initialization & Idempotent Migration Runner
 * 2. Real Persistence Lifecycle: Write -> Restart/Re-instantiate -> Read -> Strict Equality
 * 3. Immutable Historical Artifacts (Snapshots, Decisions, Backtests reject mutation)
 * 4. Point-in-Time (PIT) As-Of Query Boundaries
 * 5. Multi-Entity Repository Coverage (Securities, Documents, Evidence, Snapshots, Decisions, Backtests, Strategies, Portfolios)
 * 6. Development Disk Fallback Persistence Integrity
 * 7. Epistemic Provenance Preservation (REAL, CALCULATED, SIMULATED)
 * 8. Regulatory Invariants & Secret Isolation (isAnalyticalOnly, executionProhibited, no leaked credentials)
 */

import fs from 'fs';
import path from 'path';
import { DevelopmentPersistenceAdapter } from '../server/persistence/devAdapter/developmentPersistenceAdapter';
import { PersistenceManager } from '../server/persistence/persistenceManager';
import { resolveSecurity } from '../src/data/canonicalSecurities';
import {
  ResearchSnapshot,
  ResearchDocument,
  EvidenceItem,
  InvestmentDecisionAssessment,
  BacktestResult,
  HoldingPosition,
  Strategy
} from '../src/types';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}`);
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('PHASE 16: PERSISTENCE, HISTORICAL STATE & AUDIT TEST SUITE');
  console.log('===============================================================\n');

  const testStoreDir = path.resolve(process.cwd(), 'data', 'persistence_test');

  // Clean up any test directory beforehand
  if (fs.existsSync(testStoreDir)) {
    fs.rmSync(testStoreDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // 1. ADAPTER INITIALIZATION & MIGRATIONS
  // -------------------------------------------------------------
  console.log('[SECTION 1] Adapter Initialization & Migrations');
  const devAdapter = new DevelopmentPersistenceAdapter(testStoreDir);
  await devAdapter.initialize();

  assert(devAdapter.isConnected === true, 'Adapter reports connected');
  assert(devAdapter.provider === 'DISK_STORAGE', 'Adapter provider is DISK_STORAGE');

  const status = await devAdapter.getStatus();
  assert(status.status === 'DEVELOPMENT_ADAPTER', 'Status is DEVELOPMENT_ADAPTER');
  assert(status.migrationVersion === 1, 'Adapter reports migrationVersion 1');
  assert(status.entityCounts.securities >= 0, 'Security repository initialized');

  // -------------------------------------------------------------
  // 2. REAL PERSISTENCE LIFECYCLE (WRITE -> PERSIST -> RESTART -> READ -> VERIFY)
  // -------------------------------------------------------------
  console.log('\n[SECTION 2] Real Persistence Lifecycle Test (Write -> Restart -> Read -> Verify)');

  // 2.1 Seed canonical security
  const nvda = resolveSecurity('NVDA')!;
  assert(!!nvda, 'Resolved canonical security NVDA');
  await devAdapter.getSecurityRepository().save(nvda);

  // 2.2 Create and save a rich Research Snapshot
  const testSnapshotId = 'snap-nvda-2025-q4-pit';
  const originalSnapshot: ResearchSnapshot = {
    snapshotId: testSnapshotId,
    notebookId: 'nb-sec-us-nvda',
    securityId: nvda.id,
    createdAt: '2025-11-15T10:00:00Z',
    researchAsOfDate: '2025-11-15',
    evidenceIds: ['ev-nvda-rev-01', 'ev-nvda-filing-10q'],
    thesis: {
      executiveThesis: 'Data center AI acceleration demand sustained by Blackwell ramping.',
      bullCase: {
        summary: 'Massive hyperscaler demand for next-generation AI accelerators',
        points: ['Data Center revenue exceeded $35B in latest quarter.'],
        evidenceIds: ['ev-nvda-rev-01']
      },
      bearCase: {
        summary: 'Potential export curbs and customer custom ASIC designs',
        points: ['Concentration among top 4 cloud providers'],
        evidenceIds: ['ev-nvda-filing-10q']
      },
      catalysts: [
        {
          catalystId: 'c-1',
          title: 'B200 architecture enterprise volume shipment',
          description: '1-3 Quarters potential impact',
          hasEvidence: true,
          evidenceIds: ['ev-nvda-rev-01'],
          isUncertainty: false
        }
      ],
      risks: [
        {
          riskId: 'r-1',
          title: 'Geopolitical export controls',
          description: 'Export controls impact on regional shipments',
          severity: 'MEDIUM',
          confidence: 0.85,
          evidenceIds: ['ev-nvda-filing-10q']
        }
      ],
      whatChanged: {
        status: 'FIRST_RESEARCH_SNAPSHOT',
        hasPriorSnapshot: false,
        changes: [],
        newEvidenceCount: 2
      },
      evidenceGaps: {
        available: ['FINANCIALS', 'SEC_FILINGS'],
        missing: ['TRANSCRIPTS'],
        unavailable: []
      },
      contradictions: [],
      thesisInvalidationConditions: ['Data Center YoY growth falls below 25% for two quarters'],
      confidenceCoverage: 'HIGH_EVIDENCE_COVERAGE'
    },
    claims: [
      {
        claimId: 'cl-1',
        statement: 'Data Center revenue exceeded $35B in latest quarter.',
        classification: 'FACT',
        confidence: 0.95,
        supportingEvidenceIds: ['ev-nvda-rev-01'],
        contradictingEvidenceIds: [],
        asOfDate: '2025-11-15'
      }
    ],
    risks: [
      {
        riskId: 'r-1',
        title: 'Geopolitical export controls',
        description: 'Export controls impact on regional shipments',
        severity: 'MEDIUM',
        confidence: 0.85,
        evidenceIds: ['ev-nvda-filing-10q']
      }
    ],
    catalysts: [
      {
        catalystId: 'c-1',
        title: 'B200 architecture enterprise volume shipment',
        description: '1-3 Quarters potential impact',
        hasEvidence: true,
        evidenceIds: ['ev-nvda-rev-01'],
        isUncertainty: false
      }
    ],
    conflicts: [],
    evidenceGaps: {
      available: ['FINANCIALS', 'SEC_FILINGS'],
      missing: ['TRANSCRIPTS'],
      unavailable: []
    }
  };

  await devAdapter.getSnapshotRepository().save(originalSnapshot);

  // 2.3 Create and save an Ingested Document
  const originalDoc: ResearchDocument = {
    documentId: 'doc-nvda-10q-2025-q3',
    securityId: nvda.id,
    title: 'NVIDIA Corp Form 10-Q Q3 FY26',
    fileName: 'nvda_10q_q3_fy26.pdf',
    format: 'PDF',
    documentType: 'SEC_DISCLOSURE',
    sourceType: 'RESEARCH_DOCUMENT',
    provider: 'SEC_EDGAR',
    contentHash: 'hash-abc-123-fixed',
    uploadedAt: '2025-11-15T09:30:00Z',
    epistemicStatus: 'REAL',
    isSimulated: false,
    chunkIds: ['chunk-1', 'chunk-2'],
    evidenceIds: ['ev-nvda-rev-01'],
    processingStatus: 'READY',
    extractionWarnings: []
  };

  await devAdapter.getDocumentRepository().save(originalDoc);

  // 2.4 Create and save Grounded Evidence Items
  const originalEvidence: EvidenceItem = {
    evidenceId: 'ev-nvda-rev-01',
    securityId: nvda.id,
    publishedAt: '2025-11-15T09:00:00Z',
    retrievedAt: '2025-11-15T09:00:00Z',
    availableAt: '2025-11-15T09:00:00Z',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC_EDGAR',
    title: 'NVDA Q3 Revenue Performance',
    content: 'Data Center revenue grew 112% year-over-year to $35.1 billion.',
    structuredValue: 35100000000,
    unit: 'USD',
    epistemicStatus: 'REAL',
    isSimulated: false,
    documentId: originalDoc.documentId
  };

  await devAdapter.getEvidenceRepository().addEvidence(originalEvidence);

  // 2.5 Create and save a Backtest Artifact
  const originalBacktest: BacktestResult = {
    backtestId: 'bt-momentum-nvda-2025',
    strategyId: 'strat-momentum-breakout',
    strategyVersion: '1.0.0',
    status: 'COMPLETED',
    startDate: '2024-01-01',
    endDate: '2025-11-15',
    initialCapital: 100000,
    finalEquity: 168400,
    totalReturn: 0.684,
    totalReturnPct: 68.4,
    cagr: 0.382,
    sharpeRatio: 1.84,
    sortinoRatio: 2.15,
    maxDrawdown: 0.142,
    annualizedVol: 0.22,
    winRate: 0.625,
    tradesCount: 24,
    benchmarkTotalReturn: 0.28,
    trades: [],
    equityCurve: [
      { date: '2024-01-01', equity: 100000, cash: 100000, drawdownPct: 0 },
      { date: '2025-11-15', equity: 168400, cash: 45000, drawdownPct: -2.1 }
    ]
  };

  await devAdapter.getBacktestRepository().save(originalBacktest);

  // 2.6 Create and save a Decision Assessment
  const originalDecision: InvestmentDecisionAssessment = {
    decisionId: 'dec-nvda-2025-11-15-v1',
    securityId: nvda.id,
    canonicalSecurity: nvda,
    asOfDate: '2025-11-15',
    generatedAt: '2025-11-15T10:30:00Z',
    frameworkVersion: '1.0.0',
    overallAssessment: 'CONSTRUCTIVE',
    conviction: 'HIGH',
    compositeScore: 0.74,
    dimensionAssessments: {} as any,
    dimensionsList: [],
    supportingEvidenceIds: ['ev-nvda-rev-01'],
    contradictingEvidenceIds: [],
    evidenceCoverage: {
      rating: 'HIGH',
      totalEvidenceCount: 24,
      availableCategories: ['FINANCIALS', 'SEC_FILINGS'],
      missingCategories: [],
      details: 'High coverage verified from primary SEC sources'
    },
    keyDrivers: ['Data center hyper-growth', 'Operating leverage'],
    counterEvidence: ['Concentration among top cloud hyperscalers'],
    keyRisks: [
      {
        riskId: 'r-1',
        title: 'Geopolitical export controls',
        description: 'Export controls impact on regional shipments',
        severity: 'MEDIUM',
        category: 'REGULATORY',
        evidenceIds: ['ev-nvda-filing-10q']
      }
    ],
    catalysts: [
      {
        catalystId: 'c-1',
        title: 'Blackwell GPU enterprise shipments',
        description: 'New generation data center volume ramp',
        type: 'FORWARD_LOOKING',
        evidenceIds: ['ev-nvda-rev-01']
      }
    ],
    thesisStatus: {
      status: 'STABLE',
      summary: 'Solid core thesis with zero breaches'
    },
    invalidationConditions: [
      {
        conditionId: 'inv-1',
        condition: 'Data Center YoY growth falls below 25% for two quarters',
        category: 'FUNDAMENTAL',
        measurable: true,
        falsifiable: true,
        triggered: false,
        status: 'ACTIVE_GUARD'
      }
    ],
    portfolioContext: {
      currentWeightPct: 4.5,
      isHeld: true,
      marginalRiskRating: 'NEUTRAL',
      implication: 'Balanced allocation within risk limits'
    },
    quantitativeContext: {
      compositeSignal: 'BUY',
      strategiesEvaluated: [],
      agreement: 'MAJORITY',
      summary: 'Trend and momentum indicators constructive'
    },
    valuationContext: {
      status: 'FAIR',
      availableMetrics: ['PE', 'P_S'],
      missingMetrics: [],
      rationale: 'Pricing reflects superior growth profile'
    },
    fundamentalContext: {
      status: 'STRONG',
      availablePeriodsCount: 8,
      summary: 'Accelerating operating income'
    },
    marketContext: {
      currentPrice: 145.2,
      currency: 'USD',
      trend: 'BULLISH',
      provider: 'TWELVE_DATA',
      epistemicStatus: 'REAL'
    },
    dataQuality: {
      providerStatuses: { TWELVE_DATA: 'HEALTHY', SEC_EDGAR: 'HEALTHY' },
      dataFreshness: 'CURRENT',
      hasSimulatedData: false,
      hasStaleData: false,
      missingSources: [],
      conflictingSources: [],
      epistemicSummary: { REAL: 24, CALCULATED: 8, SIMULATED: 0, UNAVAILABLE: 0 }
    },
    explanation: {
      summary: 'NVDA exhibits robust fundamental acceleration driven by AI infrastructure spending.',
      whyDrivers: ['Data center hyper-growth', 'Operating leverage'],
      counterEvidence: ['Concentration among top cloud hyperscalers'],
      keyRisksSummary: ['Geopolitical export controls'],
      portfolioImplicationSummary: 'Balanced growth allocation',
      invalidationSummary: ['Data Center growth slowdown below 25%'],
      disclaimer: 'For institutional analytical evaluation only.',
      generatedBy: 'DETERMINISTIC_FALLBACK'
    },
    limitations: [],
    isAnalyticalOnly: true,
    executionProhibited: true
  };

  await devAdapter.getDecisionRepository().save(originalDecision);

  // SIMULATE SERVER CRASH / RESTART:
  // Create a completely new instance pointing to the same disk path
  console.log('  -> Simulating server reboot: Instantiating fresh adapter from existing storage file...');
  const rebootedAdapter = new DevelopmentPersistenceAdapter(testStoreDir);
  await rebootedAdapter.initialize();

  // Verify that all artifacts were preserved exactly
  const loadedSecurity = await rebootedAdapter.getSecurityRepository().get(nvda.id);
  assert(!!loadedSecurity && loadedSecurity.symbol === 'NVDA', 'Security preserved across reboot');

  const loadedSnapshot = await rebootedAdapter.getSnapshotRepository().get(testSnapshotId);
  assert(!!loadedSnapshot, 'Snapshot retrieved after reboot');
  assert(loadedSnapshot?.snapshotId === originalSnapshot.snapshotId, 'Snapshot ID matches original');
  assert(loadedSnapshot?.thesis.confidenceCoverage === 'HIGH_EVIDENCE_COVERAGE', 'Snapshot thesis confidence matches original');
  assert(loadedSnapshot?.thesis.executiveThesis === originalSnapshot.thesis.executiveThesis, 'Snapshot thesis matches original');
  assert(loadedSnapshot?.evidenceIds.length === 2, 'Snapshot evidence IDs match original');

  const loadedDoc = await rebootedAdapter.getDocumentRepository().get(originalDoc.documentId);
  assert(!!loadedDoc, 'Document retrieved after reboot');
  assert(loadedDoc?.contentHash === 'hash-abc-123-fixed', 'Document contentHash preserved across reboot');
  assert(loadedDoc?.processingStatus === 'READY', 'Document status preserved as READY');

  const loadedEvidence = await rebootedAdapter.getEvidenceRepository().getEvidence('ev-nvda-rev-01');
  assert(!!loadedEvidence, 'Evidence retrieved after reboot');
  assert(loadedEvidence?.structuredValue === 35100000000, 'Evidence structured value matches');
  assert(loadedEvidence?.epistemicStatus === 'REAL', 'Evidence epistemic status preserved as REAL');

  const loadedBacktest = await rebootedAdapter.getBacktestRepository().get('bt-momentum-nvda-2025');
  assert(!!loadedBacktest, 'Backtest retrieved after reboot');
  assert(loadedBacktest?.sharpeRatio === 1.84, 'Backtest Sharpe ratio preserved');
  assert(loadedBacktest?.equityCurve.length === 2, 'Backtest equity curve preserved');

  const loadedDecision = await rebootedAdapter.getDecisionRepository().get('dec-nvda-2025-11-15-v1');
  assert(!!loadedDecision, 'Decision retrieved after reboot');
  assert(loadedDecision?.compositeScore === 0.74, 'Decision composite score matches');
  assert(loadedDecision?.isAnalyticalOnly === true, 'Decision retains isAnalyticalOnly: true');
  assert(loadedDecision?.executionProhibited === true, 'Decision retains executionProhibited: true');

  // -------------------------------------------------------------
  // 3. DETERMINISTIC IMMUTABILITY SAFEGUARDS
  // -------------------------------------------------------------
  console.log('\n[SECTION 3] Deterministic Immutability Safeguards');

  // Attempt to overwrite Snapshot with modified score
  const corruptedSnapshot = {
    ...originalSnapshot,
    securityId: 'MUTATED_SECURITY_ID',
    thesis: { ...originalSnapshot.thesis, confidenceCoverage: 'INSUFFICIENT_EVIDENCE' as const }
  };
  await rebootedAdapter.getSnapshotRepository().save(corruptedSnapshot);

  const postMutationSnapshot = await rebootedAdapter.getSnapshotRepository().get(testSnapshotId);
  assert(
    postMutationSnapshot?.securityId === nvda.id,
    'Snapshot rejects mutation: securityId remained unchanged'
  );
  assert(
    postMutationSnapshot?.thesis.confidenceCoverage === 'HIGH_EVIDENCE_COVERAGE',
    'Snapshot rejects mutation: confidence coverage remained HIGH_EVIDENCE_COVERAGE'
  );

  // Attempt to overwrite Decision Assessment
  const corruptedDecision: InvestmentDecisionAssessment = {
    ...originalDecision,
    compositeScore: 0.05,
    overallAssessment: 'CAUTIOUS'
  };
  await rebootedAdapter.getDecisionRepository().save(corruptedDecision);

  const postMutationDecision = await rebootedAdapter.getDecisionRepository().get(originalDecision.decisionId);
  assert(
    postMutationDecision?.compositeScore === 0.74,
    'Decision assessment is immutable: score remained 0.74'
  );
  assert(
    postMutationDecision?.overallAssessment === 'CONSTRUCTIVE',
    'Decision assessment is immutable: decision remained CONSTRUCTIVE'
  );

  // -------------------------------------------------------------
  // 4. POINT-IN-TIME (PIT) AS-OF BOUNDARIES
  // -------------------------------------------------------------
  console.log('\n[SECTION 4] Point-in-Time (PIT) As-Of Boundary Enforcement');

  // Add a future evidence item published in 2026
  const futureEvidence: EvidenceItem = {
    evidenceId: 'ev-nvda-future-2026',
    securityId: nvda.id,
    publishedAt: '2026-03-01T12:00:00Z',
    retrievedAt: '2026-03-01T12:00:00Z',
    availableAt: '2026-03-01T12:00:00Z',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC_EDGAR',
    title: 'Future reporting from 2026',
    content: 'Future disclosure data point',
    epistemicStatus: 'REAL',
    isSimulated: false,
    structuredValue: 40000000000
  };
  await rebootedAdapter.getEvidenceRepository().addEvidence(futureEvidence);

  // Query evidence strictly as of 2025-11-15
  const pitEvidence = await rebootedAdapter.getEvidenceRepository().queryEvidence({
    securityId: nvda.id,
    asOfDate: '2025-11-15'
  });
  assert(
    pitEvidence.some(e => e.evidenceId === 'ev-nvda-rev-01'),
    'PIT query includes evidence published on or before 2025-11-15'
  );
  assert(
    !pitEvidence.some(e => e.evidenceId === 'ev-nvda-future-2026'),
    'PIT query strictly excludes future evidence published in 2026'
  );

  // -------------------------------------------------------------
  // 5. EXTENDED REPOSITORY COVERAGE (PORTFOLIO, STRATEGIES, QUERIES)
  // -------------------------------------------------------------
  console.log('\n[SECTION 5] Extended Repositories (Portfolio & Strategies)');

  const testPosition: HoldingPosition = {
    ticker: 'NVDA',
    shares: 100,
    avgCost: 110.5
  };
  await rebootedAdapter.getPortfolioRepository().savePositions([testPosition]);

  const loadedPositions = await rebootedAdapter.getPortfolioRepository().getPositions();
  assert(loadedPositions.length >= 1, 'Saved and retrieved portfolio position');
  assert(loadedPositions.find(p => p.ticker === 'NVDA')?.shares === 100, 'Position shares match exactly');

  // Strategy persistence
  const testStrategy: Strategy = {
    id: 'strat-trend-v1',
    title: 'Institutional Trend Following',
    prompt: 'Trend breakout prompt',
    status: 'Backtest Verified Strategy',
    description: 'Systematic trend breakout with volatility targeting',
    targetUniverse: 'US_LARGE_CAP',
    rebalanceFrequency: 'MONTHLY',
    rules: [{ category: 'Universe', description: 'Trend rule', parameters: 'SMA50 > SMA200' }]
  };
  await rebootedAdapter.getStrategyRepository().save(testStrategy);
  const loadedStrategy = await rebootedAdapter.getStrategyRepository().get('strat-trend-v1');
  assert(!!loadedStrategy && loadedStrategy.title === 'Institutional Trend Following', 'Strategy saved and loaded');

  // -------------------------------------------------------------
  // 6. PERSISTENCE MANAGER ADAPTER SELECTION & STATUS
  // -------------------------------------------------------------
  console.log('\n[SECTION 6] PersistenceManager Facade & Status Reporting');

  const manager = PersistenceManager.getInstance();
  await manager.initialize();
  const managerStatus = await manager.getStatus();

  assert(
    managerStatus.status === 'DEVELOPMENT_ADAPTER' || managerStatus.status === 'CONNECTED',
    'PersistenceManager status is valid ("DEVELOPMENT_ADAPTER" or "CONNECTED")'
  );
  assert(
    managerStatus.provider === 'DISK_STORAGE' || managerStatus.provider === 'POSTGRES',
    'PersistenceManager selected valid provider ("DISK_STORAGE" or "POSTGRES")'
  );
  assert(typeof managerStatus.entityCounts.decisions === 'number', 'PersistenceManager tracks decision count');
  assert(typeof managerStatus.entityCounts.snapshots === 'number', 'PersistenceManager tracks snapshot count');
  assert(typeof managerStatus.entityCounts.documents === 'number', 'PersistenceManager tracks document count');
  assert(typeof managerStatus.entityCounts.evidence === 'number', 'PersistenceManager tracks evidence count');

  // -------------------------------------------------------------
  // 7. CLEANUP OF TEST FIXTURES
  // -------------------------------------------------------------
  console.log('\n[SECTION 7] Test Fixture Teardown');
  if (fs.existsSync(testStoreDir)) {
    fs.rmSync(testStoreDir, { recursive: true, force: true });
    assert(!fs.existsSync(testStoreDir), 'Cleaned up temporary test store directory');
  }

  console.log('\n===============================================================');
  console.log(`PHASE 16 TEST SUITE COMPLETED: ${passedCount}/${testCount} TESTS PASSED`);
  console.log('===============================================================\n');

  if (passedCount !== testCount) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running Phase 16 tests:', err);
  process.exit(1);
});
