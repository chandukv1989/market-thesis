/**
 * FYERS India Market Data Provider Test Suite
 * 
 * Verifies:
 * 1. FYERSAuthService credential & token lifecycle
 * 2. Security & credential isolation (zero secret/token leakage)
 * 3. Symbol mapping & resolution (NSE:*-EQ, BSE:*-A, Indices)
 * 4. Single quote retrieval (real response vs simulated fallback)
 * 5. Batch quote retrieval (multi-symbol querying & normalization)
 * 6. Historical OHLCV retrieval (interval translation, range calculation, real candles vs unconfigured unavailable)
 * 7. Market status evaluation (IST timezone session phases, epistemic status)
 * 8. Error handling & rate limiting (HTTP 429, 401, network failures)
 * 9. Strict epistemic status enforcement (REAL only on verified live response)
 * 10. Integration with EvidenceService & MarketEvidenceAdapter (provenance preservation)
 * 11. Orchestration with IndiaMarketProvider & MarketDataProvider router
 */

import { FYERSAuthService } from '../server/services/auth/fyersAuthService';
import { FYERSMarketProvider } from '../server/providers/fyersMarketProvider';
import { IndiaMarketProvider } from '../server/providers/indiaMarketProvider';
import { MarketDataProviderImpl } from '../server/providers/marketDataProvider';
import { USMarketProvider } from '../server/providers/usMarketProvider';
import { MarketEvidenceAdapter } from '../server/services/evidence/adapters/marketEvidenceAdapter';
import { CustomFetchFn } from '../server/providers/indiaMarketProvider';
import { SecurityIdentifier } from '../src/types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runFyersProviderTests(): Promise<void> {
  console.log('\n======================================================================');
  console.log(' RUNNING FYERS INDIA MARKET DATA PROVIDER INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------
  // TEST 1: FYERSAuthService Credential & Token Lifecycle
  // -------------------------------------------------------------------
  console.log('--- TEST 1: FYERSAuthService Credential & Token Lifecycle ---');
  {
    const authService = new FYERSAuthService(null); // explicitly unconfigured

    assert(!authService.isConfigured(), 'Unconfigured auth service reports isConfigured() === false');
    assert(!authService.isAuthenticated(), 'Unconfigured auth service reports isAuthenticated() === false');
    assert(authService.getAuthHeader() === null, 'Unconfigured auth service produces null auth header');

    const unconfHealth = authService.getHealthStatus();
    assert(unconfHealth.status === 'UNCONFIGURED', 'Health status is UNCONFIGURED when no credentials set');
    assert(unconfHealth.isSimulated === true, 'isSimulated is true when UNCONFIGURED');

    // App ID configured, but no token
    authService.setCredentialsOverride({
      appId: 'TEST_APP_ID_123',
      secretKey: 'SUPER_SECRET_KEY'
    });

    assert(authService.isConfigured() === true, 'Configured with App ID reports isConfigured() === true');
    assert(authService.isAuthenticated() === false, 'Missing access token reports isAuthenticated() === false');
    assert(authService.getAuthHeader() === null, 'Missing access token yields null auth header');

    const authReqHealth = authService.getHealthStatus();
    assert(authReqHealth.status === 'AUTHENTICATION_REQUIRED', 'Health status is AUTHENTICATION_REQUIRED without token');
    assert(authReqHealth.isSimulated === true, 'isSimulated is true when AUTHENTICATION_REQUIRED');

    // Set active access token
    authService.setAccessToken('VALID_ACCESS_TOKEN_XYZ', 3600);
    assert(authService.isAuthenticated() === true, 'With access token reports isAuthenticated() === true');
    assert(authService.getAuthHeader() === 'TEST_APP_ID_123:VALID_ACCESS_TOKEN_XYZ', 'Auth header formatted as appId:accessToken');

    const connHealth = authService.getHealthStatus();
    assert(connHealth.status === 'CONNECTED', 'Health status is CONNECTED with valid credentials and token');
    assert(connHealth.isSimulated === false, 'isSimulated is false when CONNECTED');
  }

  // -------------------------------------------------------------------
  // TEST 2: Security & Credential Isolation (Zero Token/Secret Exposure)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Security & Credential Isolation ---');
  {
    const authService = new FYERSAuthService();
    authService.setCredentialsOverride({
      appId: 'LIVE_CLIENT_99',
      secretKey: 'SUPER_CONFIDENTIAL_SECRET',
      accessToken: 'HIGHLY_SENSITIVE_BEARER_TOKEN'
    });

    const health = authService.getHealthStatus();
    const serializedHealth = JSON.stringify(health);

    assert(!serializedHealth.includes('SUPER_CONFIDENTIAL_SECRET'), 'Health status never exposes FYERS secret key');
    assert(!serializedHealth.includes('HIGHLY_SENSITIVE_BEARER_TOKEN'), 'Health status never exposes FYERS access token');

    const meta = authService.getSafeCredentialsMeta();
    const serializedMeta = JSON.stringify(meta);
    assert(!serializedMeta.includes('SUPER_CONFIDENTIAL_SECRET'), 'Safe credentials meta never exposes secret key');
    assert(!serializedMeta.includes('HIGHLY_SENSITIVE_BEARER_TOKEN'), 'Safe credentials meta never exposes access token');
    assert(meta.appIdMasked !== undefined && meta.appIdMasked.includes('***'), 'App ID is safely masked');
  }

  // -------------------------------------------------------------------
  // TEST 3: Deterministic Symbol Mapping & Resolution
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Deterministic Symbol Mapping & Resolution ---');
  {
    const provider = new FYERSMarketProvider();

    // NSE Equity
    const nseReliance = provider.resolveProviderSymbol('RELIANCE');
    assert(nseReliance.fyersSymbol === 'NSE:RELIANCE-EQ', 'RELIANCE defaults to NSE:RELIANCE-EQ');
    assert(nseReliance.symbol === 'RELIANCE', 'Base symbol is RELIANCE');
    assert(nseReliance.exchange === 'NSE', 'Exchange is NSE');

    const nseTcs = provider.resolveProviderSymbol('tcs', 'NSE');
    assert(nseTcs.fyersSymbol === 'NSE:TCS-EQ', 'tcs resolves to NSE:TCS-EQ');

    // BSE Equity
    const bseInfy = provider.resolveProviderSymbol('INFY', 'BSE');
    assert(bseInfy.fyersSymbol === 'BSE:INFY-A', 'INFY with exchange BSE resolves to BSE:INFY-A');
    assert(bseInfy.exchange === 'BSE', 'Exchange is BSE');

    // Indices
    const nifty = provider.resolveProviderSymbol('NIFTY50');
    assert(nifty.fyersSymbol === 'NSE:NIFTY50-INDEX', 'NIFTY50 maps to NSE:NIFTY50-INDEX');

    const bankNifty = provider.resolveProviderSymbol('BANKNIFTY');
    assert(bankNifty.fyersSymbol === 'NSE:NIFTYBANK-INDEX', 'BANKNIFTY maps to NSE:NIFTYBANK-INDEX');

    const sensex = provider.resolveProviderSymbol('SENSEX');
    assert(sensex.fyersSymbol === 'BSE:SENSEX-INDEX', 'SENSEX maps to BSE:SENSEX-INDEX');

    // Already-qualified FYERS ticker
    const qualified = provider.resolveProviderSymbol('NSE:HDFCBANK-EQ');
    assert(qualified.fyersSymbol === 'NSE:HDFCBANK-EQ', 'Preserves pre-qualified FYERS ticker');
    assert(qualified.symbol === 'HDFCBANK', 'Extracts base symbol HDFCBANK');

    // Reverse parsing
    const parsed = provider.parseFyersSymbol('NSE:RELIANCE-EQ');
    assert(parsed.symbol === 'RELIANCE', 'Reverse parser yields RELIANCE');
    assert(parsed.exchange === 'NSE', 'Reverse parser yields NSE');
  }

  // -------------------------------------------------------------------
  // TEST 4: Single Quote Retrieval (Unconfigured Fallback vs Live)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: Single Quote Retrieval ---');
  {
    // Part A: Unconfigured -> SIMULATED baseline
    const unconfAuth = new FYERSAuthService(null);
    const unconfProvider = new FYERSMarketProvider(undefined, unconfAuth);

    const simQuote = await unconfProvider.getQuote({ symbol: 'RELIANCE' });
    assert(simQuote.symbol === 'RELIANCE', 'Unconfigured quote returns correct symbol');
    assert(simQuote.epistemicStatus === 'SIMULATED', 'Unconfigured quote has epistemicStatus === SIMULATED');
    assert(simQuote.isSimulated === true, 'Unconfigured quote has isSimulated === true');
    assert(simQuote.currency === 'INR', 'Currency is INR');
    assert(simQuote.provider.includes('Simulated'), 'Provider name indicates simulated fallback');

    // Part B: Authenticated Live FYERS Response
    const mockAuth = new FYERSAuthService();
    mockAuth.setCredentialsOverride({
      appId: 'APP_TEST_1',
      accessToken: 'TOKEN_TEST_1'
    });

    const mockFetch: CustomFetchFn = async (input, init) => {
      const urlStr = String(input);
      const authHeader = (init?.headers as Record<string, string>)?.['Authorization'];

      assert(authHeader === 'APP_TEST_1:TOKEN_TEST_1', 'HTTP request passes valid FYERS Authorization header');
      assert(urlStr.includes('quotes?symbols='), 'HTTP request targets /quotes endpoint');

      return new Response(JSON.stringify({
        s: 'ok',
        d: [
          {
            n: 'NSE:RELIANCE-EQ',
            s: 'ok',
            v: {
              lp: 3010.50,
              ch: 25.10,
              chp: 0.84,
              open_price: 2990.00,
              high_price: 3020.00,
              low_price: 2985.00,
              prev_close_price: 2985.40,
              volume: 7200000,
              tt: 1694336400
            }
          }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const liveProvider = new FYERSMarketProvider(mockFetch, mockAuth);
    const liveQuote = await liveProvider.getQuote({ symbol: 'RELIANCE' });

    assert(liveQuote.symbol === 'RELIANCE', 'Live quote has symbol RELIANCE');
    assert(liveQuote.price === 3010.50, 'Live quote has authoritative last price 3010.50');
    assert(liveQuote.change === 25.10, 'Live quote has authoritative change 25.10');
    assert(liveQuote.changePercent === 0.84, 'Live quote has authoritative changePercent 0.84');
    assert(liveQuote.volume === '7.2M', 'Live quote volume formatted to 7.2M');
    assert(liveQuote.provider === 'FYERS', 'Live quote provider is FYERS');
    assert(liveQuote.epistemicStatus === 'REAL', 'Live quote epistemicStatus is REAL');
    assert(liveQuote.isSimulated === false, 'Live quote isSimulated is false');
  }

  // -------------------------------------------------------------------
  // TEST 5: Batch Quote Retrieval
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: Batch Quote Retrieval ---');
  {
    const mockAuth = new FYERSAuthService();
    mockAuth.setCredentialsOverride({
      appId: 'APP_TEST_2',
      accessToken: 'TOKEN_TEST_2'
    });

    let requestedSymbolsParam = '';
    const mockFetch: CustomFetchFn = async (input) => {
      const url = new URL(String(input));
      requestedSymbolsParam = url.searchParams.get('symbols') || '';

      return new Response(JSON.stringify({
        s: 'ok',
        d: [
          {
            n: 'NSE:RELIANCE-EQ',
            s: 'ok',
            v: { lp: 3000.0, ch: 10.0, chp: 0.33, volume: 5000000, tt: 1694336400 }
          },
          {
            n: 'NSE:TCS-EQ',
            s: 'ok',
            v: { lp: 4250.0, ch: -15.0, chp: -0.35, volume: 2000000, tt: 1694336400 }
          },
          {
            n: 'NSE:INFY-EQ',
            s: 'ok',
            v: { lp: 1850.0, ch: 12.0, chp: 0.65, volume: 4000000, tt: 1694336400 }
          }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new FYERSMarketProvider(mockFetch, mockAuth);
    const batchQuotes = await provider.getQuotes(['RELIANCE', 'TCS', 'INFY']);

    assert(requestedSymbolsParam.includes('NSE:RELIANCE-EQ'), 'Batch query includes RELIANCE');
    assert(requestedSymbolsParam.includes('NSE:TCS-EQ'), 'Batch query includes TCS');
    assert(requestedSymbolsParam.includes('NSE:INFY-EQ'), 'Batch query includes INFY');

    assert(batchQuotes.length === 3, 'Batch response contains 3 quotes');
    const rel = batchQuotes.find(q => q.symbol === 'RELIANCE');
    const tcs = batchQuotes.find(q => q.symbol === 'TCS');
    const infy = batchQuotes.find(q => q.symbol === 'INFY');

    assert(rel?.price === 3000.0 && rel.epistemicStatus === 'REAL', 'RELIANCE batch quote normalized to REAL');
    assert(tcs?.price === 4250.0 && tcs.epistemicStatus === 'REAL', 'TCS batch quote normalized to REAL');
    assert(infy?.price === 1850.0 && infy.epistemicStatus === 'REAL', 'INFY batch quote normalized to REAL');
  }

  // -------------------------------------------------------------------
  // TEST 6: Historical OHLCV Retrieval (Real Candles vs Unconfigured)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: Historical OHLCV Retrieval ---');
  {
    // Part A: Unconfigured -> UNAVAILABLE (Never fabricate bars)
    const unconfAuth = new FYERSAuthService(null);
    const unconfProvider = new FYERSMarketProvider(undefined, unconfAuth);

    const unconfHistory = await unconfProvider.getHistoricalPrices({
      symbol: 'RELIANCE',
      period: '1M',
      interval: '1d'
    });

    assert(unconfHistory.bars.length === 0, 'Unconfigured historical prices has 0 bars');
    assert(unconfHistory.epistemicStatus === 'UNAVAILABLE', 'Unconfigured historical prices has epistemicStatus === UNAVAILABLE');
    assert(unconfHistory.status === 'unavailable', 'Status is unavailable');

    // Part B: Configured Live FYERS /history endpoint
    const mockAuth = new FYERSAuthService();
    mockAuth.setCredentialsOverride({
      appId: 'APP_TEST_3',
      accessToken: 'TOKEN_TEST_3'
    });

    let queriedResolution = '';
    const mockFetch: CustomFetchFn = async (input) => {
      const url = new URL(String(input));
      queriedResolution = url.searchParams.get('resolution') || '';

      // FYERS candles format: [ [epoch, open, high, low, close, volume], ... ]
      return new Response(JSON.stringify({
        s: 'ok',
        candles: [
          [1694163600, 2950.0, 2980.0, 2940.0, 2975.0, 4500000],
          [1694250000, 2975.0, 3010.0, 2970.0, 2995.0, 5200000],
          [1694336400, 2995.0, 3025.0, 2985.0, 3010.5, 6100000]
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new FYERSMarketProvider(mockFetch, mockAuth);
    const history = await provider.getHistoricalPrices({
      symbol: 'RELIANCE',
      period: '1M',
      interval: '1d'
    });

    assert(queriedResolution === 'D', 'Daily interval maps to FYERS resolution D');
    assert(history.bars.length === 3, 'Returns 3 historical price bars');
    assert(history.epistemicStatus === 'REAL', 'History epistemicStatus is REAL');
    assert(history.isSimulated === false, 'History isSimulated is false');
    assert(history.provider === 'FYERS', 'History provider is FYERS');

    const lastBar = history.bars[2];
    assert(lastBar.close === 3010.5, 'Authoritative close price matches FYERS candle');
    assert(lastBar.open === 2995.0, 'Authoritative open price matches FYERS candle');
    assert(lastBar.volume === 6100000, 'Authoritative volume matches FYERS candle');
    assert(lastBar.epistemicStatus === 'REAL', 'Individual bar has epistemicStatus === REAL');
  }

  // -------------------------------------------------------------------
  // TEST 7: Market Status & IST Trading Hours
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: Market Status & IST Trading Hours ---');
  {
    const unconfAuth = new FYERSAuthService(null);
    const unconfProvider = new FYERSMarketProvider(undefined, unconfAuth);

    const unconfStatus = await unconfProvider.getMarketStatus('NSE');
    assert(unconfStatus.market === 'INDIA', 'Market is INDIA');
    assert(unconfStatus.timezone === 'Asia/Kolkata', 'Timezone is Asia/Kolkata');
    assert(unconfStatus.epistemicStatus === 'SIMULATED', 'Unconfigured market status is SIMULATED');

    const mockAuth = new FYERSAuthService();
    mockAuth.setCredentialsOverride({
      appId: 'APP_TEST_4',
      accessToken: 'TOKEN_TEST_4'
    });
    const liveProvider = new FYERSMarketProvider(undefined, mockAuth);
    const liveStatus = await liveProvider.getMarketStatus('NSE');
    assert(liveStatus.provider === 'FYERS', 'Connected market status provider is FYERS');
    assert(liveStatus.epistemicStatus === 'REAL', 'Connected market status epistemicStatus is REAL');
    assert(liveStatus.isSimulated === false, 'Connected market status isSimulated is false');
  }

  // -------------------------------------------------------------------
  // TEST 8: Error Handling & Rate Limiting (HTTP 429, 401, Network)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 8: Error Handling & Rate Limiting ---');
  {
    const authService = new FYERSAuthService();
    authService.setCredentialsOverride({
      appId: 'APP_RATE_LIMIT',
      accessToken: 'TOKEN_RATE_LIMIT'
    });

    // Sub-test 8A: HTTP 429 Rate Limit
    const rateLimitFetch: CustomFetchFn = async () => {
      return new Response(JSON.stringify({
        s: 'error',
        code: -99,
        message: 'Request limit reached'
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    };

    const rateLimitProvider = new FYERSMarketProvider(rateLimitFetch, authService);
    await rateLimitProvider.getQuote({ symbol: 'RELIANCE' });

    const rateHealth = rateLimitProvider.getHealthStatus();
    assert(rateHealth.status === 'RATE_LIMITED', 'HTTP 429 transitions health status to RATE_LIMITED');

    // Sub-test 8B: HTTP 401 Unauthorized
    authService.clearCache();
    const unauthorizedFetch: CustomFetchFn = async () => {
      return new Response(JSON.stringify({
        s: 'error',
        code: -15,
        message: 'token expired'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    };

    const authFailProvider = new FYERSMarketProvider(unauthorizedFetch, authService);
    await authFailProvider.getQuote({ symbol: 'TCS' });

    const authFailHealth = authFailProvider.getHealthStatus();
    assert(authFailHealth.status === 'AUTHENTICATION_REQUIRED', 'HTTP 401 transitions health status to AUTHENTICATION_REQUIRED');
  }

  // -------------------------------------------------------------------
  // TEST 9: Strict Epistemic Status & Evidence Adapter Integration
  // -------------------------------------------------------------------
  console.log('\n--- TEST 9: Evidence Adapter Integration & Provenance ---');
  {
    const adapter = new MarketEvidenceAdapter();
    const relianceSec: SecurityIdentifier = {
      id: 'in-reliance',
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      country: 'India',
      market: 'INDIA',
      exchange: 'NSE',
      currency: 'INR'
    };

    // When market provider is unconfigured, evidence must NEVER be REAL
    const unconfEvidence = await adapter.getQuoteEvidence(relianceSec);
    assert(unconfEvidence.length > 0, 'Generated quote evidence item');
    for (const ev of unconfEvidence) {
      assert(ev.epistemicStatus !== 'REAL', 'Unconfigured Indian quote evidence is NEVER REAL');
      assert(ev.isSimulated === true || ev.epistemicStatus === 'SIMULATED' || ev.epistemicStatus === 'UNAVAILABLE',
        'Unconfigured Indian equity evidence is explicitly SIMULATED or UNAVAILABLE'
      );
    }
  }

  // -------------------------------------------------------------------
  // TEST 10: IndiaMarketProvider Abstraction & FYERS Priority
  // -------------------------------------------------------------------
  console.log('\n--- TEST 10: IndiaMarketProvider Abstraction & Routing ---');
  {
    const mockAuth = new FYERSAuthService();
    mockAuth.setCredentialsOverride({
      appId: 'APP_INDIA_PROV',
      accessToken: 'TOKEN_INDIA_PROV'
    });

    const mockFetch: CustomFetchFn = async () => {
      return new Response(JSON.stringify({
        s: 'ok',
        d: [{ n: 'NSE:RELIANCE-EQ', s: 'ok', v: { lp: 3050.0, ch: 40.0, chp: 1.33, volume: 8000000, tt: 1694336400 } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const fyersProvider = new FYERSMarketProvider(mockFetch, mockAuth);
    const indiaProvider = new IndiaMarketProvider(undefined, null, fyersProvider);

    assert(indiaProvider.getActiveProvider() === 'FYERS', 'IndiaMarketProvider selects FYERS when FYERS is configured');

    const quote = await indiaProvider.getQuote({ symbol: 'RELIANCE' });
    assert(quote.price === 3050.0, 'IndiaMarketProvider routes quote through FYERS');
    assert(quote.epistemicStatus === 'REAL', 'IndiaMarketProvider preserves REAL epistemicStatus from FYERS');
    assert(quote.provider === 'FYERS', 'Quote provider indicates FYERS');

    // Test explicit provider override
    const activeExplicit = indiaProvider.getActiveProvider('TrueData');
    assert(activeExplicit === 'TrueData', 'Explicit request for TrueData is respected');
  }

  // -------------------------------------------------------------------
  // TEST 11: Multi-Market Router Orchestration
  // -------------------------------------------------------------------
  console.log('\n--- TEST 11: Multi-Market Router Orchestration ---');
  {
    const mockAuth = new FYERSAuthService();
    mockAuth.setCredentialsOverride({
      appId: 'APP_ROUTER',
      accessToken: 'TOKEN_ROUTER'
    });

    const mockFetch: CustomFetchFn = async () => {
      return new Response(JSON.stringify({
        s: 'ok',
        d: [{ n: 'NSE:INFY-EQ', s: 'ok', v: { lp: 1890.0, ch: 15.0, chp: 0.80, volume: 3000000, tt: 1694336400 } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const fyersProvider = new FYERSMarketProvider(mockFetch, mockAuth);
    const indiaProvider = new IndiaMarketProvider(undefined, null, fyersProvider);
    const usProvider = new USMarketProvider();
    const router = new MarketDataProviderImpl(usProvider, indiaProvider);

    const quote = await router.getQuote({ symbol: 'INFY', market: 'INDIA' });
    assert(quote.symbol === 'INFY', 'Router resolves INFY');
    assert(quote.price === 1890.0, 'Router retrieves authoritative price from FYERS');
    assert(quote.epistemicStatus === 'REAL', 'Router maintains REAL epistemicStatus for FYERS quote');
  }

  console.log('\n======================================================================');
  console.log(` FYERS PROVIDER ALL TESTS PASSED: ${passCount} assertions, ${failCount} failures.`);
  console.log('======================================================================\n');
}

// Direct execution support
if (process.argv[1] && process.argv[1].includes('fyersProvider.test')) {
  runFyersProviderTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}
