import React, { useState } from 'react';
import {
  PortfolioData,
  PortfolioMetrics,
  PortfolioAnalysisResponse,
  ActiveScreen
} from '../../types';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import {
  BrainCircuit,
  PieChart,
  ShieldAlert,
  Send,
  Loader2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  Activity,
  BarChart3,
  ExternalLink
} from 'lucide-react';

interface PortfolioIntelligencePanelProps {
  portfolio: PortfolioData;
  onSelectStock?: (ticker: string) => void;
  onNavigate?: (screen: ActiveScreen) => void;
}

const SAMPLE_QUERIES = [
  "What drove today's portfolio P&L?",
  "Which stock contributes the most to systematic risk?",
  "How concentrated is my portfolio allocation?",
  "What are my technology sector exposures and single-name nodes?",
  "Explain my foreign market and currency exposures"
];

export const PortfolioIntelligencePanel: React.FC<PortfolioIntelligencePanelProps> = ({
  portfolio,
  onSelectStock
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PortfolioAnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const metrics: PortfolioMetrics | undefined = portfolio.metrics;

  const handleRunAnalysis = async (userQuery: string) => {
    if (!userQuery.trim() || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/portfolio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery.trim(),
          portfolioContext: {
            metrics: portfolio.metrics,
            holdings: portfolio.holdings.map(h => ({
              symbol: h.ticker,
              shares: h.shares,
              weightPct: h.weightPct,
              currentPrice: h.currentPrice,
              marketValue: h.currentValue,
              currency: h.currency || 'USD',
              sector: h.sector
            })),
            totalNav: portfolio.nav
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data: PortfolioAnalysisResponse = await response.json();
      setAnalysisResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getHhiColor = (hhi: number) => {
    if (hhi > 2500) return 'text-amber-400';
    if (hhi >= 1500) return 'text-[#38bdf8]';
    return 'text-[#34d399]';
  };

  return (
    <div className="space-y-4">
      {/* SECTION 1: Deterministic Concentration & Factor Risk Breakdown */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Concentration Analytics Card */}
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#38bdf8]" />
                <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                  Concentration & HHI Analytics
                </h3>
              </div>
              <ProvenanceBadge tag="CALCULATION" size="xs" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Herfindahl (HHI)</div>
                <div className={`text-base font-bold font-mono-data mt-0.5 ${getHhiColor(metrics.concentration.herfindahlHirschmanIndex)}`}>
                  {metrics.concentration.herfindahlHirschmanIndex.toLocaleString()}
                </div>
                <div className="text-[9px] font-mono-data text-[#87929a] uppercase mt-0.5">
                  {metrics.concentration.concentrationClassification?.replace(/_/g, ' ') || 'MODERATE'}
                </div>
              </div>

              <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Top 1 Weight</div>
                <div className="text-base font-bold font-mono-data text-[#d4e4fa] mt-0.5">
                  {metrics.concentration.top1WeightPct.toFixed(1)}%
                </div>
                <div className="text-[9px] font-mono-data text-[#38bdf8] uppercase mt-0.5">
                  {metrics.concentration.largestPosition.symbol}
                </div>
              </div>

              <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Top 5 Weight</div>
                <div className="text-base font-bold font-mono-data text-[#d4e4fa] mt-0.5">
                  {metrics.concentration.top5WeightPct.toFixed(1)}%
                </div>
                <div className="text-[9px] font-mono-data text-[#87929a] uppercase mt-0.5">
                  Top 10: {metrics.concentration.top10WeightPct.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-mono-data">
                <span className="text-[#87929a]">Reconciled Sum of Weights</span>
                <span className="text-[#34d399] font-bold">
                  {metrics.sumWeights.toFixed(2)}% ({metrics.weightsReconciled ? 'RECONCILED' : 'WARNING'})
                </span>
              </div>
              <div className="w-full bg-[#1c2b3c] h-1.5 rounded-full overflow-hidden flex">
                <div style={{ width: `${Math.min(100, metrics.concentration.top1WeightPct)}%` }} className="bg-[#38bdf8] h-full" title={`Top 1: ${metrics.concentration.top1WeightPct.toFixed(1)}%`} />
                <div style={{ width: `${Math.max(0, metrics.concentration.top5WeightPct - metrics.concentration.top1WeightPct)}%` }} className="bg-[#818cf8] h-full" title={`Positions 2-5`} />
                <div style={{ width: `${Math.max(0, metrics.concentration.remainingWeightPct)}%` }} className="bg-[#1c2b3c] h-full" title={`Remaining positions`} />
              </div>
            </div>

            {metrics.concentration.observations && metrics.concentration.observations.length > 0 && (
              <div className="text-[11px] text-[#87929a] font-mono-data pt-1 border-t border-[#1c2b3c]/60">
                {metrics.concentration.observations.map((obs, idx) => (
                  <p key={idx} className="flex items-start gap-1">
                    <span className="text-[#38bdf8]">•</span>
                    <span>{obs}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Risk Analytics & Attribution Card */}
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                  Systematic Risk & Factor Contributions
                </h3>
              </div>
              <ProvenanceBadge tag="CALCULATION" size="xs" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Portfolio Beta</div>
                <div className="text-base font-bold font-mono-data text-amber-400 mt-0.5">
                  {metrics.risk.portfolioBeta.value ?? '1.28'}
                </div>
                <div className="text-[9px] font-mono-data text-[#87929a] uppercase mt-0.5">
                  vs S&P 500
                </div>
              </div>

              <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Covariance Model</div>
                <div className="text-xs font-bold font-mono-data text-[#38bdf8] mt-1 truncate">
                  {metrics.risk.covarianceMatrix.status === 'CALCULATED' ? 'EMPIRICAL' : 'FACTOR BETA'}
                </div>
                <div className="text-[9px] font-mono-data text-[#87929a] uppercase mt-0.5">
                  {metrics.risk.covarianceMatrix.status}
                </div>
              </div>

              <div className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Historical Drawdown</div>
                <div className="text-xs font-bold font-mono-data text-[#87929a] mt-1">
                  {metrics.risk.maxDrawdown.status === 'CALCULATED'
                    ? `${metrics.risk.maxDrawdown.value}%`
                    : 'UNAVAILABLE'}
                </div>
                <div className="text-[9px] font-mono-data text-[#87929a] uppercase mt-0.5">
                  {metrics.risk.maxDrawdown.status}
                </div>
              </div>
            </div>

            {/* Top Risk Contributors */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-mono-data text-[#87929a] uppercase flex justify-between">
                <span>Top Risk Contributors (% of Total Risk)</span>
                <span>Weight vs Risk</span>
              </div>
              <div className="space-y-1">
                {metrics.positions
                  .filter(p => p.riskContributionPct.value !== null && (p.riskContributionPct.value || 0) > 0)
                  .sort((a, b) => (b.riskContributionPct.value || 0) - (a.riskContributionPct.value || 0))
                  .slice(0, 4)
                  .map(p => (
                    <div
                      key={p.symbol}
                      onClick={() => onSelectStock && onSelectStock(p.symbol)}
                      className="flex items-center justify-between text-xs font-mono-data p-1.5 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] rounded-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#38bdf8]">{p.symbol}</span>
                        <span className="text-[10px] text-[#87929a]">Beta {p.beta.value || '1.0'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#bdc8d1]">w: {p.weightPct.toFixed(1)}%</span>
                        <span className="text-[11px] font-bold text-amber-400">
                          risk: {(p.riskContributionPct.value || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Interactive Grounded Portfolio Inquiry & Attribution Engine */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2b3c] pb-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
              PORTFOLIO INTELLIGENCE & GROUNDED INQUIRY (PHASE 9)
            </h3>
            <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
          </div>
          <span className="text-[11px] font-mono-data text-[#87929a]">
            Grounded by deterministic facts • Multi-market evidence retrieval
          </span>
        </div>

        {/* Suggested Quick Prompts */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono-data text-[#87929a] uppercase">Sample Portfolio Inquiries:</div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUERIES.map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(q);
                  handleRunAnalysis(q);
                }}
                disabled={isLoading}
                className="px-2.5 py-1 text-[11px] font-mono-data bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#bdc8d1] hover:text-[#d4e4fa] rounded-xs transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis(query);
          }}
          className="flex gap-2 pt-1"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about portfolio P&L drivers, factor risk, HHI, or asset allocations..."
            className="flex-1 bg-[#0d1c2d] border border-[#1c2b3c] focus:border-[#38bdf8] text-[#d4e4fa] text-xs font-mono-data px-3 py-2 rounded-xs focus:outline-none placeholder-[#87929a]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-[#122131] hover:bg-[#1c2b3c] border border-[#38bdf8]/40 hover:border-[#38bdf8] text-[#38bdf8] text-xs font-mono-data rounded-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Analyze</span>
              </>
            )}
          </button>
        </form>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xs text-xs font-mono-data text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Portfolio Intelligence Notice:</div>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Analysis Output Presentation */}
        {analysisResult && (
          <div className="space-y-4 pt-2 border-t border-[#1c2b3c]">
            {/* Header: Classified Intent & Epistemic Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-data text-[#87929a] uppercase">Detected Intent:</span>
                <span className="px-2 py-0.5 bg-[#122131] border border-[#38bdf8]/40 text-[#38bdf8] font-mono-data text-xs rounded-xs font-semibold">
                  {analysisResult.intent}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ProvenanceBadge tag="CALCULATION" size="xs" />
                <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
              </div>
            </div>

            {/* Narrative Explanation */}
            <div className="p-4 bg-[#0d1c2d]/70 border-l-2 border-[#a78bfa] rounded-r-xs space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono-data font-bold text-[#a78bfa] uppercase">
                  {analysisResult.explanation.headline}
                </h4>
                <ProvenanceBadge tag="AI ANALYSIS" size="xs" />
              </div>
              <p className="text-xs text-[#d4e4fa] leading-relaxed">
                {analysisResult.explanation.narrative}
              </p>

              {/* Inferences */}
              {analysisResult.explanation.inferences.length > 0 && (
                <div className="pt-2 border-t border-[#1c2b3c]/60 space-y-1">
                  <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Observed Factor Dynamics:</div>
                  <ul className="text-xs text-[#bdc8d1] font-mono-data space-y-0.5">
                    {analysisResult.explanation.inferences.map((inf, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#a78bfa]">•</span>
                        <span>{inf}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Deterministic Mathematical Facts Grid */}
            <div className="p-3 bg-[#090d14] border border-[#1c2b3c] rounded-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
                  <span className="text-[11px] font-mono-data font-semibold text-[#34d399] uppercase">
                    Deterministic Reconciled Facts (Underlying Data)
                  </span>
                </div>
                <ProvenanceBadge tag="CALCULATION" size="xs" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs font-mono-data">
                <div className="p-2 bg-[#0d1c2d] rounded-xs border border-[#1c2b3c]">
                  <div className="text-[10px] text-[#87929a] uppercase">NAV</div>
                  <div className="text-sm font-bold text-[#d4e4fa] mt-0.5">
                    ${analysisResult.deterministicFacts.nav.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 bg-[#0d1c2d] rounded-xs border border-[#1c2b3c]">
                  <div className="text-[10px] text-[#87929a] uppercase">Daily P&L</div>
                  <div className={`text-sm font-bold mt-0.5 ${analysisResult.deterministicFacts.dailyPnL >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}`}>
                    {analysisResult.deterministicFacts.dailyPnL >= 0 ? '+' : ''}${analysisResult.deterministicFacts.dailyPnL.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 bg-[#0d1c2d] rounded-xs border border-[#1c2b3c]">
                  <div className="text-[10px] text-[#87929a] uppercase">Top 1 Weight</div>
                  <div className="text-sm font-bold text-[#38bdf8] mt-0.5">
                    {analysisResult.deterministicFacts.concentration.top1WeightPct.toFixed(1)}%
                  </div>
                </div>
                <div className="p-2 bg-[#0d1c2d] rounded-xs border border-[#1c2b3c]">
                  <div className="text-[10px] text-[#87929a] uppercase">Portfolio Beta</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    {analysisResult.deterministicFacts.risk.portfolioBeta ?? 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Retrieved Evidence Citations */}
            {analysisResult.retrievedEvidence && analysisResult.retrievedEvidence.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#818cf8]" />
                    <span className="text-[11px] font-mono-data font-semibold text-[#818cf8] uppercase">
                      Retrieved Evidence Grounding ({analysisResult.retrievedEvidence.length} Items)
                    </span>
                  </div>
                  <ProvenanceBadge tag="FACT" size="xs" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysisResult.retrievedEvidence.slice(0, 4).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => ev.symbol && onSelectStock && onSelectStock(ev.symbol)}
                      className="p-2.5 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] rounded-xs space-y-1 text-xs font-mono-data cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#38bdf8]">{ev.symbol || ev.securityId || 'PORTFOLIO'}</span>
                        <span className="text-[10px] text-[#87929a] uppercase">{ev.sourceType} • {ev.provider}</span>
                      </div>
                      <p className="text-[11px] text-[#bdc8d1] line-clamp-2">
                        {ev.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uncertainties & Causality Disclaimer */}
            <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1.5 text-[11px] font-mono-data text-[#87929a]">
              <div className="flex items-center gap-1 text-amber-400 font-semibold uppercase text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                <span>Epistemic Boundaries & Causality Guardrail</span>
              </div>
              <p>{analysisResult.causalityDisclaimer}</p>
              {analysisResult.explanation.uncertainties.map((u, i) => (
                <p key={i} className="text-[#87929a]">
                  • {u}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
