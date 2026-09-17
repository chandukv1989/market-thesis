/**
 * Full-Stack Express Server with SEC EDGAR Financial Data Provider
 * Integrates Vite middleware in development and serves static assets in production.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { financialDataService } from './server/services/financialDataService';
import { classifyAndResolve, extractSecuritiesFromText } from './src/services/searchIntelligence';
import { resolveSecurity } from './src/data/canonicalSecurities';
import { geminiResearchEngine } from './server/services/research/geminiResearchEngine';
import { gatherEvidenceForSecurities, classifyAnalysisType } from './server/services/research/researchEngine';
import { evidenceService } from './server/services/evidence/evidenceService';
import { retrievalEngine } from './server/services/retrieval/retrievalEngine';
import { portfolioIntelligenceService } from './server/services/portfolio/portfolioIntelligenceService';
import { fyersMarketProvider } from './server/providers/fyersMarketProvider';
import { watchlistAlertService } from './server/services/alerts/watchlistAlertService';
import { quantStrategyEngine } from './server/services/quant/quantStrategyEngine';
import { backtestService } from './server/services/backtest/backtestService';
import { researchNotebookService } from './server/services/research/notebookService';
import { documentIngestionService } from './server/services/documents/documentIngestionService';
import { documentRegistry } from './server/services/documents/documentRegistry';
import { decisionIntelligenceService } from './server/services/decision/decisionIntelligenceService';
import { persistenceManager } from './server/persistence/persistenceManager';
import { SecurityIdentifier, ResearchAnalysisType, ResearchRequest, EvidenceSourceType, EvidenceEpistemicStatus, ResearchEvidenceItem, MarketDataRequest } from './src/types';
import { authService, AuthenticationError } from './server/auth/authService';
import { resolveUser, requireAuth, setSessionCookie, clearSessionCookie } from './server/auth/authMiddleware';
import { authorizationService, AuthorizationError } from './server/auth/authorizationService';
import { requestCorrelation } from './server/middleware/requestCorrelation';
import { structuredLogger } from './server/logging/structuredLogger';
import { authRateLimiter, researchRateLimiter, backtestRateLimiter, documentUploadRateLimiter } from './server/middleware/rateLimiter';
import { errorHandler } from './server/middleware/errorHandler';
import { finmagineProvider } from './server/providers/finmagineProvider';
import { environmentConfigService } from './server/config/environmentConfig';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Phase 18: Security Headers & Correlation
  app.use(requestCorrelation);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Phase 19: Explicit CORS Origin Control
  const allowedOrigins = [
    process.env.APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ].filter(Boolean) as string[];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed =
        process.env.NODE_ENV !== 'production' ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost');

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id, X-Request-Id, X-CSRF-Token');
      }
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Phase 19: CSRF Protection for state-changing requests using cookie authentication
  app.use((req, res, next) => {
    const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (stateChangingMethods.includes(req.method) && req.headers['cookie']?.includes('session_id=')) {
      const hasAuthHeader = Boolean(req.headers['authorization'] || req.headers['x-session-id'] || req.headers['x-csrf-token']);
      const secFetchSite = req.headers['sec-fetch-site'];
      const isSameSite = secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none';
      const origin = req.headers['origin'] || req.headers['referer'];
      const isTrustedOrigin = origin && (allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('.run.app') || origin.includes('localhost'));

      if (process.env.NODE_ENV === 'production' && !hasAuthHeader && !isSameSite && !isTrustedOrigin) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cross-Site Request Forgery (CSRF) validation failed. State-changing requests require explicit origin verification or custom authentication headers.',
            requestId: req.requestId,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }
    next();
  });

  // Phase 18: Structured Request Logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      if (req.originalUrl?.startsWith('/api')) {
        structuredLogger.info('HTTP Request', {
          requestId: req.requestId,
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          latencyMs,
          userId: (req as any).user?.userId
        });
      }
    });
    next();
  });

  // ==========================================
  // PHASE 16: PERSISTENCE INITIALIZATION & HYDRATION
  // ==========================================
  try {
    await persistenceManager.initialize();
    await Promise.all([
      documentRegistry.hydrateFromPersistence(),
      (evidenceService.getRepository() as any).hydrateFromPersistence?.(),
      researchNotebookService.hydrateFromPersistence(),
      backtestService.hydrateFromPersistence()
    ]);
  } catch (err) {
    console.error('[Server] Persistence initialization error:', err);
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(resolveUser);

  // Phase 18: Rate Limiting on sensitive and resource-intensive endpoints
  app.use('/api/auth', authRateLimiter.middleware());
  app.use('/api/research', researchRateLimiter.middleware());
  app.use('/api/backtests', backtestRateLimiter.middleware());
  app.use('/api/documents/upload', documentUploadRateLimiter.middleware());

  // ==========================================
  // PHASE 17: AUTHENTICATION & IDENTITY ROUTES
  // ==========================================

  // Register a new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await authService.register(
        { email, password },
        req.ip,
        req.headers['user-agent']
      );
      setSessionCookie(res, result.session.sessionId, result.session.expiresAt);
      res.status(201).json({
        authenticated: true,
        user: result.user,
        session: {
          sessionId: result.session.sessionId,
          expiresAt: result.session.expiresAt
        }
      });
    } catch (err: unknown) {
      if (err instanceof AuthenticationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
    }
  });

  // Login existing user
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await authService.login(
        { email, password },
        req.ip,
        req.headers['user-agent']
      );
      setSessionCookie(res, result.session.sessionId, result.session.expiresAt);
      res.json({
        authenticated: true,
        user: result.user,
        session: {
          sessionId: result.session.sessionId,
          expiresAt: result.session.expiresAt
        }
      });
    } catch (err: unknown) {
      if (err instanceof AuthenticationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
    }
  });

  // Logout current session
  app.post('/api/auth/logout', async (req, res) => {
    try {
      if (req.session?.sessionId) {
        await authService.logout(req.session.sessionId);
      }
      clearSessionCookie(res);
      res.json({ authenticated: false, message: 'Logged out successfully' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Get current authenticated user profile
  app.get('/api/auth/me', (req, res) => {
    if (req.user) {
      res.json({
        authenticated: true,
        user: req.user
      });
    } else {
      res.json({
        authenticated: false,
        user: null
      });
    }
  });

  // ==========================================
  // FINANCIAL DATA PROVIDER API ROUTES
  // ==========================================

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'Investment Intelligence Financial Data Service V1.0',
      timestamp: new Date().toISOString()
    });
  });

  // Data sources status and health endpoint
  app.get('/api/data-status', (_req, res) => {
    try {
      const health = financialDataService.getDataSourcesHealth();
      res.json(health);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Search & Ticker Intelligence endpoint (Phase 6)
  app.get('/api/search', (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const result = classifyAndResolve(q);
      res.json(result);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // SEC EDGAR Normalized Financial Facts & Derived Statements
  app.get('/api/sec/financials/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      if (!ticker) {
        res.status(400).json({ error: 'Ticker parameter is required' });
        return;
      }
      const data = await financialDataService.getSecurityFinancials(ticker);
      res.json(data);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: errMsg,
        status: 'unavailable',
        ticker: req.params.ticker,
        retrievedAt: new Date().toISOString()
      });
    }
  });

  // SEC EDGAR Verified Filings (10-K, 10-Q, 8-K, etc.)
  app.get('/api/sec/filings/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      if (!ticker) {
        res.status(400).json({ error: 'Ticker parameter is required' });
        return;
      }
      const filings = await financialDataService.getRecentFilings(ticker);
      res.json(filings);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // SEC Raw Submissions Metadata
  app.get('/api/sec/submissions/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      const submissions = await financialDataService.getSECSubmissions(ticker);
      res.json(submissions);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // SEC Raw Company Facts (XBRL)
  app.get('/api/sec/facts/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      const facts = await financialDataService.getSECCompanyFacts(ticker);
      res.json(facts);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Market Provider Quote (Explicitly tagged as Simulated unless configured)
  app.get('/api/market/quote/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      const market = req.query.market as 'US' | 'INDIA' | 'GLOBAL' | undefined;
      const exchange = req.query.exchange as string | undefined;
      const provider = req.query.provider as string | undefined;
      const quote = await financialDataService.getQuote({
        symbol: ticker,
        market,
        exchange,
        provider
      });
      res.json(quote);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Batch Market Quotes endpoint (Multi-symbol query)
  app.get('/api/market/batch', async (req, res) => {
    try {
      const symbolsParam = (req.query.symbols as string) || '';
      const market = req.query.market as 'US' | 'INDIA' | 'GLOBAL' | undefined;
      const exchange = req.query.exchange as string | undefined;
      const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

      const requests: MarketDataRequest[] = symbols.map(s => ({
        symbol: s,
        market,
        exchange
      }));

      const quotes = await financialDataService.getQuotes(requests);
      res.json(quotes);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/market/batch', async (req, res) => {
    try {
      const { symbols, market, exchange } = req.body;
      const symbolList: string[] = Array.isArray(symbols) ? symbols : [];
      const requests: MarketDataRequest[] = symbolList.map(s => ({
        symbol: s,
        market,
        exchange
      }));

      const quotes = await financialDataService.getQuotes(requests);
      res.json(quotes);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // FYERS Provider Health Status (Server-side metadata, never leaks secrets)
  app.get('/api/fyers/status', (_req, res) => {
    try {
      const health = fyersMarketProvider.getHealthStatus();
      res.json(health);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Phase 18: Finmagine Provider Health Status (Server-side metadata, never leaks secrets)
  app.get('/api/finmagine/status', (_req, res) => {
    try {
      const status = finmagineProvider.getHealthStatus();
      res.json(status);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Phase 18: Safe Production Environment Diagnostics (Never leaks secrets)
  app.get('/api/config/status', (_req, res) => {
    try {
      const summary = environmentConfigService.getSafeSummary();
      res.json(summary);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Market Historical Prices endpoint (OHLCV)
  app.get('/api/market/history/:ticker', async (req, res) => {
    try {
      const ticker = req.params.ticker;
      const market = req.query.market as 'US' | 'INDIA' | 'GLOBAL' | undefined;
      const exchange = req.query.exchange as string | undefined;
      const period = req.query.period as '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y' | 'MAX' | undefined;
      const interval = req.query.interval as '1m' | '5m' | '15m' | '1h' | '1d' | '1wk' | '1mo' | undefined;
      const history = await financialDataService.getHistoricalPrices({
        symbol: ticker,
        market,
        exchange,
        period,
        interval
      });
      res.json(history);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Market Status endpoint (US / INDIA)
  app.get('/api/market/status/:market', async (req, res) => {
    try {
      const market = (req.params.market?.toUpperCase() || 'US') as 'US' | 'INDIA';
      const exchange = req.query.exchange as string | undefined;
      const status = await financialDataService.getMarketStatus({ market, exchange });
      res.json(status);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Invalidate / clear cache
  app.post('/api/sec/cache/clear', (_req, res) => {
    financialDataService.clearCache();
    geminiResearchEngine.clearCache();
    evidenceService.getRepository().clear();
    retrievalEngine.clearCache();
    res.json({ message: 'Financial, research, and evidence provider cache cleared successfully', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // EVIDENCE FOUNDATION & RETRIEVAL (PHASE 8A & 8B)
  // ==========================================

  // Dedicated Semantic Retrieval endpoint (Phase 8B)
  app.post('/api/evidence/search', async (req, res) => {
    try {
      const { query, securityId, securityIds, sourceType, documentType, epistemicStatus, asOfDate, limit } = req.body || {};
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required and must be a string' });
        return;
      }

      const secList: string[] = [];
      if (securityId) secList.push(securityId);
      if (Array.isArray(securityIds)) secList.push(...securityIds);

      // Pre-gather evidence into repository if target securities specified
      if (secList.length > 0) {
        await evidenceService.gatherEvidence({ securityIds: secList, asOfDate });
      }

      const retrievalResult = await retrievalEngine.retrieve({
        query,
        securityId,
        securityIds: secList.length > 0 ? secList : undefined,
        sourceType,
        documentType,
        epistemicStatus,
        asOfDate,
        limit,
        userId: req.user?.userId
      });

      res.json(retrievalResult);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.get('/api/evidence', async (req, res) => {
    try {
      const securityId = req.query.securityId as string | undefined;
      const sourceType = req.query.sourceType as EvidenceSourceType | undefined;
      const provider = req.query.provider as string | undefined;
      const epistemicStatus = req.query.epistemicStatus as EvidenceEpistemicStatus | undefined;
      const asOfDate = req.query.asOfDate as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      // If a specific security is queried and not yet in repository, gather it
      if (securityId) {
        await evidenceService.gatherEvidence({ securityIds: [securityId], asOfDate });
      }

      const repo = evidenceService.getRepository();
      const filter = {
        securityId,
        sourceType,
        provider,
        epistemicStatus,
        asOfDate,
        limit
      };

      const rawEvidence = asOfDate
        ? repo.getEvidenceAvailableAsOf(asOfDate, filter)
        : repo.queryEvidence(filter);

      // Scope to public or caller-owned items
      const evidence = rawEvidence.filter(item => {
        const itemOwner = item.ownerUserId || (item as any).userId;
        if (!itemOwner) return true; // public
        return req.user?.userId && itemOwner === req.user.userId;
      });

      res.json({
        evidence,
        count: evidence.length,
        asOfDate: asOfDate || null,
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // ==========================================
  // GEMINI RESEARCH & ANALYSIS ENGINE (PHASE 7A)
  // ==========================================

  // Research Status endpoint
  app.get('/api/research/status', (_req, res) => {
    res.json({
      engine: geminiResearchEngine.getEngineName(),
      isConfigured: geminiResearchEngine.isConfigured(),
      timestamp: new Date().toISOString()
    });
  });

  // Research Inquiry & Synthesis endpoint
  app.post('/api/research/analyze', async (req, res) => {
    try {
      const { query, securityIds, analysisType, portfolioContext } = req.body || {};

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'Query parameter is required and must be a non-empty string.' });
        return;
      }

      // 1. Resolve securities (from explicit IDs or via text extractor)
      let resolvedSecurities: SecurityIdentifier[] = [];
      if (Array.isArray(securityIds) && securityIds.length > 0) {
        resolvedSecurities = securityIds
          .map(id => resolveSecurity(id))
          .filter((s): s is SecurityIdentifier => s !== null);
      } else {
        resolvedSecurities = extractSecuritiesFromText(query);
      }

      // 2. Classify requested analysis type
      const requestedAnalysisType: ResearchAnalysisType =
        analysisType || classifyAnalysisType(query, resolvedSecurities);

      // 3. Ensure evidence repository is populated with factual multi-provider evidence
      await evidenceService.gatherEvidence({
        securities: resolvedSecurities,
        portfolioContext
      });

      // 4. Retrieve bounded, diverse evidence using Semantic Retrieval Engine (Phase 8B)
      const targetSecIds = resolvedSecurities.map(s => s.id || s.symbol);
      const retrievalResult = await retrievalEngine.retrieve({
        query: query.trim(),
        securityIds: targetSecIds.length > 0 ? targetSecIds : undefined,
        userId: req.user?.userId
      });

      // Map retrievalBundle to ResearchEvidenceItem
      let availableEvidence: ResearchEvidenceItem[] = retrievalResult.evidenceBundle.map(ev => ({
        id: ev.evidenceId,
        securityId: ev.securityId,
        symbol: ev.sourceReference?.symbol || ev.securityId,
        sourceType: ev.sourceType,
        provider: ev.provider,
        epistemicStatus: ev.epistemicStatus,
        isSimulated: ev.isSimulated,
        retrievedAt: ev.retrievedAt,
        filingDate: ev.filingDate,
        accessionNumber: ev.sourceReference?.accessionNumber,
        description: ev.title ? `${ev.title}: ${ev.content}` : ev.content,
        data: (ev.structuredValue as Record<string, unknown>) || null
      }));

      // Fallback: If retrieval returned empty, fallback to direct gatherEvidenceForSecurities
      if (availableEvidence.length === 0) {
        availableEvidence = await gatherEvidenceForSecurities(
          resolvedSecurities,
          query,
          portfolioContext
        );
      }

      // 5. Construct structured research request with retrieval metadata and preserved conflicts
      const topSources = Array.from(new Set(availableEvidence.map(e => `${e.sourceType} (${e.provider})`)));
      const request: ResearchRequest = {
        query: query.trim(),
        securities: resolvedSecurities,
        requestedAnalysisType,
        availableEvidence,
        context: {
          portfolioContext
        },
        retrievalMetadata: {
          retrievalMode: retrievalResult.retrievalMode,
          totalCandidates: retrievalResult.totalCandidates,
          retrievedCount: availableEvidence.length,
          topSources,
          conflictsCount: retrievalResult.conflicts.length
        },
        conflicts: retrievalResult.conflicts
      };

      // 6. Execute analysis via Gemini Research Engine
      const researchResponse = await geminiResearchEngine.analyze(request);

      res.json(researchResponse);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isUnavailable = errMsg.includes('missing') || errMsg.includes('unconfigured') || errMsg.includes('not configured');
      res.status(isUnavailable ? 503 : 500).json({
        error: errMsg,
        status: isUnavailable ? 'unavailable' : 'error',
        message: errMsg
      });
    }
  });

  // ==========================================
  // INVESTMENT RESEARCH NOTEBOOK API (PHASE 13)
  // ==========================================

  // List all active research notebooks
  app.get('/api/research/notebooks', (req, res) => {
    try {
      let list = researchNotebookService.listNotebooks();
      if (req.user?.userId) {
        list = list.filter(n => !n.ownerUserId || n.ownerUserId === req.user?.userId);
      } else {
        list = list.filter(n => !n.ownerUserId);
      }
      res.json({ notebooks: list, count: list.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Get or initialize research notebook for a security
  app.get('/api/research/notebook/:securityId', async (req, res) => {
    try {
      const { securityId } = req.params;
      const asOfDate = req.query.asOfDate as string | undefined;
      const notebook = await researchNotebookService.getOrCreateNotebook(securityId, asOfDate);
      res.json(notebook);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Get source registry items for a security
  app.get('/api/research/notebook/:securityId/sources', async (req, res) => {
    try {
      const { securityId } = req.params;
      const asOfDate = req.query.asOfDate as string | undefined;
      const sources = await researchNotebookService.getNotebookSources(securityId, asOfDate);
      res.json({ sources, count: sources.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Get transparent source coverage for a security
  app.get('/api/research/notebook/:securityId/coverage', async (req, res) => {
    try {
      const { securityId } = req.params;
      const asOfDate = req.query.asOfDate as string | undefined;
      const coverage = await researchNotebookService.getCoverage(securityId, asOfDate);
      res.json(coverage);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Execute research inquiry and synthesize snapshot
  app.post('/api/research/notebook/:securityId/execute', async (req, res) => {
    try {
      const { securityId } = req.params;
      const { queryType = 'INVESTMENT_THESIS', customQuery, asOfDate, portfolioContext, sourceFilter } = req.body || {};
      const snapshot = await researchNotebookService.executeResearch({
        securityId,
        queryType,
        customQuery,
        asOfDate,
        portfolioContext,
        sourceFilter
      });
      res.json(snapshot);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // List historical research snapshots for a notebook
  app.get('/api/research/notebook/:securityId/snapshots', (req, res) => {
    try {
      const { securityId } = req.params;
      const canonical = resolveSecurity(securityId);
      const notebookId = canonical ? `nb-${canonical.id}` : `nb-${securityId}`;
      const snapshots = researchNotebookService.getSnapshots(notebookId);
      res.json({ snapshots, count: snapshots.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Get a single research snapshot by ID
  app.get('/api/research/snapshot/:snapshotId', async (req, res) => {
    try {
      const { snapshotId } = req.params;
      const snapshot = researchNotebookService.getSnapshot(snapshotId);
      if (!snapshot) {
        res.status(404).json({ error: `Snapshot ${snapshotId} not found.` });
        return;
      }
      await authorizationService.authorizeSnapshot(snapshotId, req.user?.userId || '');
      res.json(snapshot);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // ==========================================
  // RESEARCH DOCUMENT INTELLIGENCE API (PHASE 14)
  // ==========================================

  // Ingest & parse uploaded document
  app.post('/api/documents/upload', async (req, res) => {
    try {
      const payload = {
        ...req.body,
        ownerUserId: req.user?.userId || undefined,
        userId: req.user?.userId || undefined,
        uploadedBy: req.user?.email || 'system'
      };
      const result = await documentIngestionService.ingestDocument(payload);
      res.status(200).json(result);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: errMsg });
    }
  });

  // Validate document without persisting
  app.post('/api/documents/validate', async (req, res) => {
    try {
      const result = await documentIngestionService.validateDocument(req.body);
      res.status(200).json(result);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: errMsg });
    }
  });

  // Document Registry Stats
  app.get('/api/documents/stats', (_req, res) => {
    try {
      const stats = documentRegistry.getStats();
      res.json(stats);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // List all registered research documents (optionally filtered by securityId)
  app.get('/api/documents', (req, res) => {
    try {
      const { securityId } = req.query;
      const userId = req.user?.userId;
      const docs = securityId
        ? documentRegistry.getDocumentsBySecurity(String(securityId), userId)
        : documentRegistry.getAllDocuments(userId);
      res.json({ documents: docs, count: docs.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Get single document by ID
  app.get('/api/documents/:documentId', async (req, res) => {
    try {
      const { documentId } = req.params;
      const doc = documentRegistry.getDocument(documentId);
      if (!doc) {
        res.status(404).json({ error: `Document ${documentId} not found.` });
        return;
      }
      await authorizationService.authorizeDocument(documentId, req.user?.userId || '');
      res.json(doc);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // Delete document and purge its evidence from repository
  app.delete('/api/documents/:documentId', async (req, res) => {
    try {
      const { documentId } = req.params;
      await authorizationService.authorizeDocument(documentId, req.user?.userId || '');
      const success = documentIngestionService.deleteDocument(documentId);
      if (!success) {
        res.status(404).json({ error: `Document ${documentId} not found.` });
        return;
      }
      res.json({ success: true, deletedDocumentId: documentId });
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // ==========================================
  // PORTFOLIO INTELLIGENCE & ANALYTICS (PHASE 9)
  // ==========================================

  // Deterministic Portfolio Metrics endpoint (GET)
  app.get('/api/portfolio/metrics', (req, res) => {
    try {
      const baseCurrency = (req.query.baseCurrency as string) === 'INR' ? 'INR' : 'USD';
      const metrics = portfolioIntelligenceService.getPortfolioMetrics(undefined, baseCurrency);
      res.json({
        metrics,
        baseCurrency,
        epistemicStatus: 'CALCULATED',
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Deterministic Portfolio Metrics endpoint (POST for custom portfolio states)
  app.post('/api/portfolio/metrics', (req, res) => {
    try {
      const { portfolio, baseCurrency = 'USD' } = req.body || {};
      const metrics = portfolioIntelligenceService.getPortfolioMetrics(portfolio, baseCurrency === 'INR' ? 'INR' : 'USD');
      res.json({
        metrics,
        baseCurrency,
        epistemicStatus: 'CALCULATED',
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Portfolio Inquiry, Attribution & Grounded Explanation endpoint
  app.post('/api/portfolio/analyze', async (req, res) => {
    try {
      const { query, portfolioContext, asOfDate } = req.body || {};

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'Query parameter is required and must be a non-empty string.' });
        return;
      }

      const analysis = await portfolioIntelligenceService.analyzePortfolioQuestion({
        query: query.trim(),
        portfolioContext,
        asOfDate
      });

      res.json(analysis);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // ==========================================
  // WATCHLIST & ALERT INTELLIGENCE (PHASE 10)
  // ==========================================

  // Watchlist endpoints
  app.get('/api/watchlist', (req, res) => {
    try {
      const items = watchlistAlertService.getWatchlist(req.user?.userId);
      res.json({ watchlist: items, count: items.length, timestamp: new Date().toISOString() });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/watchlist', (req, res) => {
    try {
      const { symbol, securityId, market, exchange, currency, notes } = req.body || {};
      if (!symbol || typeof symbol !== 'string') {
        res.status(400).json({ error: 'Symbol is required' });
        return;
      }
      const item = watchlistAlertService.addWatchlistItem({
        symbol,
        securityId,
        market,
        exchange,
        currency,
        notes,
        ownerUserId: req.user?.userId
      });
      res.status(201).json(item);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.delete('/api/watchlist/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await authorizationService.authorizeWatchlistItem(id, req.user?.userId || '');
      const success = watchlistAlertService.removeWatchlistItem(id);
      if (!success) {
        res.status(404).json({ error: `Watchlist item ${id} not found` });
        return;
      }
      res.json({ success: true, message: `Watchlist item ${id} removed` });
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  app.patch('/api/watchlist/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await authorizationService.authorizeWatchlistItem(id, req.user?.userId || '');
      const { enabled } = req.body || {};
      const updated = watchlistAlertService.toggleWatchlistItem(id, enabled);
      if (!updated) {
        res.status(404).json({ error: `Watchlist item ${id} not found` });
        return;
      }
      res.json(updated);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // Alert Rules endpoints
  app.get('/api/alerts/rules', (req, res) => {
    try {
      const securityId = req.query.securityId as string | undefined;
      const symbol = req.query.symbol as string | undefined;
      const enabled = req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined;
      const alertType = req.query.alertType as any;
      const userId = req.user?.userId;
      const rules = watchlistAlertService.getAlertRules({ securityId, symbol, enabled, alertType, userId });
      res.json({ rules, count: rules.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/alerts/rules', (req, res) => {
    try {
      const { securityId, portfolioId, symbol, alertType, threshold, comparison, priority, cooldownMinutes, enabled, metadata } = req.body || {};
      if (!alertType || threshold === undefined) {
        res.status(400).json({ error: 'alertType and threshold are required fields' });
        return;
      }
      const rule = watchlistAlertService.createAlertRule({
        securityId,
        portfolioId,
        symbol,
        alertType,
        threshold,
        comparison,
        priority,
        cooldownMinutes,
        enabled,
        metadata,
        ownerUserId: req.user?.userId
      });
      res.status(201).json(rule);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.patch('/api/alerts/rules/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (req.user?.userId) {
        await authorizationService.authorizeAlertRule(id, req.user.userId);
      }
      const updated = watchlistAlertService.updateAlertRule(id, req.body || {});
      if (!updated) {
        res.status(404).json({ error: `Alert rule ${id} not found` });
        return;
      }
      res.json(updated);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  app.delete('/api/alerts/rules/:id', async (req, res) => {
    try {
      const id = req.params.id;
      await authorizationService.authorizeAlertRule(id, req.user?.userId || '');
      const success = watchlistAlertService.deleteAlertRule(id);
      if (!success) {
        res.status(404).json({ error: `Alert rule ${id} not found` });
        return;
      }
      res.json({ success: true, message: `Alert rule ${id} deleted` });
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // Alert Events and Evaluation endpoints
  app.get('/api/alerts/events', (req, res) => {
    try {
      const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
      const priority = req.query.priority as any;
      const securityId = req.query.securityId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const userId = req.user?.userId;
      const events = watchlistAlertService.getAlertEvents({ isRead, priority, securityId, limit, userId });
      res.json({ events, count: events.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/alerts/evaluate', async (req, res) => {
    try {
      const { force, asOfDate } = req.body || {};
      const result = await watchlistAlertService.evaluateAll({ force, asOfDate });
      res.json(result);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/alerts/:id/analyze', async (req, res) => {
    try {
      const eventId = req.params.id;
      const analysis = await watchlistAlertService.generateContextForAlert(eventId);
      res.json({ eventId, contextualAnalysis: analysis });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/alerts/:id/read', async (req, res) => {
    try {
      const eventId = req.params.id;
      if (req.user?.userId) {
        await authorizationService.authorizeAlertEvent(eventId, req.user.userId);
      }
      const event = watchlistAlertService.markAlertRead(eventId);
      if (!event) {
        res.status(404).json({ error: `Alert event ${eventId} not found` });
        return;
      }
      res.json(event);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  app.post('/api/alerts/:id/acknowledge', async (req, res) => {
    try {
      const eventId = req.params.id;
      if (req.user?.userId) {
        await authorizationService.authorizeAlertEvent(eventId, req.user.userId);
      }
      const event = watchlistAlertService.acknowledgeAlert(eventId);
      if (!event) {
        res.status(404).json({ error: `Alert event ${eventId} not found` });
        return;
      }
      res.json(event);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // ==========================================
  // QUANTITATIVE STRATEGY ENGINE API ROUTES (Phase 11)
  // ==========================================

  // List all available strategies
  app.get('/api/strategies', (_req, res) => {
    try {
      const strategies = quantStrategyEngine.getBuiltinStrategies();
      res.json({
        strategies,
        count: strategies.length,
        isAnalyticalOnly: true,
        executionProhibited: true
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Get details for a specific strategy
  app.get('/api/strategies/:id', async (req, res) => {
    try {
      const strategyId = req.params.id;
      await authorizationService.authorizeStrategy(strategyId, req.user?.userId || '');
      const strategy = quantStrategyEngine.getStrategy(strategyId);
      if (!strategy) {
        res.status(404).json({ error: `Strategy '${strategyId}' not found` });
        return;
      }
      res.json(strategy);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // Evaluate a quantitative strategy for a security
  app.post('/api/strategies/evaluate', async (req, res) => {
    try {
      const { strategyId, symbol, market, exchange, currency, parameters, asOfDate, portfolioContext } = req.body;
      const result = await quantStrategyEngine.evaluateStrategy({
        strategyId,
        symbol,
        market,
        exchange,
        currency,
        parameters,
        asOfDate,
        portfolioContext
      });
      res.json(result);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Validate a quantitative strategy definition
  app.post('/api/strategies/validate', (req, res) => {
    try {
      const strategy = req.body;
      const validation = quantStrategyEngine.validateStrategy(strategy);
      res.json(validation);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Register a custom quantitative strategy
  app.post('/api/strategies/custom', (req, res) => {
    try {
      const strategy = {
        ...req.body,
        ownerUserId: req.user?.userId || undefined,
        userId: req.user?.userId || undefined
      };
      const result = quantStrategyEngine.registerCustomStrategy(strategy);
      if (!result.valid) {
        res.status(400).json({ error: 'Validation failed', errors: result.errors });
        return;
      }
      res.json({ message: 'Strategy registered successfully', strategyId: strategy.strategyId });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // ==========================================
  // PHASE 12A - BACKTESTING ENGINE API ROUTES
  // ==========================================

  // Execute a deterministic backtest
  app.post('/api/backtests/run', async (req, res) => {
    try {
      const config = req.body.config || req.body;
      if (config && req.user?.userId) {
        config.ownerUserId = req.user.userId;
      }
      const result = await backtestService.runBacktest(config);
      res.json({
        success: result.status === 'COMPLETED',
        result,
        ...result
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: errMsg });
    }
  });

  // Validate a backtest configuration
  app.post('/api/backtests/validate', async (req, res) => {
    try {
      const config = req.body;
      const validation = await backtestService.validateConfig(config);
      res.json(validation);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Retrieve a backtest result by ID
  app.get('/api/backtests/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await authorizationService.authorizeBacktest(id, req.user?.userId || '');
      const result = backtestService.getBacktest(id);
      if (!result) {
        res.status(404).json({ error: `Backtest with ID '${id}' not found` });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // Retrieve all cached backtest results
  app.get('/api/backtests', (req, res) => {
    try {
      let backtests = backtestService.getAllBacktests();
      if (req.user?.userId) {
        backtests = backtests.filter(b => !b.ownerUserId || b.ownerUserId === req.user?.userId);
      } else {
        backtests = backtests.filter(b => !b.ownerUserId);
      }
      res.json({ backtests, count: backtests.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Retrieve comprehensive backtest report by ID
  app.get('/api/backtests/:id/report', async (req, res) => {
    try {
      const { id } = req.params;
      await authorizationService.authorizeBacktest(id, req.user?.userId || '');
      const result = backtestService.getBacktest(id);
      if (!result) {
        res.status(404).json({ error: `Backtest with ID '${id}' not found` });
        return;
      }
      res.json(result.report || { error: 'Report not generated for backtest' });
    } catch (error: unknown) {
      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // ==========================================
  // PHASE 15 - INVESTMENT DECISION INTELLIGENCE
  // ==========================================

  // Evaluate or retrieve an investment decision assessment
  app.get('/api/decisions/:securityId', async (req, res) => {
    try {
      const { securityId } = req.params;
      const asOfDate = req.query.asOfDate as string | undefined;
      const assessment = await decisionIntelligenceService.evaluateDecision({
        securityId,
        asOfDate,
        forceRefresh: req.query.refresh === 'true'
      });
      res.json(assessment);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // POST evaluate investment decision with custom parameters or configuration
  app.post('/api/decisions/evaluate', async (req, res) => {
    try {
      const request = req.body;
      if (!request || !request.securityId) {
        res.status(400).json({ error: 'securityId is required in request body.' });
        return;
      }
      const assessment = await decisionIntelligenceService.evaluateDecision(request);
      res.json(assessment);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Point-in-time specific decision retrieval
  app.get('/api/decisions/:securityId/as-of/:date', async (req, res) => {
    try {
      const { securityId, date } = req.params;
      const assessment = await decisionIntelligenceService.evaluateDecision({
        securityId,
        asOfDate: date,
        forceRefresh: req.query.refresh === 'true'
      });
      res.json(assessment);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Compare two securities' investment decision assessments
  app.post('/api/decisions/compare', async (req, res) => {
    try {
      const request = req.body;
      if (!request || !request.securityIdA || !request.securityIdB) {
        res.status(400).json({ error: 'Both securityIdA and securityIdB are required in request body.' });
        return;
      }
      const comparison = await decisionIntelligenceService.compareDecisions(request);
      res.json(comparison);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // ==========================================
  // PHASE 16 - PERSISTENCE & HISTORICAL AUDIT ROUTES
  // ==========================================

  // Persistence status and health
  app.get('/api/persistence/status', async (_req, res) => {
    try {
      const status = await persistenceManager.getStatus();
      res.json(status);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Historical decisions for a security
  app.get('/api/persistence/decisions/:securityId', async (req, res) => {
    try {
      const { securityId } = req.params;
      const history = await decisionIntelligenceService.getHistoricalDecisions(securityId);
      res.json({ securityId, history, count: history.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Historical research snapshots for a security
  app.get('/api/persistence/snapshots/:securityId', async (req, res) => {
    try {
      const { securityId } = req.params;
      const resolved = resolveSecurity(securityId);
      const targetId = resolved ? resolved.id : securityId;
      const snapshots = await persistenceManager.getSnapshotRepository().getBySecurityId(targetId);
      res.json({ securityId: targetId, snapshots, count: snapshots.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Persisted research documents
  app.get('/api/persistence/documents', async (_req, res) => {
    try {
      const docs = await persistenceManager.getDocumentRepository().getAll();
      res.json({ documents: docs, count: docs.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Persisted evidence query
  app.get('/api/persistence/evidence', async (req, res) => {
    try {
      const securityId = req.query.securityId as string | undefined;
      const asOfDate = req.query.asOfDate as string | undefined;
      const items = await persistenceManager.getEvidenceRepository().queryEvidence({ securityId, asOfDate });
      res.json({ evidence: items, count: items.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Persisted backtests
  app.get('/api/persistence/backtests', async (_req, res) => {
    try {
      const backtests = await persistenceManager.getBacktestRepository().getAll();
      res.json({ backtests, count: backtests.length });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: errMsg });
    }
  });

  // ==========================================
  // PHASE 18: STRUCTURED ERROR HANDLING MIDDLEWARE
  // ==========================================
  app.use('/api', errorHandler);

  // ==========================================
  // VITE DEV & PRODUCTION MIDDLEWARE
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Investment Intelligence] Full-stack server running on http://0.0.0.0:${PORT}`);
  });

  // Phase 19: Graceful Shutdown
  const gracefulShutdown = async (signal: string) => {
    structuredLogger.info(`Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      try {
        await persistenceManager.shutdown();
        structuredLogger.info('Persistence shutdown complete. Process exiting cleanly.');
        process.exit(0);
      } catch (err) {
        structuredLogger.error('Error during graceful shutdown', { errorCategory: 'SHUTDOWN_ERROR', metadata: { error: String(err) } });
        process.exit(1);
      }
    });

    // Hard fallback timeout
    setTimeout(() => {
      structuredLogger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
