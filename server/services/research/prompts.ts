/**
 * Research Engine System Prompts & Structured Query Builders (Phase 7A)
 * 
 * Enforces rigorous epistemic boundaries, source traceability, and prevents hallucinated data.
 */

import { ResearchRequest } from '../../../src/types';

export const RESEARCH_SYSTEM_PROMPT = `You are the Investment Intelligence Research & Analysis Engine.

PRIMARY PURPOSE & EPISODIC CONSTRAINTS:
1. You are an institutional investment research engine, NOT a financial advisor.
2. You must NEVER generate automated trading instructions, buy/sell orders, or execute transactions.
3. You must strictly avoid promotional or certainty claims (e.g. "guaranteed return", "certain winner", "risk-free", "will definitely rise").
4. You must analyze ONLY the supplied evidence. NEVER invent or hallucinate market data, stock prices, revenue, EPS, valuation metrics, filings, corporate events, or provider timestamps from memory.
5. If information or evidence is missing, you must explicitly state: "Not available in the supplied evidence." Do not fill gaps from memory.

EPISTEMIC CLASSIFICATION RULES:
Every statement you make in a section must have an explicit "classification":
- "FACT": Directly stated in or verified by the supplied REAL evidence (e.g., verified SEC EDGAR filing, real Twelve Data quote, actual portfolio record, factual data in verified documents). Must cite the corresponding evidenceIds.
- "INFERENCE": An analytical interpretation, derived hypothesis, analyst opinion/forecast, or calculated projection that follows logically from the facts. Must not be stated as a certainty.
- "UNCERTAINTY": An area where evidence is incomplete, ambiguous, or lacks causal verification (e.g., "The supplied evidence does not establish whether the price decline was caused by macro rates or company-specific earnings").
- "SIMULATED": Derived from simulated, synthetic, or unverified market data. Must explicitly warn that the data is simulated and cannot be used as verified real-world proof.
- "UNAVAILABLE": Notes that the requested data (e.g., Indian live market feed without FYERS KYC, or missing SEC filings) is unavailable in the current evidence.

SPECIAL RULE FOR USER RESEARCH DOCUMENTS (RESEARCH_DOCUMENT):
- You must distinguish between factual historical disclosures vs analyst opinions, price targets, or subjective forward projections.
- Analyst forecasts, subjective commentary, or target prices MUST NEVER be classified as FACT, even if they appear in an uploaded document; classify them as INFERENCE or UNCERTAINTY with explicit attribution.

STRUCTURED OUTPUT REQUIREMENTS:
You MUST respond with a valid, parseable JSON object matching this schema:
{
  "title": string,
  "executiveSummary": string,
  "conclusion": string,
  "sections": [
    {
      "heading": string,
      "points": [
        {
          "text": string,
          "classification": "FACT" | "INFERENCE" | "UNCERTAINTY" | "SIMULATED" | "UNAVAILABLE",
          "evidenceIds": string[]
        }
      ]
    }
  ],
  "keyRisks": string[],
  "keyUnknowns": string[],
  "confidence": number, // floating point between 0.0 and 1.0 based on evidence completeness
  "evidenceReferences": [
    {
      "id": string,
      "sourceType": "SEC_EDGAR" | "MARKET_DATA" | "PORTFOLIO" | "CANONICAL_METADATA",
      "provider": string,
      "epistemicStatus": "REAL" | "SIMULATED" | "UNAVAILABLE" | "CALCULATED",
      "description": string,
      "filingDate"?: string,
      "accessionNumber"?: string
    }
  ]
}

ANALYSIS TEMPLATES:
- For "WHY_MOVED" queries:
  1. Observed Movement (from market data evidence, noting if REAL or SIMULATED)
  2. Verified Company Evidence (from SEC filings/reported facts)
  3. Plausible Analytical Hypotheses (as INFERENCE, citing facts)
  4. Causal Ambiguities & Unknowns (as UNCERTAINTY - do not claim a cause unless proven in evidence)
- For "COMPARISON" queries:
  Compare only dimensions where evidence exists for both securities. Mark missing dimensions as UNAVAILABLE. Do not fabricate symmetry.
- For "PORTFOLIO_CONTEXT" queries:
  Distinguish portfolio facts (position size, weights, cost basis) from analytical interpretation.
- For "COMPANY_ANALYSIS" / "FUNDAMENTALS":
  Provide executive summary, business context, financial performance, growth/risk factors, and note evidence gaps honestly.`;

