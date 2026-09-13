/**
 * Portfolio Intelligence Service (Phase 9)
 * 
 * Provides deterministic portfolio analytics, risk modeling, concentration metrics,
 * currency segregation, and evidence-grounded AI explanations for portfolio queries.
 * 
 * Architectural Mandate:
 * - Gemini must NEVER be the source of portfolio mathematics.
 * - Gemini explains portfolio facts; it does not calculate them.
 * - Every calculated metric is strictly classified as 'CALCULATED'.
 * - USD and INR values remain strictly segregated without explicit FX rates.
 */

import { GoogleGenAI } from '@google/genai';
import {
  PortfolioMetrics,
  PortfolioAnalysisRequest,
  PortfolioAnalysisResponse,
  PortfolioQuestionIntent,
  ResearchEvidenceItem,
  EvidenceItem,
  PortfolioData
} from '../../../src/types';
import {
  computePortfolioMetrics,
  DEFAULT_HOLDING_POSITIONS,
  derivePortfolio
} from '../../../src/state/portfolioEngine';
import { CANONICAL_SECURITIES_MAP } from '../../../src/data/mockData';
import { portfolioEvidenceAdapter } from '../evidence/adapters/portfolioEvidenceAdapter';
import { evidenceService } from '../evidence/evidenceService';
import { retrievalEngine } from '../retrieval/retrievalEngine';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';

export class PortfolioIntelligenceService {
  private aiClient: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-2.5-flash';

