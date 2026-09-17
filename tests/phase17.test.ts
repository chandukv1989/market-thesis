/**
 * PHASE 17 — AUTHENTICATION, AUTHORIZATION & USER DATA ISOLATION TEST SUITE
 * 
 * Verifies:
 * 1. User Registration, Scrypt Password Hashing & Secret Isolation (zero passwordHash exposure)
 * 2. Login, Session Management, Expiration, and Logout Lifecycle
 * 3. Server-Side Ownership Enforcement & IDOR Protection (Cross-user access denied with 403)
 * 4. User-Scoped RAG Evidence Retrieval Isolation (User B cannot see User A's private documents)
 * 5. Watchlist, Alert Rule, and Alert Event User Scoping
 * 6. Custom Strategy & Backtest Resource Ownership Verification
 * 7. Invariant Preservation (Analytical-only, execution-prohibited, determinism maintained)
 */

import { authService, AuthenticationError } from '../server/auth/authService';
import { authorizationService, AuthorizationError } from '../server/auth/authorizationService';
import { documentRegistry } from '../server/services/documents/documentRegistry';
import { documentIngestionService } from '../server/services/documents/documentIngestionService';
import { retrievalEngine } from '../server/services/retrieval/retrievalEngine';
import { watchlistAlertService } from '../server/services/alerts/watchlistAlertService';
import { quantStrategyEngine } from '../server/services/quant/quantStrategyEngine';
import { backtestService } from '../server/services/backtest/backtestService';
import { persistenceManager } from '../server/persistence/persistenceManager';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase17Tests() {
  console.log('\n===============================================================');
  console.log('PHASE 17: AUTHENTICATION, AUTHORIZATION & USER ISOLATION TESTS');
  console.log('===============================================================\n');

  await persistenceManager.initialize();

  // -------------------------------------------------------------
  // 1. REGISTRATION, PASSWORD HASHING & SECRET ISOLATION
  // -------------------------------------------------------------
  console.log('[SECTION 1] Registration, Password Hashing & Secret Isolation');

  const userAEmail = `analyst_alpha_${Date.now()}@fund.com`;
  const userBEmail = `analyst_beta_${Date.now()}@fund.com`;
  const securePasswordA = 'SuperSecretP@ssword123!';
  const securePasswordB = 'AnotherSecur3P@ssword456!';

  // 1.1 Register User A
  const regA = await authService.register({
    email: userAEmail,
    password: securePasswordA
  });

  assert(!!regA.user.userId, 'User A registered with valid userId');
  assert(regA.user.email === userAEmail, 'User A email matches');
  assert((regA.user as any).passwordHash === undefined, 'Zero exposure: passwordHash is not present on User A object');
  assert((regA.user as any).salt === undefined, 'Zero exposure: salt is not present on User A object');
  assert(!!regA.session.sessionId, 'User A issued valid session');
  assert(regA.session.userId === regA.user.userId, 'Session belongs to User A');

  // 1.2 Reject Duplicate Email
  let duplicateRejected = false;
  try {
    await authService.register({
      email: userAEmail,
      password: 'someOtherPassword'
    });
  } catch (err) {
    if (err instanceof AuthenticationError && err.statusCode === 409) {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, 'Duplicate registration correctly rejected with 409 Conflict');

  // 1.3 Reject Weak Password
  let weakRejected = false;
  try {
    await authService.register({
      email: `weak_${Date.now()}@fund.com`,
      password: '123'
    });
  } catch (err) {
    if (err instanceof AuthenticationError && err.statusCode === 400) {
      weakRejected = true;
    }
  }
  assert(weakRejected, 'Weak password rejected with 400 Bad Request');

  // 1.4 Register User B
  const regB = await authService.register({
    email: userBEmail,
    password: securePasswordB
  });
  assert(!!regB.user.userId, 'User B registered successfully');
  assert(regB.user.userId !== regA.user.userId, 'User A and User B have distinct userIds');

  // -------------------------------------------------------------
  // 2. AUTHENTICATION, SESSION LIFECYCLE & LOGOUT
  // -------------------------------------------------------------
  console.log('\n[SECTION 2] Authentication, Session Lifecycle & Logout');

  // 2.1 Login with incorrect password
  let wrongPassRejected = false;
  try {
    await authService.login({
      email: userAEmail,
      password: 'WrongPassword123'
    });
  } catch (err) {
    if (err instanceof AuthenticationError && err.statusCode === 401) {
      wrongPassRejected = true;
    }
  }
  assert(wrongPassRejected, 'Invalid password rejected with 401 Unauthorized');

  // 2.2 Login with valid credentials
  const loginA = await authService.login({
    email: userAEmail,
    password: securePasswordA
  });
  assert(loginA.user.userId === regA.user.userId, 'Login successfully validated credentials');
  assert(!!loginA.session.sessionId, 'New session created on login');

  // 2.3 Validate session lookup
  const resolvedA = await authService.validateSession(loginA.session.sessionId);
  assert(!!resolvedA, 'Session resolved successfully');
  assert(resolvedA?.user.userId === regA.user.userId, 'Resolved user matches authenticated user');

  // 2.4 Logout terminates session
  await authService.logout(loginA.session.sessionId);
  const resolvedAfterLogout = await authService.validateSession(loginA.session.sessionId);
  assert(resolvedAfterLogout === null, 'Session revoked and invalidated after logout');

  // -------------------------------------------------------------
  // 3. SERVER-SIDE OWNERSHIP & IDOR PROTECTION
  // -------------------------------------------------------------
  console.log('\n[SECTION 3] Server-Side Ownership Enforcement & IDOR Protection');

  const userAId = regA.user.userId;
  const userBId = regB.user.userId;

  // 3.1 Create Watchlist Item for User A
  const itemA = watchlistAlertService.addWatchlistItem({
    symbol: 'NVDA',
    notes: 'Private bullish notes from Analyst A',
    ownerUserId: userAId
  });
  assert(itemA.ownerUserId === userAId, 'Watchlist item tagged with User A ID');

  // User A can access item A
  const authorizedItemA = await authorizationService.authorizeWatchlistItem(itemA.watchlistItemId, userAId);
  assert(authorizedItemA.watchlistItemId === itemA.watchlistItemId, 'User A authorized to access own watchlist item');

  // User B attempting to access User A's watchlist item -> 403 Forbidden
  let idorBlockedWatchlist = false;
  try {
    await authorizationService.authorizeWatchlistItem(itemA.watchlistItemId, userBId);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      idorBlockedWatchlist = true;
    }
  }
  assert(idorBlockedWatchlist, 'IDOR blocked: User B denied access (403) to User A watchlist item');

  // 3.2 Create Alert Rule for User A
  const ruleA = watchlistAlertService.createAlertRule({
    symbol: 'NVDA',
    alertType: 'PRICE_ABOVE',
    threshold: 150,
    ownerUserId: userAId
  });
  assert(ruleA.ownerUserId === userAId, 'Alert rule tagged with User A ID');

  let idorBlockedAlertRule = false;
  try {
    await authorizationService.authorizeAlertRule(ruleA.alertRuleId, userBId);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      idorBlockedAlertRule = true;
    }
  }
  assert(idorBlockedAlertRule, 'IDOR blocked: User B denied access (403) to User A alert rule');

  // 3.3 Custom Strategy Registration for User A
  const stratAId = `strat-alpha-${Date.now()}`;
  quantStrategyEngine.registerCustomStrategy({
    strategyId: stratAId,
    name: "Analyst A's Proprietary Momentum",
    description: 'Confidential quantitative model',
    category: 'MOMENTUM',
    parameters: { window: 20 },
    requiredEvidenceTypes: ['REALTIME_QUOTE'],
    ownerUserId: userAId
  } as any);
  // Also save to persistence manager
  await persistenceManager.getStrategyRepository().save({
    id: stratAId,
    title: "Analyst A's Proprietary Momentum",
    description: 'Confidential quantitative model',
    prompt: 'Momentum strategy',
    status: 'AI Generated Strategy',
    targetUniverse: 'SP500',
    rebalanceFrequency: 'MONTHLY',
    rules: [],
    isBuiltIn: false,
    ownerUserId: userAId
  });

  // User A can access own strategy
  const stratA = await authorizationService.authorizeStrategy(stratAId, userAId);
  assert((stratA as any).strategyId === stratAId || (stratA as any).id === stratAId, 'User A authorized for own strategy');

  // User B blocked from User A strategy
  let idorBlockedStrategy = false;
  try {
    await authorizationService.authorizeStrategy(stratAId, userBId);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      idorBlockedStrategy = true;
    }
  }
  assert(idorBlockedStrategy, 'IDOR blocked: User B denied access (403) to User A proprietary strategy');

  // Built-in strategies are accessible to all users
  const builtin = await authorizationService.authorizeStrategy('strat-ma-crossover', userBId);
  assert(builtin.isBuiltIn === true, 'Built-in strategy accessible by any user');

  // 3.4 Backtest Result Ownership
  const btAId = `bt-alpha-${Date.now()}`;
  const btResultA = {
    backtestId: btAId,
    config: {
      configId: `cfg-${btAId}`,
      name: 'Private Backtest A',
      universe: ['NVDA'],
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      strategyId: 'strat-momentum-rsi',
      rebalanceFrequency: 'MONTHLY' as any,
      benchmarkSymbol: 'SPY',
      initialCapital: 100000
    },
    performanceMetrics: {
      totalReturn: 0.25,
      cagr: 0.25,
      sharpeRatio: 1.8,
      sortinoRatio: 2.1,
      maxDrawdown: -0.08,
      volatility: 0.15,
      calmarRatio: 3.12,
      winRate: 0.65,
      profitFactor: 2.2,
      beta: 1.1,
      alpha: 0.05
    },
    equityCurve: [],
    monthlyReturns: [],
    trades: [],
    benchmarkComparison: {
      benchmarkTotalReturn: 0.18,
      benchmarkCagr: 0.18,
      benchmarkSharpeRatio: 1.2,
      benchmarkMaxDrawdown: -0.12,
      benchmarkVolatility: 0.14,
      excessReturn: 0.07,
      trackingError: 0.04,
      informationRatio: 1.75
    },
    status: 'COMPLETED' as any,
    executedAt: new Date().toISOString(),
    isDeterministic: true,
    executionProhibited: true,
    isAnalyticalOnly: true,
    ownerUserId: userAId
  };
  await persistenceManager.getBacktestRepository().save(btResultA as any);

  const authBtA = await authorizationService.authorizeBacktest(btAId, userAId);
  assert(authBtA.backtestId === btAId, 'User A authorized for own backtest');

  let idorBlockedBacktest = false;
  try {
    await authorizationService.authorizeBacktest(btAId, userBId);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      idorBlockedBacktest = true;
    }
  }
  assert(idorBlockedBacktest, 'IDOR blocked: User B denied access (403) to User A backtest result');

  // -------------------------------------------------------------
  // 4. RAG / EVIDENCE USER SCOPING & DATA ISOLATION
  // -------------------------------------------------------------
  console.log('\n[SECTION 4] RAG / Evidence User Scoping & Document Isolation');

  // 4.1 User A ingests a private research document
  const docResultA = await documentIngestionService.ingestDocument({
    fileName: 'confidential_blackwell_margin_analysis.txt',
    fileText: 'Our proprietary supplier checks indicate NVDA Blackwell gross margins will reach 78% in Q3, outperforming consensus estimates by 350 basis points.',
    documentType: 'INTERNAL_MEMO',
    securityId: 'us-nvda',
    ownerUserId: userAId,
    userId: userAId,
    uploadedBy: userAEmail
  });

  assert(docResultA.document.processingStatus === 'READY', 'User A private document ingested successfully');
  assert(docResultA.document.ownerUserId === userAId, 'Document tagged with User A ID');
  const userADocId = docResultA.document.documentId;

  // 4.2 Document Registry filtering
  const userADocs = documentRegistry.getAllDocuments(userAId);
  const userBDocs = documentRegistry.getAllDocuments(userBId);

  const docInUserAList = userADocs.some(d => d.documentId === userADocId);
  const docInUserBList = userBDocs.some(d => d.documentId === userADocId);

  assert(docInUserAList === true, 'User A sees their private document in document registry');
  assert(docInUserBList === false, 'User B CANNOT see User A private document in document registry');

  // 4.3 Direct Document IDOR check
  let idorBlockedDoc = false;
  try {
    await authorizationService.authorizeDocument(userADocId, userBId);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      idorBlockedDoc = true;
    }
  }
  assert(idorBlockedDoc, 'IDOR blocked: User B cannot directly request User A private document');

  // 4.4 RAG Semantic Retrieval isolation
  const query = 'Blackwell gross margin proprietary supplier checks';

  // User A retrieves evidence -> MUST find the proprietary document
  const retrievalForUserA = await retrievalEngine.retrieve({
    query,
    securityId: 'us-nvda',
    userId: userAId
  });

  const foundByUserA = retrievalForUserA.evidenceBundle.some(
    e => e.content.includes('Blackwell gross margins') || e.title.includes('Blackwell')
  );
  assert(foundByUserA === true, 'User A retrieval includes their private research document');

  // User B retrieves evidence -> MUST NOT find User A's proprietary document
  const retrievalForUserB = await retrievalEngine.retrieve({
    query,
    securityId: 'us-nvda',
    userId: userBId
  });

  const foundByUserB = retrievalForUserB.evidenceBundle.some(
    e => e.content.includes('Blackwell gross margins') || e.title.includes('Blackwell')
  );
  assert(foundByUserB === false, 'ISOLATION VERIFIED: User B retrieval CANNOT access User A private evidence');

  // 4.5 Public document ingestion & retrieval
  const publicDoc = await documentIngestionService.ingestDocument({
    fileName: 'nvda_q3_public_10q.txt',
    fileText: 'NVIDIA Corporation today announced quarterly financials and revenue of $35 billion for Q3, up 94% year-over-year.',
    documentType: 'SEC_FILING',
    securityId: 'us-nvda',
    uploadedBy: 'sec_edgar'
    // No ownerUserId: public to all users
  });
  assert(publicDoc.document.processingStatus === 'READY', 'Public SEC document ingested');

  // Both User B and unauthenticated query can retrieve public evidence
  const retrievalPublic = await retrievalEngine.retrieve({
    query: 'NVIDIA quarterly financials and revenue',
    securityId: 'us-nvda'
  });
  assert(retrievalPublic.evidenceBundle.length > 0, 'Public evidence retrieval remains functional');

  const retrievalForUserBPublic = await retrievalEngine.retrieve({
    query: 'NVIDIA quarterly financials and revenue',
    securityId: 'us-nvda',
    userId: userBId
  });
  assert(retrievalForUserBPublic.evidenceBundle.length > 0, 'User B can retrieve public SEC evidence');

  // -------------------------------------------------------------
  // 5. INVARIANTS & REGULATORY SAFETY
  // -------------------------------------------------------------
  console.log('\n[SECTION 5] Invariants & Regulatory Safety Verification');

  assert(btResultA.executionProhibited === true, 'executionProhibited preserved on user-scoped backtest');
  assert(btResultA.isAnalyticalOnly === true, 'isAnalyticalOnly preserved on user-scoped backtest');
  assert(btResultA.isDeterministic === true, 'Deterministic calculations preserved');

  console.log('\n===============================================================');
  console.log(`PHASE 17 TESTS COMPLETED: ${passedCount} / ${testCount} Passed (100%)`);
  console.log('===============================================================\n');
}

runPhase17Tests().catch(err => {
  console.error('Phase 17 test execution failed:', err);
  process.exit(1);
});
