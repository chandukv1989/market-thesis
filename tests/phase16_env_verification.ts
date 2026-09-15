/**
 * Phase 16 — Deep Persistence Environment & Lifecycle Verification Script
 */

import fs from 'fs';
import path from 'path';
import { PersistenceManager } from '../server/persistence/persistenceManager';
import { DevelopmentPersistenceAdapter } from '../server/persistence/devAdapter/developmentPersistenceAdapter';
import { resolveSecurity } from '../src/data/canonicalSecurities';
import {
  EvidenceItem,
  ResearchSnapshot,
  InvestmentDecisionAssessment,
  BacktestResult
} from '../src/types';

async function runDeepVerification() {
  console.log('--- PHASE 16 DEEP PERSISTENCE VERIFICATION ---');

  // 1. Check DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  console.log('1. DATABASE_URL:', dbUrl ? '[CONFIGURED]' : '[NOT CONFIGURED]');

  // 2. Active adapter inspection
  const manager = PersistenceManager.getInstance();
  await manager.initialize();
  const status = await manager.getStatus();
  const adapter = manager.getAdapter();

  console.log('2. Active Adapter Constructor:', adapter.constructor.name);
  console.log('   Provider:', adapter.provider);
  console.log('   Status:', status.status);
  console.log('   isPostgresConfigured:', status.isPostgresConfigured);

  // 3. Isolated directory for Lifecycle test
  const tempVerifyDir = path.resolve(process.cwd(), 'data', 'temp_env_verify');
  if (fs.existsSync(tempVerifyDir)) {
    fs.rmSync(tempVerifyDir, { recursive: true, force: true });
  }

  const lifecycleAdapter1 = new DevelopmentPersistenceAdapter(tempVerifyDir);
  await lifecycleAdapter1.initialize();

  const sec = resolveSecurity('MSFT')!;

  // 6. WRITE ARTIFACTS
  const testEvidence: EvidenceItem = {
    evidenceId: 'ev-verify-msft-cloud-rev',
    securityId: sec.id,
    publishedAt: '2025-01-28T21:00:00Z',
    retrievedAt: '2025-01-28T21:05:00Z',
    availableAt: '2025-01-28T21:00:00Z',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC_EDGAR',
    title: 'Microsoft Cloud Revenue Q2 FY25',
    content: 'Microsoft Cloud revenue was $38.9 billion, up 22% year-over-year.',
    structuredValue: 38900000000,
    unit: 'USD',
    epistemicStatus: 'REAL',
    isSimulated: false
  };

  const testSnapshot: ResearchSnapshot = {
    snapshotId: 'snap-verify-msft-q2-pit',
    notebookId: 'nb-sec-us-msft',
    securityId: sec.id,
    createdAt: '2025-01-29T10:00:00Z',
    researchAsOfDate: '2025-01-29',
    evidenceIds: ['ev-verify-msft-cloud-rev'],
    thesis: {
      executiveThesis: 'Azure enterprise AI services adoption acceleration.',
      bullCase: {
        summary: 'Commercial cloud acceleration',
        points: ['Commercial cloud revenue exceeded $38.9B'],
        evidenceIds: ['ev-verify-msft-cloud-rev']
      },
      bearCase: {
        summary: 'Margin pressure from elevated CapEx',
        points: ['Capital expenditures reached $19B in the quarter'],
        evidenceIds: []
      },
      catalysts: [
        {
          catalystId: 'cat-verify-1',
          title: 'Copilot enterprise monetization scale',
          description: 'Expanding seat count across Office 365 enterprise base',
          hasEvidence: true,
          evidenceIds: ['ev-verify-msft-cloud-rev'],
          isUncertainty: false
        }
      ],
      risks: [
        {
          riskId: 'risk-verify-1',
          title: 'Data center capacity constraints',
          description: 'Near term GPU and power constraints',
          severity: 'LOW',
          confidence: 0.9,
          evidenceIds: []
        }
      ],
      whatChanged: {
        status: 'FIRST_RESEARCH_SNAPSHOT',
        hasPriorSnapshot: false,
        changes: [],
        newEvidenceCount: 1
      },
      evidenceGaps: {
        available: ['SEC_FILINGS'],
        missing: ['TRANSCRIPTS'],
        unavailable: []
      },
      contradictions: [],
      thesisInvalidationConditions: ['Azure growth decelerates below 20%'],
      confidenceCoverage: 'HIGH_EVIDENCE_COVERAGE'
    },
    claims: [
      {
        claimId: 'cl-msft-1',
        statement: 'Microsoft Cloud revenue was $38.9 billion',
        classification: 'FACT',
        confidence: 0.98,
        supportingEvidenceIds: ['ev-verify-msft-cloud-rev'],
        contradictingEvidenceIds: [],
        asOfDate: '2025-01-29'
      }
    ],
    risks: [],
    catalysts: [],
    conflicts: [],
    evidenceGaps: {
      available: ['SEC_FILINGS'],
      missing: ['TRANSCRIPTS'],
      unavailable: []
    }
  };

  const testDecision: InvestmentDecisionAssessment = {
    decisionId: 'dec-verify-msft-2025-01-29',
    securityId: sec.id,
    canonicalSecurity: sec,
    asOfDate: '2025-01-29',
    generatedAt: '2025-01-29T11:00:00Z',
    frameworkVersion: '1.0.0',
    overallAssessment: 'POSITIVE',
    conviction: 'HIGH',
    compositeScore: 0.82,
    dimensionAssessments: {} as any,
    dimensionsList: [],
    supportingEvidenceIds: ['ev-verify-msft-cloud-rev'],
    contradictingEvidenceIds: [],
    evidenceCoverage: {
      rating: 'HIGH',
      totalEvidenceCount: 18,
      availableCategories: ['FINANCIALS', 'SEC_FILINGS'],
      missingCategories: [],
      details: 'Grounded in SEC EDGAR disclosures'
    },
    keyDrivers: ['Azure cloud momentum', 'Enterprise monetization'],
    counterEvidence: ['High CapEx intensity'],
    keyRisks: [
      {
        riskId: 'r-msft-1',
        title: 'Infrastructure capacity constraints',
        description: 'CapEx capacity ramp required to meet backlog',
        severity: 'LOW',
        category: 'OPERATIONAL',
        evidenceIds: []
      }
    ],
    catalysts: [],
    thesisStatus: {
      status: 'STABLE',
      summary: 'Stable compounder'
    },
    invalidationConditions: [],
    portfolioContext: {
      isHeld: true,
      currentWeightPct: 6.0,
      marginalRiskRating: 'FAVORABLE',
      implication: 'Core holding'
    },
    quantitativeContext: {
      compositeSignal: 'BUY',
      strategiesEvaluated: [],
      agreement: 'UNANIMOUS',
      summary: 'Strong technical and fundamental alignment'
    },
    valuationContext: {
      status: 'FAIR',
      availableMetrics: ['PE'],
      missingMetrics: [],
      rationale: 'Trading at historical average multiple'
    },
    fundamentalContext: {
      status: 'STRONG',
      availablePeriodsCount: 8,
      summary: 'Double digit top-line and operating profit expansion'
    },
    marketContext: {
      currentPrice: 425.5,
      currency: 'USD',
      trend: 'BULLISH',
      provider: 'TWELVE_DATA',
      epistemicStatus: 'REAL'
    },
    dataQuality: {
      providerStatuses: { SEC_EDGAR: 'HEALTHY' },
      dataFreshness: 'CURRENT',
      hasSimulatedData: false,
      hasStaleData: false,
      missingSources: [],
      conflictingSources: [],
      epistemicSummary: { REAL: 18, CALCULATED: 4, SIMULATED: 0, UNAVAILABLE: 0 }
    },
    explanation: {
      summary: 'MSFT shows durable enterprise cloud leadership.',
      whyDrivers: ['Azure momentum'],
      counterEvidence: ['High CapEx intensity'],
      keyRisksSummary: ['Capacity constraints'],
      portfolioImplicationSummary: 'Maintain target sizing',
      invalidationSummary: ['Growth below 20%'],
      disclaimer: 'Institutional analytical evaluation only.',
      generatedBy: 'DETERMINISTIC_FALLBACK'
    },
    limitations: [],
    isAnalyticalOnly: true,
    executionProhibited: true
  };

  const testBacktest: BacktestResult = {
    backtestId: 'bt-verify-msft-breakout',
    strategyId: 'strat-quality-momentum',
    strategyVersion: '1.0.0',
    status: 'COMPLETED',
    startDate: '2023-01-01',
    endDate: '2025-01-29',
    initialCapital: 100000,
    finalEquity: 154200,
    totalReturn: 0.542,
    totalReturnPct: 54.2,
    cagr: 0.241,
    sharpeRatio: 1.62,
    sortinoRatio: 1.95,
    maxDrawdown: 0.118,
    annualizedVol: 0.165,
    winRate: 0.64,
    tradesCount: 18,
    benchmarkTotalReturn: 0.35,
    trades: [],
    equityCurve: [
      { date: '2023-01-01', equity: 100000, cash: 100000, drawdownPct: 0 },
      { date: '2025-01-29', equity: 154200, cash: 32000, drawdownPct: -1.2 }
    ]
  };

  // Perform Writes
  console.log('\n--- Performing Writes ---');
  await lifecycleAdapter1.getEvidenceRepository().addEvidence(testEvidence);
  await lifecycleAdapter1.getSnapshotRepository().save(testSnapshot);
  await lifecycleAdapter1.getDecisionRepository().save(testDecision);
  await lifecycleAdapter1.getBacktestRepository().save(testBacktest);
  console.log('Writes completed successfully.');

  // REINITIALIZE / REBOOT ADAPTER FROM DISK
  console.log('\n--- Reinitializing / Restarting Adapter from Disk ---');
  const lifecycleAdapter2 = new DevelopmentPersistenceAdapter(tempVerifyDir);
  await lifecycleAdapter2.initialize();

  // READ AND EXACT COMPARISON
  console.log('\n--- Reading and Exact Comparison ---');
  const readEvidence = await lifecycleAdapter2.getEvidenceRepository().getEvidence(testEvidence.evidenceId);
  const readSnapshot = await lifecycleAdapter2.getSnapshotRepository().get(testSnapshot.snapshotId);
  const readDecision = await lifecycleAdapter2.getDecisionRepository().get(testDecision.decisionId);
  const readBacktest = await lifecycleAdapter2.getBacktestRepository().get(testBacktest.backtestId);

  const evidenceExact = (
    readEvidence?.evidenceId === testEvidence.evidenceId &&
    readEvidence?.title === testEvidence.title &&
    readEvidence?.content === testEvidence.content &&
    readEvidence?.structuredValue === testEvidence.structuredValue &&
    readEvidence?.epistemicStatus === testEvidence.epistemicStatus &&
    readEvidence?.publishedAt === testEvidence.publishedAt
  );
  console.log('Evidence Exact Match:', evidenceExact ? 'PASS' : 'FAIL');

  const snapshotExact = (
    readSnapshot?.snapshotId === testSnapshot.snapshotId &&
    readSnapshot?.securityId === testSnapshot.securityId &&
    readSnapshot?.researchAsOfDate === testSnapshot.researchAsOfDate &&
    readSnapshot?.thesis.executiveThesis === testSnapshot.thesis.executiveThesis &&
    readSnapshot?.thesis.confidenceCoverage === testSnapshot.thesis.confidenceCoverage &&
    readSnapshot?.claims.length === testSnapshot.claims.length
  );
  console.log('Snapshot Exact Match:', snapshotExact ? 'PASS' : 'FAIL');

  const decisionExact = (
    readDecision?.decisionId === testDecision.decisionId &&
    readDecision?.securityId === testDecision.securityId &&
    readDecision?.asOfDate === testDecision.asOfDate &&
    readDecision?.compositeScore === testDecision.compositeScore &&
    readDecision?.overallAssessment === testDecision.overallAssessment &&
    readDecision?.conviction === testDecision.conviction &&
    readDecision?.isAnalyticalOnly === true &&
    readDecision?.executionProhibited === true
  );
  console.log('Decision Exact Match:', decisionExact ? 'PASS' : 'FAIL');

  const backtestExact = (
    readBacktest?.backtestId === testBacktest.backtestId &&
    readBacktest?.strategyId === testBacktest.strategyId &&
    readBacktest?.sharpeRatio === testBacktest.sharpeRatio &&
    readBacktest?.cagr === testBacktest.cagr &&
    readBacktest?.equityCurve.length === testBacktest.equityCurve.length
  );
  console.log('Backtest Exact Match:', backtestExact ? 'PASS' : 'FAIL');

  // 7 & 8: Historical Immutability Test
  console.log('\n--- Historical Immutability Verification ---');
  // Attempt to mutate evidence
  const mutatedEvidence: EvidenceItem = {
    ...testEvidence,
    title: 'MUTATED TITLE',
    structuredValue: 99999999999
  };
  await lifecycleAdapter2.getEvidenceRepository().addEvidence(mutatedEvidence);
  const checkEvidence = await lifecycleAdapter2.getEvidenceRepository().getEvidence(testEvidence.evidenceId);
  const evidenceImmutable = checkEvidence?.title === testEvidence.title && checkEvidence?.structuredValue === testEvidence.structuredValue;

  // Attempt to mutate snapshot
  const mutatedSnapshot: ResearchSnapshot = {
    ...testSnapshot,
    thesis: { ...testSnapshot.thesis, executiveThesis: 'MUTATED THESIS' }
  };
  await lifecycleAdapter2.getSnapshotRepository().save(mutatedSnapshot);
  const checkSnapshot = await lifecycleAdapter2.getSnapshotRepository().get(testSnapshot.snapshotId);
  const snapshotImmutable = checkSnapshot?.thesis.executiveThesis === testSnapshot.thesis.executiveThesis;

  // Attempt to mutate decision
  const mutatedDecision: InvestmentDecisionAssessment = {
    ...testDecision,
    compositeScore: -0.99,
    overallAssessment: 'NEGATIVE'
  };
  await lifecycleAdapter2.getDecisionRepository().save(mutatedDecision);
  const checkDecision = await lifecycleAdapter2.getDecisionRepository().get(testDecision.decisionId);
  const decisionImmutable = checkDecision?.compositeScore === testDecision.compositeScore && checkDecision?.overallAssessment === testDecision.overallAssessment;

  // Attempt to mutate backtest
  const mutatedBacktest: BacktestResult = {
    ...testBacktest,
    sharpeRatio: -5.0,
    cagr: -0.9
  };
  await lifecycleAdapter2.getBacktestRepository().save(mutatedBacktest);
  const checkBacktest = await lifecycleAdapter2.getBacktestRepository().get(testBacktest.backtestId);
  const backtestImmutable = checkBacktest?.sharpeRatio === testBacktest.sharpeRatio;

  const immutabilityPass = evidenceImmutable && snapshotImmutable && decisionImmutable && backtestImmutable;
  console.log('Historical Immutability (Evidence):', evidenceImmutable ? 'PASS' : 'FAIL');
  console.log('Historical Immutability (Snapshot):', snapshotImmutable ? 'PASS' : 'FAIL');
  console.log('Historical Immutability (Decision):', decisionImmutable ? 'PASS' : 'FAIL');
  console.log('Historical Immutability (Backtest):', backtestImmutable ? 'PASS' : 'FAIL');
  console.log('Overall Historical Immutability:', immutabilityPass ? 'PASS' : 'FAIL');

  // 9. Point-in-Time behavior after reload
  console.log('\n--- Point-in-Time (PIT) After Reload Verification ---');
  // Add another future item published on 2025-06-01
  const futureItem: EvidenceItem = {
    evidenceId: 'ev-verify-msft-future-q4',
    securityId: sec.id,
    publishedAt: '2025-06-01T12:00:00Z',
    retrievedAt: '2025-06-01T12:00:00Z',
    availableAt: '2025-06-01T12:00:00Z',
    sourceType: 'SEC_EDGAR',
    provider: 'SEC_EDGAR',
    title: 'Future Microsoft Filing Q4',
    content: 'Future data content',
    epistemicStatus: 'REAL',
    isSimulated: false
  };
  await lifecycleAdapter2.getEvidenceRepository().addEvidence(futureItem);

  // Reload adapter once more to verify PIT directly against reloaded disk state
  const pitAdapter = new DevelopmentPersistenceAdapter(tempVerifyDir);
  await pitAdapter.initialize();

  const pitQueryHistorical = await pitAdapter.getEvidenceRepository().queryEvidence({
    securityId: sec.id,
    asOfDate: '2025-01-29'
  });

  const includesPast = pitQueryHistorical.some(e => e.evidenceId === testEvidence.evidenceId);
  const excludesFuture = !pitQueryHistorical.some(e => e.evidenceId === futureItem.evidenceId);
  const pitPass = includesPast && excludesFuture;
  console.log('PIT includes past evidence (<= 2025-01-29):', includesPast ? 'PASS' : 'FAIL');
  console.log('PIT excludes future evidence (> 2025-01-29):', excludesFuture ? 'PASS' : 'FAIL');
  console.log('PIT Behavior After Reload:', pitPass ? 'PASS' : 'FAIL');

  // Clean up temp dir
  if (fs.existsSync(tempVerifyDir)) {
    fs.rmSync(tempVerifyDir, { recursive: true, force: true });
  }

  // 10. Credential isolation audit
  console.log('\n--- Credential Isolation Audit ---');
  const forbiddenKeys = [
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'FYERS_APP_ID',
    'FYERS_SECRET_KEY',
    'FYERS_ACCESS_TOKEN',
    'TWELVE_DATA_API_KEY',
    'SEC_API_USER_AGENT'
  ];

  // Check persistence status output
  const statusStr = JSON.stringify(status);
  let exposedInStatus = false;
  for (const key of forbiddenKeys) {
    const val = process.env[key];
    if (val && val.length > 3 && statusStr.includes(val)) {
      console.error(`CRITICAL: Secret value of ${key} found in status output!`);
      exposedInStatus = true;
    }
  }
  console.log('Secrets in Persistence Status Response:', exposedInStatus ? 'EXPOSED (FAIL)' : 'CLEAN (PASS)');

  // Return full verification metrics
  return {
    isPostgresConfigured: Boolean(process.env.DATABASE_URL),
    activeAdapter: adapter.constructor.name,
    provider: adapter.provider,
    restartPersistence: evidenceExact && snapshotExact && decisionExact && backtestExact,
    evidenceExact,
    snapshotExact,
    decisionExact,
    backtestExact,
    immutabilityPass,
    pitPass,
    credentialIsolation: !exposedInStatus
  };
}

runDeepVerification()
  .then(res => {
    console.log('\n--- VERIFICATION COMPLETED ---');
    console.log(JSON.stringify(res, null, 2));
  })
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
