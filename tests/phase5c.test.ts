/**
 * Phase 5C Live Market Data Integration Contract & Unit Test Suite
 * 
 * Verifies:
 * 1. Twelve Data US market provider (live/mocked quote, historical OHLCV, rate limit caching)
 * 2. TrueData India market provider (NSE/BSE routing, auth grant, INR segregation, fallback)
 * 3. Multi-market routing & caching layer (in-memory TTLs, clearCache)
 * 4. Epistemic categorization (REAL vs SIMULATED vs UNAVAILABLE)
 * 5. Full data sources health reporting
 */

import { USMarketProvider, CustomFetchFn } from '../server/providers/usMarketProvider';
import { IndiaMarketProvider } from '../server/providers/indiaMarketProvider';
import { MarketDataProviderImpl, marketDataProvider } from '../server/providers/marketDataProvider';
import { financialDataService } from '../server/services/financialDataService';
import { resolveSecurity } from '../src/data/canonicalSecurities';

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}: ${details || 'Assertion failed'}`);
    process.exitCode = 1;
  }
}

async function runPhase5cTests() {
  console.log('\n======================================================');
  console.log(' RUNNING PHASE 5C LIVE MARKET INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  // ----------------------------------------------------
  // 1. Twelve Data US Market Provider Contract
  // ----------------------------------------------------
  console.log('1. Verifying Twelve Data US Market Provider:');

  // Test Mocked Twelve Data live response
  const mockTwelveFetch: CustomFetchFn = async (input: RequestInfo | URL) => {
    const urlStr = input.toString();
    if (urlStr.includes('/quote')) {
      return new Response(
        JSON.stringify({
          symbol: 'NVDA',
          name: 'NVIDIA Corporation',
          exchange: 'NASDAQ',
          currency: 'USD',
          datetime: '2026-09-08',
          open: '124.50',
          high: '128.20',
          low: '123.80',
          close: '127.40',
          volume: '45230000',
          previous_close: '122.10',
          change: '5.30',
          percent_change: '4.34',
          is_market_open: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/time_series')) {
      return new Response(
        JSON.stringify({
          meta: { symbol: 'NVDA', interval: '1day', currency: 'USD', exchange: 'NASDAQ' },
          values: [
            { datetime: '2026-09-08', open: '124.50', high: '128.20', low: '123.80', close: '127.40', volume: '45230000' },
            { datetime: '2026-09-07', open: '121.00', high: '123.00', low: '120.50', close: '122.10', volume: '38100000' }
          ],
          status: 'ok'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('Not found', { status: 404 });
  };

  const mockedUSProvider = new USMarketProvider(mockTwelveFetch, 'mock-twelve-key');
  assert(mockedUSProvider.isConfigured() === true, 'US provider with API key is recognized as configured');

  const nvdaQuote = await mockedUSProvider.getQuote({ symbol: 'NVDA' });
  assert(
    nvdaQuote.symbol === 'NVDA' &&
    nvdaQuote.price === 127.4 &&
    nvdaQuote.change === 5.3 &&
    nvdaQuote.changePercent === 4.34 &&
    nvdaQuote.currency === 'USD' &&
    nvdaQuote.market === 'US' &&
    nvdaQuote.provider === 'Twelve Data' &&
    nvdaQuote.isSimulated === false &&
    nvdaQuote.epistemicStatus === 'REAL',
    'Twelve Data quote parses real numeric prices, currency, and marks epistemicStatus: REAL'
  );

  const nvdaHistory = await mockedUSProvider.getHistoricalPrices({ symbol: 'NVDA', period: '1M', interval: '1d' });
  assert(
    nvdaHistory.status === 'available' &&
    nvdaHistory.bars.length === 2 &&
    nvdaHistory.bars[0].close === 122.1 &&
    nvdaHistory.bars[1].close === 127.4 &&
    nvdaHistory.epistemicStatus === 'REAL' &&
    nvdaHistory.provider === 'Twelve Data',
    'Twelve Data historical time series returns real OHLC bars with verified bounds and REAL epistemic status'
  );

  // ----------------------------------------------------
  // 2. TrueData India Market Provider Contract
  // ----------------------------------------------------
  console.log('\n2. Verifying TrueData India Market Provider:');

  const mockTrueDataFetch: CustomFetchFn = async (input: RequestInfo | URL) => {
    const urlStr = input.toString();
    if (urlStr.includes('/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'mock-truedata-jwt-token-xyz',
          token_type: 'bearer',
          expires_in: 86400
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/getlastbar')) {
      return new Response(
        JSON.stringify({
          Records: [
            ['2026-09-08T15:30:00', 2980.5, 3015.0, 2975.0, 3004.25, 4120000, 1500000]
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/getbars')) {
      return new Response(
        JSON.stringify({
          Records: [
            ['2026-09-08T00:00:00', 2980.5, 3015.0, 2975.0, 3004.25, 4120000],
            ['2026-09-07T00:00:00', 2950.0, 2990.0, 2940.0, 2978.0, 3800000]
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('Not found', { status: 404 });
  };

  const mockedIndiaProvider = new IndiaMarketProvider(mockTrueDataFetch, {
    username: 'test_user',
    password: 'test_password'
  });
  assert(mockedIndiaProvider.isConfigured() === true, 'India provider with credentials is recognized as configured');

  const relianceQuote = await mockedIndiaProvider.getQuote({ symbol: 'RELIANCE' });
  assert(
    relianceQuote.symbol === 'RELIANCE' &&
    relianceQuote.price === 3004.25 &&
    relianceQuote.currency === 'INR' &&
    relianceQuote.market === 'INDIA' &&
    relianceQuote.provider === 'TrueData' &&
    relianceQuote.isSimulated === false &&
    relianceQuote.epistemicStatus === 'REAL',
    'TrueData quote parses live NSE price (3004.25 INR) with native INR currency and REAL epistemic status'
  );

  const relianceHistory = await mockedIndiaProvider.getHistoricalPrices({ symbol: 'RELIANCE', period: '1M', interval: '1d' });
  assert(
    relianceHistory.status === 'available' &&
    relianceHistory.bars.length === 2 &&
    relianceHistory.bars[0].currency === 'INR' &&
    relianceHistory.epistemicStatus === 'REAL',
    'TrueData historical time series returns real OHLC bars with INR currency segregation'
  );

  // ----------------------------------------------------
  // 3. TrueData Authentication Failure & Fallback Handling
  // ----------------------------------------------------
  console.log('\n3. Verifying TrueData Error & Subscription Expiration Fallback:');

  const failedAuthFetch: CustomFetchFn = async () => {
    return new Response(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: 'The user name or password is incorrect or subscription expired.'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const failedIndiaProvider = new IndiaMarketProvider(failedAuthFetch, {
    username: 'expired_user',
    password: 'expired_password'
  });

  const fallbackQuote = await failedIndiaProvider.getQuote({ symbol: 'TCS' });
  assert(
    fallbackQuote.symbol === 'TCS' &&
    fallbackQuote.price > 0 &&
    fallbackQuote.isSimulated === true &&
    fallbackQuote.epistemicStatus === 'SIMULATED' &&
    fallbackQuote.reason?.includes('TrueData authentication failed'),
    'On TrueData auth/subscription failure, quote safely falls back to simulated baseline with honest epistemic disclosure'
  );

  const failedHistory = await failedIndiaProvider.getHistoricalPrices({ symbol: 'TCS', period: '1M' });
  assert(
    failedHistory.status === 'unavailable' &&
    failedHistory.bars.length === 0 &&
    failedHistory.epistemicStatus === 'UNAVAILABLE',
    'On TrueData auth/subscription failure, historical time series returns UNAVAILABLE without fabricating fake bars'
  );

  // ----------------------------------------------------
  // 4. In-Memory Caching & Cache Invalidation
  // ----------------------------------------------------
  console.log('\n4. Verifying Provider In-Memory Caching & Rate Limiting:');

  let fetchCallCount = 0;
  const countingFetch: CustomFetchFn = async () => {
    fetchCallCount++;
    return new Response(
      JSON.stringify({
        symbol: 'MSFT',
        open: '400.0',
        high: '410.0',
        low: '395.0',
        close: '405.0',
        change: '5.0',
        percent_change: '1.25'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const cachingUSProvider = new USMarketProvider(countingFetch, 'test-key');
  await cachingUSProvider.getQuote({ symbol: 'MSFT' });
  await cachingUSProvider.getQuote({ symbol: 'MSFT' });
  await cachingUSProvider.getQuote({ symbol: 'MSFT' });
  assert(fetchCallCount === 1, 'In-memory quote cache prevented redundant API calls within TTL window');

  cachingUSProvider.clearCache();
  await cachingUSProvider.getQuote({ symbol: 'MSFT' });
  assert(fetchCallCount === 2, 'clearCache successfully invalidated cached entries');

  // ----------------------------------------------------
  // 5. Data Sources Health Aggregation
  // ----------------------------------------------------
  console.log('\n5. Verifying Data Sources Health Aggregation:');
  const compositeProvider = new MarketDataProviderImpl(mockedUSProvider, mockedIndiaProvider);
  const compositeHealth = compositeProvider.getHealthStatus();
  const regional = compositeProvider.getRegionalHealth();

  assert(
    compositeHealth.status === 'Connected' && compositeHealth.isSimulated === false,
    'When both US and India sub-providers are live, composite pricing engine reports Connected (REAL)'
  );
  assert(
    regional.us.name.includes('Twelve Data') && regional.india.name.includes('TrueData'),
    'Regional health reports dedicated diagnostics for Twelve Data and TrueData'
  );

  const fullDataStatus = financialDataService.getDataSourcesHealth();
  assert(
    Boolean(fullDataStatus.secEdgar && fullDataStatus.marketData && fullDataStatus.usMarketData && fullDataStatus.indiaMarketData),
    'financialDataService.getDataSourcesHealth returns comprehensive status across SEC and all regional markets'
  );

  console.log('\n------------------------------------------------------');
  console.log(` SUMMARY: ${passedCount} / ${testCount} tests passed.`);
  console.log('------------------------------------------------------\n');

  if (passedCount !== testCount) {
    process.exit(1);
  }
}

runPhase5cTests().catch(err => {
  console.error('Fatal error in Phase 5C test suite:', err);
  process.exit(1);
});
