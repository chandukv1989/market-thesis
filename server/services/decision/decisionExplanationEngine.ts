/**
 * Phase 15 - Decision Explanation Engine
 * 
 * Enriches deterministic decision assessments with grounded institutional narratives.
 * 
 * Invariants:
 * 1. Gemini NEVER calculates numbers, metrics, scores, or categories.
 * 2. Gemini explains the deterministic assessment; it never overrides it.
 * 3. Graceful fallback on HTTP 429, missing keys, or network failures.
 * 4. Grounded strictly in retrieved evidence and deterministic dimension outputs.
 */

import { GoogleGenAI } from '@google/genai';
import { InvestmentDecisionAssessment } from '../../../src/types';

export class DecisionExplanationEngine {
  private static instance: DecisionExplanationEngine;
  private aiClient: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-2.5-flash';

  public static getInstance(): DecisionExplanationEngine {
    if (!DecisionExplanationEngine.instance) {
      DecisionExplanationEngine.instance = new DecisionExplanationEngine();
    }
    return DecisionExplanationEngine.instance;
  }

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
   * Enriches an assessment's explanation using Gemini or clean deterministic fallback.
   */
  public async enrichExplanation(assessment: InvestmentDecisionAssessment): Promise<InvestmentDecisionAssessment['explanation']> {
    const client = this.getClient();
    if (!client) {
      return this.generateDeterministicFallback(assessment);
    }

    try {
      const prompt = this.buildExplanationPrompt(assessment);
      const response = await client.models.generateContent({
        model: this.modelName,
        contents: prompt
      });

      const text = response.text || '';
      if (!text || text.trim().length === 0) {
        return this.generateDeterministicFallback(assessment);
      }

      // Parse structured sections from Gemini or fallback gracefully
      return this.parseGeminiExplanation(text, assessment);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[DecisionExplanationEngine] Gemini enrichment bypassed: ${errorMsg}`);
      return this.generateDeterministicFallback(assessment);
    }
  }

  /**
   * 100% Deterministic Fallback without LLM calls.
   */
  public generateDeterministicFallback(assessment: InvestmentDecisionAssessment): InvestmentDecisionAssessment['explanation'] {
    const sec = assessment.canonicalSecurity;
    const overall = assessment.overallAssessment;
    const conviction = assessment.conviction;

    const summary = `Deterministic Decision Evaluation for ${sec.name} (${sec.ticker}): ` +
      `The algorithmic framework classifies the current analytical setup as ${overall} with ${conviction} conviction as of ${assessment.asOfDate}. ` +
      `This assessment is derived across ${assessment.dimensionsList.length} distinct analytical dimensions based on verified point-in-time evidence.`;

    const whyDrivers = assessment.keyDrivers.length > 0
      ? assessment.keyDrivers
      : assessment.dimensionsList
          .filter(d => d.category === 'POSITIVE')
          .map(d => `${d.dimensionName}: ${d.rationale}`);

    const counterEvidence = assessment.counterEvidence.length > 0
      ? assessment.counterEvidence
      : assessment.dimensionsList
          .filter(d => d.category === 'NEGATIVE' || d.category === 'CAUTIOUS')
          .map(d => `${d.dimensionName}: ${d.rationale}`);

    const keyRisksSummary = assessment.keyRisks.map(r => `[${r.severity}] ${r.title}: ${r.description}`);

    const portfolioImplicationSummary = assessment.portfolioContext.isHeld
      ? `Existing portfolio allocation: ${assessment.portfolioContext.currentWeightPct?.toFixed(1) ?? '0.0'}%. ${assessment.portfolioContext.implication}`
      : 'Security is not currently held in the portfolio. Position initiation is unconstrained by existing holding concentration.';

    const invalidationSummary = assessment.invalidationConditions.map(
      c => `[${c.category}] ${c.condition} (Status: ${c.status})`
    );

    return {
      summary,
      whyDrivers: whyDrivers.slice(0, 5),
      counterEvidence: counterEvidence.slice(0, 5),
      keyRisksSummary: keyRisksSummary.slice(0, 5),
      portfolioImplicationSummary,
      invalidationSummary,
      disclaimer: 'Past simulated performance does not guarantee future results. This assessment is purely analytical and does not constitute financial advice or an order recommendation.',
      generatedBy: 'DETERMINISTIC_FALLBACK'
    };
  }

  private buildExplanationPrompt(assessment: InvestmentDecisionAssessment): string {
    const sec = assessment.canonicalSecurity;
    const dimText = assessment.dimensionsList
      .map(d => `- ${d.dimensionName}: [${d.assessment}] Category: ${d.category}. Rationale: ${d.rationale}`)
      .join('\n');

    return `You are an institutional investment intelligence analyst.
Explain the following DETERMINISTIC investment assessment clearly and objectively.

CRITICAL CONSTRAINTS:
1. Do NOT change or dispute the deterministic overall assessment: "${assessment.overallAssessment}" or conviction: "${assessment.conviction}".
2. Do NOT invent financial numbers, valuation multiples, or stock price targets.
3. Do NOT make future return guarantees or claim to predict future stock prices.
4. Maintain strict institutional composure with precise terminology.

SECURITY: ${sec.name} (${sec.ticker}) · Market: ${sec.market} · Currency: ${sec.currency}
DATE: ${assessment.asOfDate}
OVERALL ASSESSMENT: ${assessment.overallAssessment}
CONVICTION: ${assessment.conviction}

DIMENSIONS:
${dimText}

PORTFOLIO CONTEXT:
Is Held: ${assessment.portfolioContext.isHeld}
Weight: ${assessment.portfolioContext.currentWeightPct ?? 0}%
Implication: ${assessment.portfolioContext.implication}

Please provide a concise, structured response formatted exactly as follows:
SUMMARY: <3-4 sentence objective summary of the deterministic setup>
WHY_DRIVERS:
- <Driver 1>
- <Driver 2>
COUNTER_EVIDENCE:
- <Counter point 1>
- <Counter point 2>
PORTFOLIO_IMPLICATION: <1-2 sentences on portfolio fit and concentration>`;
  }

  private parseGeminiExplanation(text: string, assessment: InvestmentDecisionAssessment): InvestmentDecisionAssessment['explanation'] {
    try {
      const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=WHY_DRIVERS:|$)/i);
      const whyMatch = text.match(/WHY_DRIVERS:\s*([\s\S]*?)(?=COUNTER_EVIDENCE:|$)/i);
      const counterMatch = text.match(/COUNTER_EVIDENCE:\s*([\s\S]*?)(?=PORTFOLIO_IMPLICATION:|$)/i);
      const portfolioMatch = text.match(/PORTFOLIO_IMPLICATION:\s*([\s\S]*?)$/i);

      const summary = summaryMatch ? summaryMatch[1].trim() : assessment.explanation.summary;
      
      const whyDrivers = whyMatch
        ? whyMatch[1].split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 0)
        : assessment.keyDrivers;

      const counterEvidence = counterMatch
        ? counterMatch[1].split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 0)
        : assessment.counterEvidence;

      const portfolioImplicationSummary = portfolioMatch
        ? portfolioMatch[1].trim()
        : assessment.portfolioContext.implication;

      return {
        summary: summary || assessment.explanation.summary,
        whyDrivers: whyDrivers.length > 0 ? whyDrivers.slice(0, 5) : assessment.keyDrivers,
        counterEvidence: counterEvidence.length > 0 ? counterEvidence.slice(0, 5) : assessment.counterEvidence,
        keyRisksSummary: assessment.keyRisks.map(r => `[${r.severity}] ${r.title}: ${r.description}`),
        portfolioImplicationSummary: portfolioImplicationSummary || assessment.portfolioContext.implication,
        invalidationSummary: assessment.invalidationConditions.map(c => `[${c.category}] ${c.condition} (Status: ${c.status})`),
        disclaimer: 'Past simulated performance does not guarantee future results. This assessment is purely analytical and does not constitute financial advice or an order recommendation.',
        generatedBy: 'GEMINI_ENRICHED'
      };
    } catch {
      return this.generateDeterministicFallback(assessment);
    }
  }
}

export const decisionExplanationEngine = DecisionExplanationEngine.getInstance();