  private getClient(): GoogleGenAI | null {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey.trim().length > 0) {
        this.aiClient = new GoogleGenAI({ apiKey });
      }
    }
    return this.aiClient;
  }

  /**
   * Compute deterministic portfolio metrics for a given portfolio state or default ledger.
   */
  public getPortfolioMetrics(customPortfolio?: Partial<PortfolioData>, baseCurrency: 'USD' | 'INR' = 'USD'): PortfolioMetrics {
    if (customPortfolio?.holdings && customPortfolio.holdings.length > 0) {
      return computePortfolioMetrics(customPortfolio.holdings, CANONICAL_SECURITIES_MAP, { baseCurrency });
    }
    const portfolio = derivePortfolio(DEFAULT_HOLDING_POSITIONS, CANONICAL_SECURITIES_MAP);
    if (portfolio.metrics) {
      return portfolio.metrics;
    }
    return computePortfolioMetrics(DEFAULT_HOLDING_POSITIONS, CANONICAL_SECURITIES_MAP, { baseCurrency });
  }

  /**
   * Classify the intent of a user's natural language portfolio inquiry.
   */
  public classifyIntent(query: string): PortfolioQuestionIntent {
    const q = query.toLowerCase();

    if (
      q.includes('driver') ||
      q.includes('driving') ||
      q.includes('why did my portfolio move') ||
      q.includes('p&l') ||
      q.includes('pnl') ||
      q.includes('gain') ||
      q.includes('loss') ||
      q.includes('contribute to today') ||
      q.includes('performance') ||
      q.includes('moved')
    ) {
      return 'PERFORMANCE';
    }

    if (
      q.includes('concentrat') ||
      q.includes('top holding') ||
      q.includes('top 5') ||
      q.includes('top 10') ||
      q.includes('hhi') ||
      q.includes('biggest holding') ||
      q.includes('largest position')
    ) {
      return 'CONCENTRATION';
    }

    if (
      q.includes('risk') ||
      q.includes('beta') ||
      q.includes('volatility') ||
      q.includes('drawdown') ||
      q.includes('covariance') ||
      q.includes('dominate')
    ) {
      return 'RISK';
    }

    if (
      q.includes('sector') ||
      q.includes('industry') ||
      q.includes('tech') ||
      q.includes('semiconductor') ||
      q.includes('financial')
    ) {
      return 'SECTOR';
    }

    if (
      q.includes('currency') ||
      q.includes('fx') ||
      q.includes('foreign currency') ||
      (q.includes('usd') && q.includes('inr'))
    ) {
      return 'CURRENCY';
    }

    if (
      q.includes('india') ||
      q.includes('inr') ||
      q.includes('rupee') ||
      q.includes('market') ||
      q.includes('region') ||
      q.includes('us vs')
    ) {
      return 'MARKET_REGION';
    }

    if (
      q.includes('usd') ||
      q.includes('foreign')
    ) {
      return 'CURRENCY';
    }

    if (
      q.includes('diversif') ||
      q.includes('spread') ||
      q.includes('balanced')
    ) {
      return 'DIVERSIFICATION';
    }

    if (
      q.includes('change') ||
      q.includes('rebalance') ||
      q.includes('difference')
    ) {
      return 'CHANGE';
    }

    return 'GENERAL';
  }

  /**
   * Primary entry point: analyze a portfolio question with deterministic facts,
   * semantic evidence retrieval, and strict epistemic explanation.
   */
  public async analyzePortfolioQuestion(request: PortfolioAnalysisRequest): Promise<PortfolioAnalysisResponse> {
    const { query, portfolioContext, asOfDate } = request;
    const intent = this.classifyIntent(query);

    // 1. Obtain deterministic metrics
    const metrics: PortfolioMetrics = portfolioContext?.metrics || this.getPortfolioMetrics(undefined, 'USD');

    // 2. Build structured deterministic facts from metrics
    const sectorExposureMap: Record<string, number> = {};
    metrics.sectorExposure.forEach(s => {
      sectorExposureMap[s.sector] = s.weightPct;
    });

    const marketExposureMap: Record<string, number> = {};
    metrics.marketExposure.forEach(m => {
      marketExposureMap[m.market] = m.weightPct;
    });

    const currencyExposureMap: Record<string, number> = {};
    metrics.currencyExposure.forEach(c => {
      currencyExposureMap[c.currency] = c.weightPct;
    });

    const topHoldings = [...metrics.positions]
      .sort((a, b) => b.weightPct - a.weightPct)
      .slice(0, 5)
      .map(p => ({
        symbol: p.symbol,
        weightPct: p.weightPct,
        pnl: p.dailyPnLContribution
      }));

    const sortedByPnL = [...metrics.positions].sort((a, b) => b.dailyPnLContribution - a.dailyPnLContribution);
    const topGainers = sortedByPnL.filter(p => p.dailyPnLContribution > 0).slice(0, 3).map(p => p.symbol);
    const topLosers = sortedByPnL.filter(p => p.dailyPnLContribution < 0).reverse().slice(0, 3).map(p => p.symbol);

    const topRiskContributors = [...metrics.positions]
      .filter(p => p.riskContributionPct.value !== null)
      .sort((a, b) => (b.riskContributionPct.value || 0) - (a.riskContributionPct.value || 0))
      .slice(0, 5)
      .map(p => ({
        symbol: p.symbol,
        riskPct: p.riskContributionPct.value || 0
      }));

    const deterministicFacts = {
      nav: metrics.totalValue,
      baseCurrency: metrics.baseCurrency,
      dailyPnL: metrics.performance.dailyPnL.value || 0,
      dailyReturnPct: metrics.performance.dailyReturnPct.value || 0,
      unrealizedPnL: metrics.performance.unrealizedPnL.value || 0,
      topHoldings,
      exposures: {
        sectors: sectorExposureMap,
        markets: marketExposureMap,
        currencies: currencyExposureMap
      },
      concentration: {
        top1WeightPct: metrics.concentration.top1WeightPct,
        top5WeightPct: metrics.concentration.top5WeightPct,
        hhi: metrics.concentration.herfindahlHirschmanIndex
      },
      risk: {
        portfolioBeta: metrics.risk.portfolioBeta.value,
        topRiskContributors
      },
      attribution: {
        topGainers,
        topLosers
      }
    };

    // 3. Register portfolio metrics into Evidence framework and retrieve grounded evidence
    const portItems = portfolioEvidenceAdapter.getEvidenceFromPortfolio(
      { metrics, totalNav: metrics.totalValue },
      undefined,
      asOfDate
    );
    evidenceService.getRepository().addEvidenceBatch(portItems);

    // 4. Semantic retrieval targeted for this portfolio question
    const retrievalResult = await retrievalEngine.retrieve({
      query,
      securityIds: metrics.positions.map(p => p.symbol)
    });

    const retrievedEvidence: ResearchEvidenceItem[] = retrievalResult.evidenceBundle.map(ev => ({
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

    // 5. Generate Grounded Explanation
    const explanation = await this.generateExplanation(
      query,
      intent,
      deterministicFacts,
      metrics,
      retrievedEvidence
    );

    return {
      query,
      intent,
      deterministicFacts,
      retrievedEvidence,
      explanation,
      causalityDisclaimer: 'Calculated portfolio factors and observed performance do not prove single-cause market catalysts. Price changes reflect aggregated market liquidity and participant actions.',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generates a disciplined explanation separating observed facts from inferences.
   * If Gemini API is available, calls Gemini with strict system prompts.
   * If not, uses a robust deterministic template.
   */
  private async generateExplanation(
    query: string,
    intent: PortfolioQuestionIntent,
    facts: PortfolioAnalysisResponse['deterministicFacts'],
    metrics: PortfolioMetrics,
    evidence: ResearchEvidenceItem[]
  ): Promise<PortfolioAnalysisResponse['explanation']> {
    const client = this.getClient();

    const baseFactsList: string[] = [
      `Portfolio NAV: $${facts.nav.toLocaleString()} ${facts.baseCurrency}`,
      `Daily Performance: ${facts.dailyPnL >= 0 ? '+' : ''}$${facts.dailyPnL.toLocaleString()} (${facts.dailyReturnPct >= 0 ? '+' : ''}${facts.dailyReturnPct.toFixed(2)}%)`,
      `Unrealized P&L: ${facts.unrealizedPnL >= 0 ? '+' : ''}$${facts.unrealizedPnL.toLocaleString()}`,
      `Largest Holding: ${metrics.concentration.largestPosition.symbol} (${metrics.concentration.largestPosition.weightPct.toFixed(1)}% weight)`,
      `Top 5 Holdings Weight: ${facts.concentration.top5WeightPct.toFixed(1)}%`,
      `Herfindahl-Hirschman Index (HHI): ${facts.concentration.hhi} (${(metrics.concentration.concentrationClassification || 'MODERATELY_CONCENTRATED').replace(/_/g, ' ')})`,
      `Portfolio Beta: ${facts.risk.portfolioBeta ?? 'Unavailable'}`
    ];

    const uncertaintiesList: string[] = [
      'Daily returns represent single-session changes and do not account for after-hours liquidity or spread costs.',
      metrics.risk.portfolioVolatility.status === 'UNAVAILABLE'
        ? 'Empirical multi-asset covariance matrix requires complete historical price bars; risk contributions currently use single-index factor beta estimates.'
        : 'Covariance matrix derived from historical trailing returns; future correlation regime shifts may alter risk contributions.',
      metrics.segregatedBuckets?.['INR']
        ? 'INR holdings are segregated natively and not merged into USD totals without verified FX rates.'
        : 'Cross-currency FX rates are monitored; segregation is maintained for foreign positions.'
    ];

    const simulatedNotices: string[] = metrics.isSimulated
      ? ['Portfolio contains simulated or hypothetical positions. Calculated metrics reflect modeled rather than execution values.']
      : [];

    const unavailableNotices: string[] = [];
    if (metrics.risk.portfolioVolatility.status === 'UNAVAILABLE') {
      unavailableNotices.push('Annualized volatility calculation is UNAVAILABLE due to incomplete historical price bars.');
    }
    if (metrics.risk.maxDrawdown.status === 'UNAVAILABLE') {
      unavailableNotices.push('Historical portfolio drawdown is UNAVAILABLE without recorded daily NAV series.');
    }

    // If Gemini is available, ground explanation through LLM
    if (client) {
      try {
        const systemPrompt = `You are the Portfolio Intelligence Explainer for an investment system.
You MUST adhere strictly to these principles:
1. NEVER invent or recalculate any numbers. All mathematics have already been deterministically computed.
2. Ground all statements in the PROVIDED DETERMINISTIC FACTS and RETRIEVED EVIDENCE.
3. CAUSALITY SAFEGUARD: Explicitly separate OBSERVED MOVEMENT from POSSIBLE EXPLANATION. Do NOT state "NVDA rose because of X" unless retrieved evidence explicitly confirms that causality. Use phrasing like "NVDA gained +3.52%; potential market context includes...".
4. Distinguish clearly between FACT (deterministic numbers), INFERENCE (reasoned interpretations), UNCERTAINTY, and UNAVAILABLE.
5. Provide response in strict JSON matching the requested schema.`;

        const evidenceSummary = evidence.slice(0, 8).map(e => `[${e.sourceType}/${e.epistemicStatus}] ${e.symbol}: ${e.description}`).join('\n');

        const userPrompt = `User Query: "${query}"
Intent: ${intent}

DETERMINISTIC PORTFOLIO FACTS:
- Total NAV: $${facts.nav.toLocaleString()}
- Daily P&L: $${facts.dailyPnL} (${facts.dailyReturnPct}%)
- Top Holdings: ${facts.topHoldings.map(h => `${h.symbol} (${h.weightPct}%)`).join(', ')}
- Sector Exposures: ${Object.entries(facts.exposures.sectors).map(([s, w]) => `${s}: ${w}%`).join(', ')}
- Concentration: Top 1 = ${facts.concentration.top1WeightPct}%, Top 5 = ${facts.concentration.top5WeightPct}%, HHI = ${facts.concentration.hhi}
- Portfolio Beta: ${facts.risk.portfolioBeta}
- Top Risk Contributors: ${facts.risk.topRiskContributors.map(r => `${r.symbol} (${r.riskPct.toFixed(1)}%)`).join(', ')}
- Daily Attribution: Top Gainers [${facts.attribution.topGainers.join(', ')}], Top Losers [${facts.attribution.topLosers.join(', ')}]

RETRIEVED EVIDENCE ITEMS:
${evidenceSummary || 'No external news evidence retrieved.'}

Return a valid JSON object with the following fields:
{
  "headline": string,
  "facts": string[],
  "inferences": string[],
  "uncertainties": string[],
  "simulatedNotices": string[],
  "unavailableNotices": string[],
  "narrative": string
}`;

        const generatePromise = client.models.generateContent({
          model: this.modelName,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API call timed out')), 4000)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);

        const text = response.text?.trim();
        if (text) {
          const parsed = JSON.parse(text);
          return {
            headline: parsed.headline || `Portfolio Analysis: ${intent}`,
            facts: Array.isArray(parsed.facts) && parsed.facts.length > 0 ? parsed.facts : baseFactsList,
            inferences: Array.isArray(parsed.inferences) ? parsed.inferences : [],
            uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : uncertaintiesList,
            simulatedNotices: Array.isArray(parsed.simulatedNotices) ? parsed.simulatedNotices : simulatedNotices,
            unavailableNotices: Array.isArray(parsed.unavailableNotices) ? parsed.unavailableNotices : unavailableNotices,
            narrative: parsed.narrative || 'Deterministic portfolio analysis generated from verified ledger positions.'
          };
        }
      } catch (err) {
        console.warn('[PortfolioIntelligenceService] Gemini explanation fallback:', err);
      }
    }

    // Deterministic fallback explanation
    return this.buildDeterministicNarrative(intent, facts, metrics, baseFactsList, uncertaintiesList, simulatedNotices, unavailableNotices);
  }

  private buildDeterministicNarrative(
    intent: PortfolioQuestionIntent,
    facts: PortfolioAnalysisResponse['deterministicFacts'],
    metrics: PortfolioMetrics,
    factsList: string[],
    uncertaintiesList: string[],
    simulatedNotices: string[],
    unavailableNotices: string[]
  ): PortfolioAnalysisResponse['explanation'] {
    let headline = '';
    let narrative = '';
    const inferences: string[] = [];

    switch (intent) {
      case 'PERFORMANCE': {
        const sign = facts.dailyPnL >= 0 ? '+' : '';
        const topGainer = facts.attribution.topGainers[0] || 'N/A';
        const topLoser = facts.attribution.topLosers[0] || 'N/A';
        headline = `Portfolio Daily Return: ${sign}${facts.dailyReturnPct.toFixed(2)}% (${sign}$${facts.dailyPnL.toLocaleString()})`;
        narrative = `Today's portfolio performance was driven primarily by ${topGainer} on the upside, while ${topLoser} exerted the greatest downward drag. Total portfolio NAV stands at $${facts.nav.toLocaleString()} with aggregate unrealized profit of $${facts.unrealizedPnL.toLocaleString()}. Performance attribution is calculated strictly from holding weights and single-session price delta.`;
        inferences.push(`Primary upside contributor: ${topGainer}`);
        if (facts.attribution.topLosers.length > 0) {
          inferences.push(`Primary downside drag: ${topLoser}`);
        }
        break;
      }

      case 'CONCENTRATION': {
        const top1 = metrics.concentration.largestPosition;
        const classLabel = (metrics.concentration.concentrationClassification || 'MODERATELY_CONCENTRATED').replace(/_/g, ' ');
        headline = `Portfolio Concentration: HHI ${facts.concentration.hhi} (${classLabel})`;
        narrative = `The portfolio's single largest holding is ${top1.symbol} at ${top1.weightPct.toFixed(1)}% of total assets ($${top1.marketValue.toLocaleString()}). The top 5 holdings represent ${facts.concentration.top5WeightPct.toFixed(1)}% of the total NAV. The Herfindahl-Hirschman Index of ${facts.concentration.hhi} indicates a ${classLabel.toLowerCase()} distribution. ${metrics.concentration.observations.join(' ')}`;
        inferences.push(`Largest concentration node: ${top1.symbol} (${top1.weightPct.toFixed(1)}%)`);
        inferences.push(`Cumulative Top 5 concentration: ${facts.concentration.top5WeightPct.toFixed(1)}%`);
        break;
      }

      case 'RISK': {
        const topRisk = facts.risk.topRiskContributors[0];
        headline = `Systematic Risk Profile: Beta ${facts.risk.portfolioBeta ?? 'N/A'} vs S&P 500`;
        narrative = `The portfolio exhibits a calculated systematic Beta of ${facts.risk.portfolioBeta ?? 'N/A'}. The largest contributor to portfolio volatility is ${topRisk ? `${topRisk.symbol} (${topRisk.riskPct.toFixed(1)}% of total risk)` : 'N/A'}. Risk contributions reflect position weight combined with benchmark covariance and factor sensitivity.`;
        if (topRisk) {
          inferences.push(`Dominant risk contributor: ${topRisk.symbol} (${topRisk.riskPct.toFixed(1)}% risk contribution)`);
        }
        break;
      }

      case 'SECTOR': {
        const topSector = metrics.sectorExposure[0];
        headline = `Sector Allocation: ${topSector ? topSector.sector : 'Diversified'} (${topSector ? topSector.weightPct.toFixed(1) : 0}%)`;
        narrative = `The portfolio's largest industry exposure is ${topSector ? topSector.sector : 'N/A'} at ${topSector ? topSector.weightPct.toFixed(1) : 0}% ($${topSector ? topSector.marketValue.toLocaleString() : 0}) across ${topSector ? topSector.positionCount : 0} positions. Exposures are reconciled against verified GICS sector classifications.`;
        if (topSector) {
          inferences.push(`Primary sector concentration: ${topSector.sector} at ${topSector.weightPct.toFixed(1)}%`);
        }
        break;
      }

      case 'MARKET_REGION':
      case 'CURRENCY': {
        const inrBucket = metrics.segregatedBuckets?.['INR'];
        headline = `Currency & Regional Exposure: USD ${facts.exposures.currencies['USD'] || 100}%`;
        narrative = `The portfolio maintains primary exposure in USD. Foreign assets ${inrBucket ? `(such as ₹${inrBucket.totalValueNative.toLocaleString()} in Indian equities)` : 'are tracked in native currencies'} are segregated cleanly without synthetic conversion unless official live FX benchmarks are confirmed.`;
        inferences.push(`Base currency: ${facts.baseCurrency}`);
        if (inrBucket) {
          inferences.push(`Segregated INR assets: ₹${inrBucket.totalValueNative.toLocaleString()} (${inrBucket.positions.length} positions)`);
        }
        break;
      }

      default: {
        headline = `Portfolio Overview: $${facts.nav.toLocaleString()} NAV (Beta: ${facts.risk.portfolioBeta ?? 'N/A'})`;
        narrative = `The portfolio comprises ${metrics.positions.length} holdings with an aggregate NAV of $${facts.nav.toLocaleString()} ${facts.baseCurrency}. Daily movement is ${facts.dailyPnL >= 0 ? '+' : ''}$${facts.dailyPnL.toLocaleString()} (${facts.dailyReturnPct >= 0 ? '+' : ''}${facts.dailyReturnPct.toFixed(2)}%). Top 5 concentration is ${facts.concentration.top5WeightPct.toFixed(1)}% with an HHI of ${facts.concentration.hhi}.`;
        inferences.push(`Overall diversification: ${(metrics.concentration.concentrationClassification || 'MODERATELY_CONCENTRATED').replace(/_/g, ' ')}`);
        break;
      }
    }

    return {
      headline,
      facts: factsList,
      inferences,
      uncertainties: uncertaintiesList,
      simulatedNotices,
      unavailableNotices,
      narrative
    };
  }
}

export const portfolioIntelligenceService = new PortfolioIntelligenceService();