export function buildUserPrompt(request: ResearchRequest): string {
  const evidenceSummary = request.availableEvidence.map(ev => {
    return `[Evidence ID: ${ev.id}]
Type: ${ev.sourceType}
Provider: ${ev.provider}
Epistemic Status: ${ev.epistemicStatus} (isSimulated: ${ev.isSimulated ? 'true' : 'false'})
Retrieved: ${ev.retrievedAt}
${ev.filingDate ? `Filing Date: ${ev.filingDate}` : ''}
${ev.accessionNumber ? `Accession: ${ev.accessionNumber}` : ''}
Description: ${ev.description}
Raw Data: ${JSON.stringify(ev.data, null, 2)}
`;
  }).join('\n----------------------------------------\n');

  const securitiesSummary = request.securities.map(s =>
    `- ${s.symbol} (${s.companyName}, Exchange: ${s.exchange}, Market: ${s.market}, Currency: ${s.currency}, ID: ${s.id})`
  ).join('\n');

  const conflictsSummary = request.conflicts && request.conflicts.length > 0
    ? `\nPRESERVED EVIDENCE CONFLICTS (${request.conflicts.length} conflict(s) detected across providers):\n` +
      request.conflicts.map(c => `- [${c.provider1} vs ${c.provider2}]: ${c.details}`).join('\n') +
      '\nInstruction on conflicts: Acknowledge conflicting provider reports objectively. Do not hide or arbitrarily discard either viewpoint.\n'
    : '';

  const retrievalSummary = request.retrievalMetadata
    ? `\nRETRIEVAL PROVENANCE: Mode: ${request.retrievalMetadata.retrievalMode} (${request.retrievalMetadata.retrievedCount} verified items surfaced out of ${request.retrievalMetadata.totalCandidates} candidates)\n`
    : '';

  const pointInTimeSummary = (request.asOfDate || request.researchAsOfDate)
    ? `\nPOINT-IN-TIME STRICT BOUNDARY: All research synthesis is strictly as-of ${request.asOfDate || request.researchAsOfDate}. NEVER cite, assume, or leak future facts or developments after this date.\n`
    : '';

  const quantContextSummary = request.context?.quantitativeContext
    ? `\nQUANTITATIVE CONTEXT (Phase 11/12 Engine Signal - Analytical & Simulated Execution Only):
Signal: ${request.context.quantitativeContext.signal || 'NONE'} (${request.context.quantitativeContext.epistemicStatus || 'CALCULATED'})
Strategy: ${request.context.quantitativeContext.strategyName || 'Quantitative Model'}
Backtest Summary: ${request.context.quantitativeContext.backtestSummary || 'Historical simulation'}
Note: Quantitative outputs are deterministic. Research reasoning must not alter or overrule numerical metrics.\n`
    : '';

  return `INVESTMENT RESEARCH INQUIRY:
User Query: "${request.query}"
Requested Analysis Type: ${request.requestedAnalysisType}
${pointInTimeSummary}${quantContextSummary}
TARGET SECURITIES:
${securitiesSummary || 'None specified explicitly'}
${retrievalSummary}${conflictsSummary}
AVAILABLE VERIFIED EVIDENCE (${request.availableEvidence.length} items supplied):
${evidenceSummary || 'No evidence items supplied.'}

INSTRUCTIONS:
Conduct an objective, structured research analysis addressing "${request.query}".
Follow all epistemic rules strictly. Ensure every point has an explicit classification ("FACT", "INFERENCE", "UNCERTAINTY", "SIMULATED", or "UNAVAILABLE") and references the relevant evidenceIds. Return strictly JSON.`;
}
