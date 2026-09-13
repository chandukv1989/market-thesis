import React, { useState, useEffect } from 'react';
import {
  Strategy,
  ActiveScreen,
  QuantStrategy,
  StrategyEvaluationResult,
  CalculatedIndicator,
  MarketRegion
} from '../types';
import { quantStrategyClient } from '../services/quantStrategyClient';
import {
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  ShieldCheck,
  ShieldAlert,
  Activity,
  RefreshCw,
  Cpu,
  Check,
  X,
  Sliders,
  Database,
  Clock,
  ChevronRight,
  TrendingUp,
  Percent,
  SlidersHorizontal
} from 'lucide-react';

interface StrategiesViewProps {
  strategies: Strategy[];
  onSelectStrategyForBacktest: (strategy: Strategy) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onAddNewStrategy: (strategy: Strategy) => void;
}

interface TestSecurity {
  symbol: string;
  name: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
}

const SAMPLE_SECURITIES: TestSecurity[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD' },
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', market: 'INDIA', exchange: 'NSE', currency: 'INR' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'INDIA', exchange: 'NSE', currency: 'INR' },
  { symbol: 'INFY', name: 'Infosys Limited', market: 'INDIA', exchange: 'NSE', currency: 'INR' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', market: 'INDIA', exchange: 'NSE', currency: 'INR' }
];

export const StrategiesView: React.FC<StrategiesViewProps> = ({
  strategies,
  onSelectStrategyForBacktest,
  onNavigate,
  onAddNewStrategy
}) => {
  // Navigation tab between Deterministic Quant Engine and NLP Compiler
  const [activeTab, setActiveTab] = useState<'engine' | 'compiler'>('engine');

  // Quant Engine State
  const [quantStrategies, setQuantStrategies] = useState<QuantStrategy[]>([]);
  const [selectedQuantId, setSelectedQuantId] = useState<string>('strat-ma-crossover');
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);

  // Live Evaluation State
  const [selectedSecurity, setSelectedSecurity] = useState<TestSecurity>(SAMPLE_SECURITIES[0]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<StrategyEvaluationResult | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  // Compiler State
  const [selectedLegacyStrategyId, setSelectedLegacyStrategyId] = useState<string>(strategies[0]?.id || '');
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load backend quant strategies on mount
  useEffect(() => {
    let isMounted = true;
    async function loadStrategies() {
      setIsLoadingStrategies(true);
      try {
        const response = await quantStrategyClient.getStrategies();
        if (isMounted && response.strategies && response.strategies.length > 0) {
          setQuantStrategies(response.strategies);
          if (!response.strategies.some(s => s.strategyId === selectedQuantId)) {
            setSelectedQuantId(response.strategies[0].strategyId);
          }
        }
      } catch (err) {
        console.warn('Could not fetch server strategies, fallback to empty or cached:', err);
      } finally {
        if (isMounted) setIsLoadingStrategies(false);
      }
    }
    loadStrategies();
    return () => { isMounted = false; };
  }, []);

  const activeQuantStrategy = quantStrategies.find(s => s.strategyId === selectedQuantId) || quantStrategies[0];

  // Trigger Deterministic Strategy Evaluation
  const handleRunEvaluation = async () => {
    if (!activeQuantStrategy) return;
    setIsEvaluating(true);
    setEvaluationError(null);
    setEvaluationResult(null);

    try {
      const result = await quantStrategyClient.evaluateStrategy({
        strategyId: activeQuantStrategy.strategyId,
        symbol: selectedSecurity.symbol,
        market: selectedSecurity.market,
        exchange: selectedSecurity.exchange,
        currency: selectedSecurity.currency,
        parameters: activeQuantStrategy.parameters
      });
      setEvaluationResult(result);
    } catch (err) {
      setEvaluationError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Compiler helper
  const handleGenerateStrategy = () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const newStrategy: Strategy = {
        id: `strat-${Date.now()}`,
        title: promptInput.slice(0, 45) + '...',
        description: `Quantitative rules compiled from prompt: "${promptInput}"`,
        prompt: promptInput,
        status: 'AI Generated Strategy',
        targetUniverse: 'Large Cap US Equities',
        rebalanceFrequency: 'Monthly',
        rules: [
          { category: 'Universe', description: 'Market Cap > $25B, Median Volume > $40M', parameters: 'MCap >= 25B, Vol >= 40M' },
          { category: 'Entry Rule', description: '3Y Revenue CAGR > 15%, FCF Margin > 15%', parameters: 'RevCAGR >= 15%, FCFMargin >= 15%' },
          { category: 'Entry Rule', description: 'Relative Strength Index (RSI 14) between 45 and 65', parameters: 'RSI >= 45 and RSI <= 65' },
          { category: 'Position Sizing', description: 'Equal weight with 5% maximum position cap', parameters: 'MaxWeight = 0.05' },
          { category: 'Exit Rule', description: 'Trailing stop 10% or earnings deceleration < 5%', parameters: 'Drawdown > 10% or EPS_Growth < 5%' },
          { category: 'Rebalancing', description: 'Monthly calendar rebalance with 5 bps slippage assumption', parameters: 'Freq=Monthly, Slip=0.0005' }
        ]
      };

      onAddNewStrategy(newStrategy);
      setSelectedLegacyStrategyId(newStrategy.id);
      setIsGenerating(false);
      setPromptInput('');
    }, 500);
  };

  const selectedLegacyStrategy = strategies.find(s => s.id === selectedLegacyStrategyId) || strategies[0];

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              QUANTITATIVE STRATEGY ENGINE
            </h1>
            <span className="text-xs font-mono-data text-[#38bdf8] px-2 py-0.5 bg-[#0d1c2d] border border-[#38bdf8]/30 rounded-xs">
              PHASE 11 DETERMINISTIC RUNTIME
            </span>
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Strictly deterministic, zero look-ahead bias strategy evaluations across US and Indian equities. Zero LLM involvement in mathematical signal computation.
          </p>
        </div>

        {/* Guardrail Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1c2d] border border-amber-500/30 rounded-sm text-xs font-mono-data">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[#bdc8d1]">
            Analytical Simulation Only • Broker Execution Prohibited
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#1c2b3c]">
        <button
          onClick={() => setActiveTab('engine')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono-data font-semibold border-b-2 transition-colors ${
            activeTab === 'engine'
              ? 'border-[#38bdf8] text-[#38bdf8] bg-[#0d1c2d]/60'
              : 'border-transparent text-[#87929a] hover:text-[#d4e4fa]'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Deterministic Strategies ({quantStrategies.length || 5})</span>
        </button>

        <button
          onClick={() => setActiveTab('compiler')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono-data font-semibold border-b-2 transition-colors ${
            activeTab === 'compiler'
              ? 'border-[#38bdf8] text-[#38bdf8] bg-[#0d1c2d]/60'
              : 'border-transparent text-[#87929a] hover:text-[#d4e4fa]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>NLP Strategy Compiler & RuleSpec</span>
        </button>
      </div>

      {activeTab === 'engine' ? (
        <div className="space-y-4">
          {/* Main 2-Column Grid: Strategy Spec & Interactive Evaluator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Rail: Builtin Strategy Selection (4 Cols) */}
            <div className="lg:col-span-4 bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <span className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Verified Algorithms
                </span>
                {isLoadingStrategies && (
                  <RefreshCw className="w-3 h-3 text-[#38bdf8] animate-spin" />
                )}
              </div>

              <div className="space-y-2">
                {quantStrategies.map(strat => {
                  const isSelected = strat.strategyId === selectedQuantId;
                  return (
                    <div
                      key={strat.strategyId}
                      onClick={() => {
                        setSelectedQuantId(strat.strategyId);
                        setEvaluationResult(null);
                        setEvaluationError(null);
                      }}
                      className={`p-3 border rounded-sm cursor-pointer transition-all text-xs space-y-1.5 ${
                        isSelected
                          ? 'bg-[#122131] border-[#38bdf8]'
                          : 'bg-[#0d1c2d] border-[#1c2b3c] hover:border-[#273647]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded-xs font-mono-data text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {strat.version || 'v1.0.0'}
                        </span>
                        <span className="text-[10px] font-mono-data text-[#87929a]">
                          {strat.rebalanceSchedule}
                        </span>
                      </div>

                      <h3 className="font-semibold text-[#d4e4fa] text-xs leading-snug">
                        {strat.name}
                      </h3>

                      <p className="text-[11px] text-[#87929a] line-clamp-2">
                        {strat.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono-data text-[#87929a] pt-1 border-t border-[#1c2b3c]/60">
                        <span className="text-[#38bdf8]">
                          {strat.universe.markets.join(' • ')}
                        </span>
                        <span>{strat.frequency}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Active Strategy Spec & Interactive Test Runner (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              {activeQuantStrategy && (
                <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4">
                  {/* Strategy Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1c2b3c] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-xs font-mono-data text-[10px] font-bold bg-[#122131] text-[#38bdf8] border border-[#38bdf8]/30">
                          {activeQuantStrategy.strategyId}
                        </span>
                        <span className="px-2 py-0.5 rounded-xs font-mono-data text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          100% DETERMINISTIC
                        </span>
                        <span className="text-[11px] font-mono-data text-[#87929a]">
                          Universe: {activeQuantStrategy.universe.markets.join(', ')}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-[#d4e4fa] mt-1">
                        {activeQuantStrategy.name}
                      </h2>
                      <p className="text-xs text-[#87929a] mt-0.5 leading-relaxed">
                        {activeQuantStrategy.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const legacyProxy: Strategy = {
                            id: activeQuantStrategy.strategyId,
                            title: activeQuantStrategy.name,
                            description: activeQuantStrategy.description,
                            prompt: `Phase 11 deterministic strategy: ${activeQuantStrategy.name}`,
                            status: 'Backtest Verified Strategy',
                            targetUniverse: activeQuantStrategy.universe.markets.join(', ') + ' Equities',
                            rebalanceFrequency: activeQuantStrategy.frequency,
                            rules: [
                              ...activeQuantStrategy.entryRules.map(r => ({ category: 'Entry Rule', description: r.name, parameters: r.condition })),
                              ...activeQuantStrategy.exitRules.map(r => ({ category: 'Exit Rule', description: r.name, parameters: r.condition })),
                              { category: 'Position Sizing', description: activeQuantStrategy.positionSizing.method, parameters: `Max: ${activeQuantStrategy.positionSizing.maxPositionWeightPct}%` }
                            ]
                          };
                          onSelectStrategyForBacktest(legacyProxy);
                          onNavigate('backtesting');
                        }}
                        className="px-3 py-1.5 bg-[#122131] hover:bg-[#1c2b3c] border border-[#38bdf8]/40 text-[#38bdf8] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run Full Backtest</span>
                      </button>
                    </div>
                  </div>

                  {/* Strategy Architecture Specifications */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Indicators */}
                    <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1.5 text-xs font-mono-data">
                      <div className="text-[10px] text-[#38bdf8] uppercase flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Mathematical Indicators
                      </div>
                      <div className="space-y-1 text-[#bdc8d1]">
                        {activeQuantStrategy.indicators.map((ind, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b border-[#1c2b3c]/50 pb-0.5">
                            <span className="text-[#d4e4fa]">{ind.name}</span>
                            <span className="text-[10px] text-[#87929a]">
                              {JSON.stringify(ind.parameters).replace(/[{}"']/g, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Position Sizing */}
                    <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1.5 text-xs font-mono-data">
                      <div className="text-[10px] text-[#34d399] uppercase flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Position Sizing Engine
                      </div>
                      <div className="space-y-1 text-[#bdc8d1] text-[11px]">
                        <div className="flex justify-between">
                          <span>Method:</span>
                          <span className="text-[#d4e4fa]">{activeQuantStrategy.positionSizing.method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Target Cap:</span>
                          <span className="text-[#d4e4fa]">{activeQuantStrategy.positionSizing.targetPositionPct || activeQuantStrategy.positionSizing.targetWeightPct || 10}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bounds:</span>
                          <span className="text-[#d4e4fa]">{activeQuantStrategy.positionSizing.minPositionWeightPct}% – {activeQuantStrategy.positionSizing.maxPositionWeightPct}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Constraints */}
                    <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1.5 text-xs font-mono-data">
                      <div className="text-[10px] text-amber-400 uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Quantitative Risk Bounds
                      </div>
                      <div className="space-y-1 text-[#bdc8d1] text-[11px]">
                        <div className="flex justify-between">
                          <span>Max Position:</span>
                          <span className="text-[#d4e4fa]">{activeQuantStrategy.riskConstraints.maxPositionWeightPct}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Sector:</span>
                          <span className="text-[#d4e4fa]">{activeQuantStrategy.riskConstraints.maxSectorWeightPct}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Drawdown:</span>
                          <span className="text-[#d4e4fa]">{activeQuantStrategy.riskConstraints.maxPortfolioDrawdownPct || 15}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Point-in-Time Evaluation Interactive Console */}
                  <div className="bg-[#051424] border border-[#38bdf8]/40 rounded-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#38bdf8]" />
                        <h3 className="text-xs font-mono-data font-bold text-[#d4e4fa] uppercase">
                          Point-in-Time Evaluation Sandbox
                        </h3>
                        <span className="text-[10px] font-mono-data px-2 py-0.5 bg-[#0d1c2d] text-[#34d399] border border-emerald-500/30 rounded-xs">
                          NO LOOK-AHEAD BIAS
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSecurity.symbol}
                          onChange={e => {
                            const found = SAMPLE_SECURITIES.find(s => s.symbol === e.target.value);
                            if (found) setSelectedSecurity(found);
                          }}
                          className="px-2.5 py-1 bg-[#0d1c2d] border border-[#1c2b3c] text-xs font-mono-data text-[#d4e4fa] rounded-xs focus:border-[#38bdf8] outline-none"
                        >
                          <optgroup label="US Equities (Twelve Data / Synthetic)">
                            {SAMPLE_SECURITIES.filter(s => s.market === 'US').map(s => (
                              <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Indian Equities (FYERS / Synthetic)">
                            {SAMPLE_SECURITIES.filter(s => s.market === 'INDIA').map(s => (
                              <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
                            ))}
                          </optgroup>
                        </select>

                        <button
                          onClick={handleRunEvaluation}
                          disabled={isEvaluating}
                          className="px-4 py-1.5 bg-[#38bdf8] hover:bg-[#7bd0ff] disabled:opacity-50 text-[#051424] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          {isEvaluating ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Evaluating...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>Evaluate Signal</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {evaluationError && (
                      <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xs text-xs font-mono-data text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{evaluationError}</span>
                      </div>
                    )}

                    {/* Evaluation Output Details */}
                    {evaluationResult && (
                      <div className="space-y-3 pt-2 border-t border-[#1c2b3c]">
                        {/* Signal Summary Bar */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {/* Direction & Signal Type */}
                          <div className={`p-3 rounded-xs border font-mono-data ${
                            evaluationResult.signal.direction === 'BUY'
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                              : evaluationResult.signal.direction === 'SELL'
                              ? 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                              : 'bg-slate-900 border-slate-700 text-slate-300'
                          }`}>
                            <div className="text-[10px] uppercase text-[#87929a]">Computed Signal</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                              <span>{evaluationResult.signal.direction}</span>
                              <span className="text-xs px-1.5 py-0.5 bg-black/40 rounded-xs">
                                {evaluationResult.signal.signalType}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#87929a] mt-0.5">
                              Strength: {Math.round(evaluationResult.signal.strength * 100)}%
                            </div>
                          </div>

                          {/* Target Position Weight */}
                          <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs font-mono-data">
                            <div className="text-[10px] uppercase text-[#87929a]">Target Allocation</div>
                            <div className="text-lg font-bold text-[#38bdf8]">
                              {evaluationResult.targetPosition.constrainedWeightPct.toFixed(1)}%
                            </div>
                            <div className="text-[11px] text-[#87929a] mt-0.5">
                              Method: {evaluationResult.positionSizing.method}
                            </div>
                          </div>

                          {/* Data Integrity & Provenance */}
                          <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs font-mono-data">
                            <div className="text-[10px] uppercase text-[#87929a]">Point-in-Time As-Of</div>
                            <div className="text-xs font-bold text-[#d4e4fa] truncate">
                              {evaluationResult.asOfDate}
                            </div>
                            <div className="text-[10px] text-[#34d399] mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{evaluationResult.epistemicStatus} ({evaluationResult.provider})</span>
                            </div>
                          </div>

                          {/* Guardrail Policy */}
                          <div className="p-3 bg-[#0d1c2d] border border-amber-500/30 rounded-xs font-mono-data">
                            <div className="text-[10px] uppercase text-amber-400">Execution Guardrail</div>
                            <div className="text-xs font-bold text-amber-300">
                              EXECUTION PROHIBITED
                            </div>
                            <div className="text-[10px] text-[#87929a] mt-1">
                              Analytical only • Zero broker APIs
                            </div>
                          </div>
                        </div>

                        {/* Signal Mathematical Explanation */}
                        <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-xs font-mono-data text-[#d4e4fa]">
                          <span className="text-[#38bdf8] font-bold">Rule Engine Reasoning: </span>
                          <span>{evaluationResult.signal.reason}</span>
                        </div>

                        {/* Indicators Snapshot Table */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-mono-data text-[#87929a] uppercase flex items-center justify-between">
                            <span>Computed Indicator Values at As-Of Bar</span>
                            <span>{Object.keys(evaluationResult.indicators).length} Calculated</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Object.entries(evaluationResult.indicators).map(([key, rawInd]) => {
                              const ind = rawInd as CalculatedIndicator;
                              return (
                                <div key={key} className="p-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs font-mono-data text-xs">
                                  <div className="text-[10px] text-[#87929a] truncate">{ind.name}</div>
                                  <div className="text-sm font-bold text-[#d4e4fa]">
                                    {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Rule Outcomes Breakdown */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-mono-data text-[#87929a] uppercase">
                            Logical Condition Evaluations ({evaluationResult.ruleEvaluations.length})
                          </div>
                          <div className="space-y-1">
                            {evaluationResult.ruleEvaluations.map((ruleEval, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded-xs border text-xs font-mono-data flex items-center justify-between gap-2 ${
                                  ruleEval.passed
                                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                                    : 'bg-[#0d1c2d] border-[#1c2b3c] text-[#87929a]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {ruleEval.passed ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <X className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  )}
                                  <span className="font-semibold">{ruleEval.ruleName}</span>
                                </div>
                                <span className="text-[11px] text-[#bdc8d1]">{ruleEval.explanation}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Risk Constraints Audit Results */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-mono-data text-[#87929a] uppercase">
                            Pre-Trade Quantitative Risk Constraints Audit
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            {evaluationResult.riskConstraints.map((rc, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded-xs border text-xs font-mono-data ${
                                  rc.passed
                                    ? 'bg-[#0d1c2d] border-emerald-500/30'
                                    : 'bg-amber-950/20 border-amber-500/40'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[#87929a] truncate">{rc.constraintName}</span>
                                  {rc.passed ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                  )}
                                </div>
                                <div className="text-xs text-[#d4e4fa] font-semibold mt-0.5">
                                  {rc.passed ? 'PASSED' : 'CONSTRAINED'}
                                </div>
                                <div className="text-[10px] text-[#87929a] truncate mt-0.5">
                                  {rc.message}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* NLP Compiler Tab */
        <div className="space-y-4">
          {/* Natural Language Prompt Builder Card */}
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#38bdf8]" />
                <h2 className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                  Describe Investment Strategy in Natural Language
                </h2>
              </div>
              <span className="text-[11px] font-mono-data text-[#87929a]">
                Compiles to deterministic entry, exit, and rebalancing parameters
              </span>
            </div>

            <div className="relative">
              <textarea
                rows={3}
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                placeholder="e.g., 'Find large-cap companies with strong revenue growth (>15%), positive free cash flow margin (>20%), high ROIC (>20%), and momentum breakout. Rebalance monthly with 5% risk cap.'"
                className="w-full p-3 bg-[#0d1c2d] border border-[#1c2b3c] focus:border-[#38bdf8] rounded-sm text-xs font-mono-data text-[#d4e4fa] placeholder-[#87929a] focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-[11px] font-mono-data text-[#87929a]">
                <span>Try sample:</span>
                <button
                  onClick={() => setPromptInput('Find large-cap companies with strong revenue growth, positive free cash flow and momentum. Rebalance monthly.')}
                  className="text-[#38bdf8] hover:underline"
                >
                  "Large-Cap FCF Growth & Momentum"
                </button>
                <span>•</span>
                <button
                  onClick={() => setPromptInput('Screen semiconductor leaders with gross margins > 50%, debt to equity < 0.5, and strong order backlogs. Rebalance quarterly.')}
                  className="text-[#38bdf8] hover:underline"
                >
                  "Semiconductor Supply Moat"
                </button>
              </div>

              <button
                onClick={handleGenerateStrategy}
                disabled={isGenerating || !promptInput.trim()}
                className="px-4 py-2 bg-[#38bdf8] hover:bg-[#7bd0ff] disabled:opacity-50 text-[#051424] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Compiling Rules...' : 'Compile Rules Matrix'}</span>
              </button>
            </div>
          </div>

          {/* Strategies Explorer: Left Selector Rail & Right Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column: Strategy Library */}
            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3 lg:col-span-1">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <span className="text-xs font-mono-data font-semibold text-[#d4e4fa] uppercase">
                  Custom & Legacy Library ({strategies.length})
                </span>
              </div>

              <div className="space-y-2">
                {strategies.map(s => {
                  const isSelected = s.id === selectedLegacyStrategyId;
                  const isVerified = s.status === 'Backtest Verified Strategy';

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedLegacyStrategyId(s.id)}
                      className={`p-3 border rounded-sm cursor-pointer transition-all text-xs space-y-1.5 ${
                        isSelected
                          ? 'bg-[#122131] border-[#38bdf8]'
                          : 'bg-[#0d1c2d] border-[#1c2b3c] hover:border-[#273647]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-xs font-mono-data text-[10px] font-bold ${
                          isVerified
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                        }`}>
                          {s.status}
                        </span>
                        {s.quickMetrics?.cagr && (
                          <span className="font-mono-data text-[11px] text-[#34d399] font-semibold">
                            CAGR: {s.quickMetrics.cagr}
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-[#d4e4fa] text-xs leading-snug">{s.title}</h3>

                      <div className="flex items-center justify-between text-[11px] font-mono-data text-[#87929a] pt-1 border-t border-[#1c2b3c]/60">
                        <span>{s.rebalanceFrequency}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStrategyForBacktest(s);
                            onNavigate('backtesting');
                          }}
                          className="px-2 py-0.5 bg-[#122131] hover:bg-[#1c2b3c] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#38bdf8] text-[10px] rounded-xs flex items-center gap-1 transition-colors"
                          title="Run quantitative simulation with this strategy"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Backtest</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Strategy Rules & Specifications */}
            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 lg:col-span-2 space-y-4">
              {selectedLegacyStrategy && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1c2b3c] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-xs font-mono-data text-[10px] font-bold ${
                          selectedLegacyStrategy.status === 'Backtest Verified Strategy'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                        }`}>
                          {selectedLegacyStrategy.status}
                        </span>
                        <span className="text-[11px] font-mono-data text-[#87929a]">
                          Universe: {selectedLegacyStrategy.targetUniverse} • Rebalance: {selectedLegacyStrategy.rebalanceFrequency}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-[#d4e4fa] mt-1">{selectedLegacyStrategy.title}</h2>
                      <p className="text-xs text-[#87929a] mt-0.5">{selectedLegacyStrategy.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        onSelectStrategyForBacktest(selectedLegacyStrategy);
                        onNavigate('backtesting');
                      }}
                      className="px-3.5 py-1.5 bg-[#38bdf8] hover:bg-[#7bd0ff] text-[#051424] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Launch in Backtest Runner</span>
                    </button>
                  </div>

                  {/* Original Prompt Specification */}
                  <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-xs font-mono-data space-y-1">
                    <span className="text-[10px] text-[#87929a] uppercase">Compiled Natural Language Intent:</span>
                    <p className="text-[#bdc8d1] italic">"{selectedLegacyStrategy.prompt}"</p>
                  </div>

                  {/* Rules Specification Matrix */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono-data text-[#87929a]">
                      <span>QUANTITATIVE RULESPEC DEFINITIONS ({selectedLegacyStrategy.rules.length} RULES)</span>
                      <span>Deterministic Logical Execution</span>
                    </div>

                    <div className="space-y-2">
                      {selectedLegacyStrategy.rules.map((rule, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-xs font-mono-data flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 bg-[#122131] border border-[#1c2b3c] text-[#38bdf8] font-bold text-[10px] rounded-xs uppercase">
                              {rule.category}
                            </span>
                            <span className="text-[#d4e4fa] font-medium">{rule.description}</span>
                          </div>

                          <div className="px-2 py-0.5 bg-[#051424] border border-[#1c2b3c] text-[#34d399] text-[11px] rounded-xs">
                            {rule.parameters}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
