/**
 * Gemini-Backed Research Engine Implementation (Phase 7A)
 * 
 * Invokes server-side Google GenAI (Gemini) with strict epistemic boundaries,
 * structured JSON output schema, and local TTL caching.
 */

import { GoogleGenAI } from '@google/genai';
import {
  ResearchRequest,
  ResearchResponse,
  ResearchSection,
  ResearchEvidenceReference,
  ResearchEpistemicClassification
} from '../../../src/types';
import { ResearchEngine } from './researchEngine';
import { RESEARCH_SYSTEM_PROMPT, buildUserPrompt } from './prompts';

export class GeminiResearchEngine implements ResearchEngine {
  private aiClient: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-3.8-flash';
  private readonly engineVersion = 'Gemini-3.8-Flash (Phase 7A Foundation)';

  // In-memory cache for repeated research queries (TTL: 5 minutes)
  private cache = new Map<string, { response: ResearchResponse; timestamp: number }>();
  private readonly cacheTTLMs = 5 * 60 * 1000;

  public getEngineName(): string {
    return this.engineVersion;
  }

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return typeof key === 'string' && key.trim().length > 0;
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        throw new Error('GEMINI_API_KEY environment variable is missing or unconfigured on the server.');
      }
      this.aiClient = new GoogleGenAI({ apiKey });
    }
    return this.aiClient;
  }

  /**
   * Generates a deterministic cache key based on query, securities, and analysis type
   */
  public generateCacheKey(request: ResearchRequest): string {
    const q = (request.query || '').trim().toLowerCase();
    const secIds = request.securities.map(s => s.id || s.symbol).sort().join('|');
    return `${q}::${secIds}::${request.requestedAnalysisType}`;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public async analyze(request: ResearchRequest, options?: { fallbackOnError?: boolean }): Promise<ResearchResponse> {
    const fallbackOnError = options?.fallbackOnError ?? false;

    // 1. Check cache
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTTLMs) {
      return cached.response;
    }

    // 2. Validate environment credentials
    if (!this.isConfigured()) {
      if (fallbackOnError) {
        console.warn('[GeminiResearchEngine] GEMINI_API_KEY unconfigured; utilizing deterministic evidence fallback.');
        const fallback = this.generateDeterministicFallback(request, 'Gemini API unconfigured. Synthesizing directly from verified evidence repository.');
        this.cache.set(cacheKey, { response: fallback, timestamp: now });
        return fallback;
      }
      throw new Error(
        'Gemini Research Engine requires a configured GEMINI_API_KEY on the server. Please verify your environment settings.'
      );
    }

    const client = this.getClient();
    const userPrompt = buildUserPrompt(request);

    try {
      // Call Gemini using the official @google/genai SDK
      const apiResponse = await client.models.generateContent({
        model: this.modelName,
        contents: userPrompt,
        config: {
          systemInstruction: RESEARCH_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temperature for high deterministic analytical consistency
          maxOutputTokens: 3000
        }
      });

      const responseText = apiResponse.text;
      if (!responseText || !responseText.trim()) {
        throw new Error('Gemini Research Engine returned an empty response.');
      }

      // Parse and normalize JSON
      const parsed = this.parseAndValidateResponse(responseText, request);

      // Store in cache
      this.cache.set(cacheKey, {
        response: parsed,
        timestamp: now
      });

      return parsed;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[GeminiResearchEngine] Generation error:', errMsg);
      let userFriendlyMsg = errMsg;
      if (errMsg.includes('prepayment credits') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        userFriendlyMsg = 'Gemini API prepayment credits or quota are depleted (HTTP 429). Please verify project billing and credits in Google AI Studio settings.';
      }

      if (fallbackOnError) {
        console.warn(`[GeminiResearchEngine] Activating deterministic evidence fallback due to: ${userFriendlyMsg}`);
        const fallback = this.generateDeterministicFallback(request, userFriendlyMsg);
        this.cache.set(cacheKey, { response: fallback, timestamp: now });
        return fallback;
      }

      throw new Error(`Research Engine Error: ${userFriendlyMsg}`);
    }
  }

  /**
   * Deterministic evidence synthesis fallback
   * Operates purely on verified repository evidence without LLM generation or hallucination.
   */
  public generateDeterministicFallback(request: ResearchRequest, fallbackReason?: string): ResearchResponse {
    const symbolStr = request.securities.map(s => s.symbol).join(', ') || 'Target Security';
    const evidenceList = request.availableEvidence || [];

    const realItems = evidenceList.filter(e => e.epistemicStatus === 'REAL');
    const calculatedItems = evidenceList.filter(e => e.epistemicStatus === 'CALCULATED');
    const simulatedItems = evidenceList.filter(e => e.epistemicStatus === 'SIMULATED');

    const evidenceReferences: ResearchEvidenceReference[] = evidenceList.map(ev => ({
      id: ev.id,
      sourceType: ev.sourceType,
      provider: ev.provider,
      epistemicStatus: ev.epistemicStatus,
      description: ev.description,
      filingDate: ev.filingDate,
      accessionNumber: ev.accessionNumber
    }));

    const factPoints = realItems.map(item => ({
      text: `[${item.sourceType} - ${item.provider}] ${item.description}`,
      classification: 'FACT' as ResearchEpistemicClassification,
      evidenceIds: [item.id]
    }));

    const calculatedPoints = calculatedItems.map(item => ({
      text: `[Derived Indicator - ${item.provider}] ${item.description}`,
      classification: 'INFERENCE' as ResearchEpistemicClassification,
      evidenceIds: [item.id]
    }));

    const simulatedPoints = simulatedItems.map(item => ({
      text: `[Simulated Market Feed - ${item.provider}] ${item.description} (Warning: Synthetic data, not verified real market execution).`,
      classification: 'SIMULATED' as ResearchEpistemicClassification,
      evidenceIds: [item.id]
    }));

    const sections: ResearchSection[] = [];

    if (factPoints.length > 0) {
      sections.push({
        heading: 'Verified Disclosures & Market Facts',
        points: factPoints
      });
    }

    if (calculatedPoints.length > 0) {
      sections.push({
        heading: 'Calculated Indicators & Quantitative Profile',
        points: calculatedPoints
      });
    }

    if (simulatedPoints.length > 0) {
      sections.push({
        heading: 'Simulated Market Observations',
        points: simulatedPoints
      });
    }

    if (sections.length === 0) {
      sections.push({
        heading: 'Evidence Status',
        points: [
          {
            text: 'No verified filings or market records currently available in repository for this security.',
            classification: 'UNAVAILABLE' as ResearchEpistemicClassification,
            evidenceIds: []
          }
        ]
      });
    }

    // Preserved conflicts section
    if (request.conflicts && request.conflicts.length > 0) {
      sections.push({
        heading: 'Preserved Provider Conflicts',
        points: request.conflicts.map(c => ({
          text: `Conflict between ${c.provider1} and ${c.provider2}: ${c.details}. Both viewpoints preserved without artificial reconciliation.`,
          classification: 'UNCERTAINTY' as ResearchEpistemicClassification,
          evidenceIds: [c.evidenceId1, c.evidenceId2]
        }))
      });
    }

    const confidence = evidenceList.length === 0 ? 0.2 : realItems.length > 0 ? 0.85 : 0.55;

    return {
      title: `Deterministic Research Summary: ${symbolStr} (${request.requestedAnalysisType})`,
      executiveSummary: `Synthesis assembled from ${evidenceList.length} verified evidence items (${realItems.length} Real, ${calculatedItems.length} Calculated, ${simulatedItems.length} Simulated). ${fallbackReason ? `Engine note: ${fallbackReason}` : ''}`.trim(),
      conclusion: realItems.length > 0
        ? `Research conclusion grounded in ${realItems.length} verified primary source filings/records.`
        : 'Sufficient primary evidence is pending; observations rely on calculated or simulated state.',
      analysisType: request.requestedAnalysisType,
      sections,
      keyRisks: [
        'Macroeconomic and interest rate sensitivity.',
        'Competitive disruption and margin compression.',
        evidenceList.some(e => e.isSimulated) ? 'Partial reliance on synthetic/simulated pricing data.' : 'Regulatory and filing disclosure lags.'
      ],
      keyUnknowns: [
        'Long-term capital allocation efficacy beyond published filing periods.',
        request.asOfDate ? `Future market and operating developments beyond ${request.asOfDate}.` : 'Next quarter financial trajectory prior to official SEC release.'
      ],
      evidenceReferences,
      confidence,
      generatedAt: new Date().toISOString(),
      engineVersion: 'Deterministic Evidence Engine (Gemini Fallback)',
      securities: request.securities,
      retrievalMetadata: request.retrievalMetadata
    };
  }

  /**
   * Sanitizes and parses structured JSON output from Gemini, with fallback validation
   */
  public parseAndValidateResponse(rawText: string, request: ResearchRequest): ResearchResponse {
    let cleaned = rawText.trim();

    // Strip markdown code fences if present (e.g. ```json ... ```)
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // If parsing fails, attempt regex recovery of core fields
      console.warn('[GeminiResearchEngine] Failed to parse raw JSON directly, attempting recovery.');
      parsed = this.recoverMalformedOutput(cleaned, request);
    }

    // Normalize and validate sections
    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const validSections: ResearchSection[] = rawSections.map((sec: any) => {
      const heading = typeof sec.heading === 'string' ? sec.heading : 'Analysis Section';
      const points = Array.isArray(sec.points) ? sec.points.map((pt: any) => {
        const text = typeof pt.text === 'string' ? pt.text : String(pt);
        const validClasses: ResearchEpistemicClassification[] = ['FACT', 'INFERENCE', 'UNCERTAINTY', 'SIMULATED', 'UNAVAILABLE'];
        const classification = validClasses.includes(pt.classification) ? pt.classification : 'INFERENCE';
        const evidenceIds = Array.isArray(pt.evidenceIds) ? pt.evidenceIds.filter((id: any) => typeof id === 'string') : [];
        return { text, classification, evidenceIds };
      }) : [];
      return { heading, points };
    });

    // Map evidence references from supplied request evidence
    const evidenceReferences: ResearchEvidenceReference[] = request.availableEvidence.map(ev => ({
      id: ev.id,
      sourceType: ev.sourceType,
      provider: ev.provider,
      epistemicStatus: ev.epistemicStatus,
      description: ev.description,
      filingDate: ev.filingDate,
      accessionNumber: ev.accessionNumber
    }));

    const response: ResearchResponse = {
      title: typeof parsed.title === 'string' ? parsed.title : `Research Synthesis: ${request.query}`,
      executiveSummary: typeof parsed.executiveSummary === 'string'
        ? parsed.executiveSummary
        : 'Synthesized research analysis based strictly on available application evidence.',
      conclusion: typeof parsed.conclusion === 'string'
        ? parsed.conclusion
        : 'Analysis completed under deterministic epistemic constraints.',
      analysisType: request.requestedAnalysisType,
      sections: validSections.length > 0 ? validSections : [
        {
          heading: 'Evidence Synthesis',
          points: [
            {
              text: 'Analysis synthesized from verified application data sources.',
              classification: 'INFERENCE',
              evidenceIds: request.availableEvidence.map(e => e.id)
            }
          ]
        }
      ],
      keyRisks: Array.isArray(parsed.keyRisks)
        ? parsed.keyRisks.filter((r: any) => typeof r === 'string')
        : ['Evidence limitations and market volatility risks.'],
      keyUnknowns: Array.isArray(parsed.keyUnknowns)
        ? parsed.keyUnknowns.filter((u: any) => typeof u === 'string')
        : ['Data not available in the supplied evidence.'],
      evidenceReferences,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.85,
      generatedAt: new Date().toISOString(),
      engineVersion: this.engineVersion,
      securities: request.securities,
      retrievalMetadata: request.retrievalMetadata
    };

    return response;
  }

  private recoverMalformedOutput(text: string, request: ResearchRequest): any {
    return {
      title: `Analysis: ${request.query}`,
      executiveSummary: text.slice(0, 300) + '...',
      conclusion: 'See detailed sections above.',
      sections: [
        {
          heading: 'Analysis Points',
          points: [
            {
              text: text.slice(0, 500),
              classification: 'INFERENCE',
              evidenceIds: request.availableEvidence.map(e => e.id)
            }
          ]
        }
      ],
      keyRisks: ['Output formatting uncertainty.'],
      keyUnknowns: ['Unstructured model response.'],
      confidence: 0.5
    };
  }
}

export const geminiResearchEngine = new GeminiResearchEngine();
