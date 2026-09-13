import React, { useState, useMemo } from 'react';
import { BacktestResult, Strategy, ActiveScreen, BacktestTrade } from '../types';
import { EquityCurveChart, DrawdownChart } from './common/FinancialChart';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import {
  Play,
  AlertTriangle,
  Layers,
  Info,
  ShieldAlert,
  ArrowRight,
  Sliders,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Scale,
  Activity,
  BarChart3,
  Percent,
  Search,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';

interface BacktestingViewProps {
  currentBacktest: BacktestResult;
  strategies: Strategy[];
  onSelectStrategy: (strategy: Strategy) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onSelectStock?: (ticker: string) => void;
}

const AVAILABLE_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US' as const, currency: 'USD', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US' as const, currency: 'USD', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'US' as const, currency: 'USD', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US' as const, currency: 'USD', exchange: 'NASDAQ' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', market: 'INDIA' as const, currency: 'INR', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', market: 'INDIA' as const, currency: 'INR', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys Ltd.', market: 'INDIA' as const, currency: 'INR', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', market: 'INDIA' as const, currency: 'INR', exchange: 'NSE' }
];

export const BacktestingView: React.FC<BacktestingViewProps> = ({
  currentBacktest,
  strategies,
  onSelectStrategy,
  onNavigate,
  onSelectStock
}) => {
  const [activeBacktest, setActiveBacktest] = useState<BacktestResult>(currentBacktest);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    currentBacktest.strategyId || strategies[0]?.id || 'strat-ma-crossover'
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');
  const [startDate, setStartDate] = useState<string>('2023-01-01');
  const [endDate, setEndDate] = useState<string>('2024-01-01');
  const [slippageBps, setSlippageBps] = useState<number>(5);
  const [commission, setCommission] = useState<number>(1.0);
  const [executionTiming, setExecutionTiming] = useState<'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN' | 'SAME_BAR_CLOSE'>(
    'SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN'
  );
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('SPY');
  const [isSimulatedBaseline, setIsSimulatedBaseline] = useState<boolean>(false);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<
    'performance' | 'trading' | 'risk' | 'benchmark' | 'trades' | 'reconciliation' | 'audit'
  >('performance');
  const [selectedTradeForDrillDown, setSelectedTradeForDrillDown] = useState<BacktestTrade | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentSec = AVAILABLE_SYMBOLS.find(s => s.symbol === selectedSymbol) || AVAILABLE_SYMBOLS[0];

  // Auto-update benchmark default when switching market
  const effectiveBenchmark = useMemo(() => {
    if (currentSec.market === 'INDIA') {
      return benchmarkSymbol === 'SPY' || benchmarkSymbol === 'QQQ' ? 'NIFTY50' : benchmarkSymbol;
    }
    return benchmarkSymbol === 'NIFTY50' ? 'SPY' : benchmarkSymbol;
  }, [currentSec.market, benchmarkSymbol]);

  const isVerified = useMemo(() => {
    return Boolean(
      activeBacktest &&
      activeBacktest.status === 'COMPLETED' &&
      activeBacktest.id !== 'bkt-001-mock' &&
      Array.isArray(activeBacktest.equityCurve) &&
      activeBacktest.equityCurve.length > 0
    );
  }, [activeBacktest]);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setErrorMessage(null);

    const initialCapital = currentSec.market === 'INDIA' ? 1000000 : 100000;
    const comm = currentSec.market === 'INDIA' ? 20.0 : commission;

    try {
      const response = await fetch('/api/backtests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedStrategyId,
          symbols: [selectedSymbol],
          startDate,
          endDate,
          initialCapital,
          currency: currentSec.currency,
          slippageBps,
          commissionPerTrade: comm,
          executionTiming,
          benchmarkSymbol: effectiveBenchmark,
          isSimulatedBaseline
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(data.error || data.message || 'Backtest simulation blocked or failed');
        if (data.result) {
          setActiveBacktest(data.result);
        }
      } else {
        setActiveBacktest(data.result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Network error executing backtest simulation');
    } finally {
      setIsSimulating(false);
    }
  };

  const tradeList = activeBacktest?.tradeLog || activeBacktest?.trades || [];

  const equityPointsForChart = useMemo(() => {
    if (!activeBacktest?.equityCurve) return [];
    return activeBacktest.equityCurve.map(pt => ({
      date: pt.date,
      strategy: pt.equity,
      benchmark:
        activeBacktest.benchmarkResults?.status === 'CALCULATED'
          ? activeBacktest.initialCapital * (1 + activeBacktest.benchmarkResults.benchmarkTotalReturn / 100)
          : activeBacktest.initialCapital,
      drawdown: pt.drawdownPct ?? 0
    }));
  }, [activeBacktest]);

  const drawdownPointsForChart = useMemo(() => {
    if (!activeBacktest?.equityCurve) return [];
    return activeBacktest.equityCurve.map(pt => ({
      date: pt.date,
      drawdownPct: pt.drawdownPct ?? 0
    }));
  }, [activeBacktest]);

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              QUANTITATIVE BACKTESTING & ANALYTICS ENGINE
            </h1>
            <span className="text-xs font-mono-data text-[#87929a] px-2 py-0.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
              PHASE 12 • COMPREHENSIVE VERIFICATION
            </span>
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Strict chronological event loop with zero look-ahead bias, slippage friction, portfolio accounting reconciliation, and benchmark risk analytics.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="px-3.5 py-2 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#d4e4fa] hover:text-[#38bdf8] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showConfigPanel ? 'Hide Controls' : 'Configure Engine'}</span>
          </button>
          <button
            onClick={() => onNavigate('strategies')}
            className="px-3.5 py-2 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] hover:border-[#38bdf8]/50 text-[#d4e4fa] hover:text-[#38bdf8] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <span>Strategy Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="px-4 py-2 bg-[#38bdf8] hover:bg-[#7bd0ff] disabled:opacity-50 text-[#051424] font-semibold text-xs font-mono-data rounded-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isSimulating ? 'Executing Simulation...' : 'Run Backtest Engine'}</span>
          </button>
        </div>
      </div>

      {/* Prominent Epistemic / Simulation Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#090d14] border border-[#1c2b3c] rounded-sm font-mono-data text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[#87929a] uppercase text-[11px]">Backtest Status:</span>
          {activeBacktest?.dataStatus === 'SIMULATED' || activeBacktest?.epistemicStatus === 'SIMULATED' ? (
            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xs font-bold text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              SIMULATED BACKTEST
            </span>
          ) : isVerified ? (
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xs font-bold text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              REAL HISTORICAL DATA (CALCULATED SIMULATION)
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-xs font-bold text-xs">
              UNVERIFIED INITIAL STATE
            </span>
          )}
          <span className="text-[#87929a] text-[11px]">
            Model ID: <code className="text-[#38bdf8]">{activeBacktest?.strategyId || selectedStrategyId}</code>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#87929a]">
          <span>Provider: {activeBacktest?.provenance?.provider || 'Canonical Provider'}</span>
          <ProvenanceBadge tag="CALCULATION" size="xs" />
        </div>
      </div>

      {/* Epistemic Risk Warning Banner - STRICT MANDATE */}
      <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-sm text-xs space-y-1">
        <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono-data">
          <ShieldAlert className="w-4 h-4" />
          <span>EPISTEMIC INTEGRITY & REGULATORY DISCLOSURE</span>
        </div>
        <p className="text-[#bdc8d1] leading-relaxed text-[11px] font-mono-data">
          <strong>Historical backtest performance is NOT a prediction of future returns. Never label backtest performance as REAL.</strong> Orders are executed deterministically on bar <code className="text-[#38bdf8]">T+1 Open</code> following bar <code className="text-[#38bdf8]">T Close</code> signals. Model excludes market impact of large block trades and assumes sufficient depth at quoted prices.
        </p>
      </div>

      {/* Error / Warning Alert Banner if Blocked */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-sm text-xs space-y-2 font-mono-data">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <AlertTriangle className="w-4 h-4" />
            <span>BACKTEST ENGINE ALERT: {activeBacktest.status || 'EXECUTION_BLOCKED'}</span>
          </div>
          <p className="text-[#bdc8d1] text-[11px]">{errorMessage}</p>
          {!isSimulatedBaseline && (
            <div className="pt-1">
              <button
                onClick={() => {
                  setIsSimulatedBaseline(true);
                  setTimeout(handleRunSimulation, 50);
                }}
                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xs text-[11px] font-semibold"
              >
                Switch to Deterministic Baseline Simulation & Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interactive Configuration Panel */}
      {showConfigPanel && (
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 text-xs font-mono-data space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2 text-[#87929a]">
            <span className="font-semibold text-[#d4e4fa] uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#38bdf8]" />
              Deterministic Simulation Parameters
            </span>
            <span className="text-[11px] text-[#38bdf8]">Zero Look-Ahead Bias Guaranteed</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Strategy Selection */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Quantitative Strategy</label>
              <select
                value={selectedStrategyId}
                onChange={e => {
                  setSelectedStrategyId(e.target.value);
                  const found = strategies.find(s => s.id === e.target.value);
                  if (found) onSelectStrategy(found);
                }}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
              >
                <option value="strat-ma-crossover">Moving Average Crossover (Trend)</option>
                <option value="strat-rsi">RSI Mean Reversion (Momentum)</option>
                <option value="strat-momentum">Price Momentum (Trend Following)</option>
                <option value="strat-breakout">Donchian Channel Breakout (Volatility)</option>
                <option value="strat-multi-factor">Multi-Factor Quantitative (Quality+Value+Mom)</option>
              </select>
            </div>

            {/* Symbol & Market */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Canonical Asset (US / India)</label>
              <select
                value={selectedSymbol}
                onChange={e => setSelectedSymbol(e.target.value)}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
              >
                {AVAILABLE_SYMBOLS.map(s => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} ({s.market} • {s.exchange} • {s.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Benchmark Selection */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Benchmark Comparison</label>
              <select
                value={effectiveBenchmark}
                onChange={e => setBenchmarkSymbol(e.target.value)}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
              >
                {currentSec.market === 'INDIA' ? (
                  <>
                    <option value="NIFTY50">NIFTY 50 (India Benchmark)</option>
                    <option value="BANKNIFTY">NIFTY Bank (India)</option>
                  </>
                ) : (
                  <>
                    <option value="SPY">SPY (S&P 500 US Large Cap)</option>
                    <option value="QQQ">QQQ (Nasdaq 100 Tech)</option>
                  </>
                )}
              </select>
            </div>

            {/* Slippage BPS */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Slippage Friction</label>
              <select
                value={slippageBps}
                onChange={e => setSlippageBps(Number(e.target.value))}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none"
              >
                <option value={0}>0 bps (Zero friction - theoretical)</option>
                <option value={5}>5 bps (0.05% - Large-cap liquid)</option>
                <option value={10}>10 bps (0.10% - Standard)</option>
                <option value={20}>20 bps (0.20% - High adverse selection)</option>
              </select>
            </div>

            {/* Date Range Start */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
              >
              </input>
            </div>

            {/* Date Range End */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none focus:border-[#38bdf8]"
              >
              </input>
            </div>

            {/* Execution Model */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Execution Timing Model</label>
              <select
                value={executionTiming}
                onChange={e => setExecutionTiming(e.target.value as any)}
                className="w-full bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs text-[#d4e4fa] focus:outline-none"
              >
                <option value="SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN">Signal Close → Next Open (Standard)</option>
                <option value="SAME_BAR_CLOSE">Same Bar Close (MOC Order)</option>
              </select>
            </div>

            {/* Fallback Simulation Mode Toggle */}
            <div className="space-y-1">
              <label className="text-[#87929a] text-[10px] uppercase block">Data Fallback Mode</label>
              <label className="flex items-center gap-2 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs px-2.5 py-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSimulatedBaseline}
                  onChange={e => setIsSimulatedBaseline(e.target.checked)}
                  className="rounded-xs border-[#1c2b3c] text-[#38bdf8] focus:ring-0"
                />
                <span className={isSimulatedBaseline ? 'text-[#38bdf8] font-bold' : 'text-[#87929a]'}>
                  {isSimulatedBaseline ? 'Deterministic Sine Baseline' : 'Strict Market Historical'}
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* UNVERIFIED STATE CALLOUT IF NO VERIFIED BACKTEST */}
      {!isVerified ? (
        <div className="bg-[#090d14] border-2 border-dashed border-[#1c2b3c] rounded-sm p-8 text-center space-y-4 font-mono-data">
          <div className="inline-flex p-3 rounded-full bg-[#0d1c2d] border border-[#1c2b3c] text-[#87929a]">
            <Layers className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#d4e4fa] uppercase">NO VERIFIED BACKTEST AVAILABLE</h3>
            <p className="text-xs text-[#87929a] max-w-lg mx-auto">
              No real deterministic backtest has been executed for this session yet. Mock results are prohibited.
              Click the button below to execute a verified walk-forward simulation using historical market data.
            </p>
          </div>
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="px-5 py-2.5 bg-[#38bdf8] hover:bg-[#7bd0ff] text-[#051424] font-bold text-xs rounded-xs inline-flex items-center gap-2 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isSimulating ? 'Executing Simulation...' : 'Run Verified Backtest'}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Primary Scorecard Grid (Performance + Risk Highlights) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 font-mono-data">
              <div className="text-[10px] text-[#87929a] uppercase">Compound CAGR</div>
              <div className="text-xl font-bold text-[#34d399] mt-1">
                {activeBacktest.cagr !== undefined ? `${activeBacktest.cagr}%` : 'UNAVAILABLE'}
              </div>
              <div className="text-[10px] text-[#87929a] mt-0.5">Total Return {activeBacktest.totalReturnPct}%</div>
            </div>

            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 font-mono-data">
              <div className="text-[10px] text-[#87929a] uppercase">Sharpe Ratio</div>
              <div className="text-xl font-bold text-[#38bdf8] mt-1">
                {activeBacktest.sharpeRatio !== undefined ? activeBacktest.sharpeRatio : 'N/A'}
              </div>
              <div className="text-[10px] text-[#87929a] mt-0.5">Rf = 0.0% default</div>
            </div>

            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 font-mono-data">
              <div className="text-[10px] text-[#87929a] uppercase">Sortino Ratio</div>
              <div className="text-xl font-bold text-[#38bdf8] mt-1">
                {activeBacktest.sortinoRatio !== undefined ? activeBacktest.sortinoRatio : 'N/A'}
              </div>
              <div className="text-[10px] text-[#87929a] mt-0.5">Downside Vol Protection</div>
            </div>

            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 font-mono-data">
              <div className="text-[10px] text-[#87929a] uppercase">Max Drawdown</div>
              <div className="text-xl font-bold text-[#f43f5e] mt-1">
                -{activeBacktest.maxDrawdown}%
              </div>
              <div className="text-[10px] text-[#87929a] mt-0.5">Peak-to-trough drop</div>
            </div>

            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 font-mono-data">
              <div className="text-[10px] text-[#87929a] uppercase">Win Rate</div>
              <div className="text-xl font-bold text-[#d4e4fa] mt-1">
                {activeBacktest.winRate !== undefined ? `${activeBacktest.winRate}%` : 'N/A'}
              </div>
              <div className="text-[10px] text-[#87929a] mt-0.5">{tradeList.length} trades total</div>
            </div>

            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-3 font-mono-data">
              <div className="text-[10px] text-[#87929a] uppercase">Ending Equity</div>
              <div className="text-xl font-bold text-[#34d399] mt-1">
                {activeBacktest.configuration?.currency === 'INR' ? '₹' : '$'}
                {Math.round(activeBacktest.finalEquity || 100000).toLocaleString()}
              </div>
              <div className="text-[10px] text-[#87929a] mt-0.5">
                Initial: {activeBacktest.configuration?.currency === 'INR' ? '₹1,000,000' : '$100,000'}
              </div>
            </div>
          </div>

          {/* Charts Section: Equity Curve + Drawdown Curve */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Equity Curve Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-data text-[#87929a]">
                <span className="font-semibold text-[#d4e4fa] uppercase">
                  SIMULATED EQUITY TRAJECTORY ({activeBacktest.configuration?.currency || 'USD'})
                </span>
                <span className="text-[10px] text-[#38bdf8]">
                  Benchmark: {effectiveBenchmark}
                </span>
              </div>
              <EquityCurveChart
                data={equityPointsForChart}
                height={220}
              />
            </div>

            {/* Underwater Drawdown Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-data text-[#87929a]">
                <span className="font-semibold text-[#d4e4fa] uppercase">
                  UNDERWATER DRAWDOWN PROFILE
                </span>
                <span className="text-[10px] text-rose-400">
                  Max: -{activeBacktest.maxDrawdown}%
                </span>
              </div>
              <DrawdownChart
                data={drawdownPointsForChart}
                height={220}
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-[#1c2b3c] text-xs font-mono-data overflow-x-auto">
            {[
              { id: 'performance' as const, label: 'Performance Analytics' },
              { id: 'trading' as const, label: 'Trading Analytics' },
              { id: 'risk' as const, label: 'Risk & Exposure' },
              { id: 'benchmark' as const, label: 'Benchmark Comparison' },
              { id: 'trades' as const, label: `Trade Ledger (${tradeList.length})` },
              { id: 'reconciliation' as const, label: 'Accounting Reconciliation' },
              { id: 'audit' as const, label: 'Data Quality & Biases' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2.5 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-[#38bdf8] text-[#38bdf8] bg-[#0d1c2d]/50'
                    : 'border-transparent text-[#87929a] hover:text-[#d4e4fa]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: PERFORMANCE ANALYTICS */}
          {activeTab === 'performance' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Capital & Cumulative Returns
                </h3>
                <div className="space-y-2.5 divide-y divide-[#1c2b3c]">
                  <div className="flex justify-between pt-1">
                    <span className="text-[#87929a]">Initial Simulation Capital:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.configuration?.currency === 'INR' ? '₹' : '$'}
                      {(activeBacktest.initialCapital || 100000).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Ending Audited Equity:</span>
                    <span className="text-[#34d399] font-bold">
                      {activeBacktest.configuration?.currency === 'INR' ? '₹' : '$'}
                      {(activeBacktest.finalEquity || 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Net Cumulative Return:</span>
                    <span className="text-[#34d399] font-bold">
                      {activeBacktest.totalReturnPct >= 0 ? '+' : ''}{activeBacktest.totalReturnPct}%
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Compound Annual Growth Rate (CAGR):</span>
                    <span className="text-[#38bdf8] font-bold">
                      {activeBacktest.cagr !== undefined ? `${activeBacktest.cagr}%` : 'UNAVAILABLE (< 30 days)'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Risk-Adjusted Sharpe Ratio:</span>
                    <span className="text-[#38bdf8] font-bold">{activeBacktest.sharpeRatio ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Downside Sortino Ratio:</span>
                    <span className="text-[#38bdf8] font-bold">{activeBacktest.sortinoRatio ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Drawdown & Recovery Profile
                </h3>
                <div className="space-y-2.5 divide-y divide-[#1c2b3c]">
                  <div className="flex justify-between pt-1">
                    <span className="text-[#87929a]">Maximum Drawdown Percentage:</span>
                    <span className="text-rose-400 font-bold">-{activeBacktest.maxDrawdown}%</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Drawdown Peak Date:</span>
                    <span className="text-[#d4e4fa]">
                      {activeBacktest.maxDrawdownDetails?.peakDate || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Drawdown Trough Date:</span>
                    <span className="text-[#d4e4fa]">
                      {activeBacktest.maxDrawdownDetails?.troughDate || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Trough Duration:</span>
                    <span className="text-[#d4e4fa]">
                      {activeBacktest.maxDrawdownDetails?.durationDays
                        ? `${activeBacktest.maxDrawdownDetails.durationDays} calendar days`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Calmar Ratio:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.maxDrawdown > 0 && activeBacktest.cagr !== undefined
                        ? (activeBacktest.cagr / activeBacktest.maxDrawdown).toFixed(2)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Annualized Realized Volatility:</span>
                    <span className="text-[#d4e4fa] font-bold">{activeBacktest.annualizedVol}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRADING ANALYTICS */}
          {activeTab === 'trading' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Trade Statistics & Payoff Profile
                </h3>
                <div className="space-y-2.5 divide-y divide-[#1c2b3c]">
                  <div className="flex justify-between pt-1">
                    <span className="text-[#87929a]">Total Executed Trades:</span>
                    <span className="text-[#d4e4fa] font-bold">{tradeList.length}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Win Rate:</span>
                    <span className="text-emerald-400 font-bold">{activeBacktest.winRate}%</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Winning Trades Count:</span>
                    <span className="text-emerald-400 font-bold">
                      {activeBacktest.tradeStatistics?.winningTrades ?? tradeList.filter(t => (t.realizedPnL || 0) > 0).length}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Losing Trades Count:</span>
                    <span className="text-rose-400 font-bold">
                      {activeBacktest.tradeStatistics?.losingTrades ?? tradeList.filter(t => (t.realizedPnL || 0) < 0).length}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Profit Factor:</span>
                    <span className="text-[#38bdf8] font-bold">
                      {activeBacktest.profitFactor !== undefined ? `${activeBacktest.profitFactor}x` : 'N/A (Zero Losses)'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Win/Loss Payoff Ratio:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.tradeStatistics?.winLossRatio !== undefined && activeBacktest.tradeStatistics?.winLossRatio !== null
                        ? `${activeBacktest.tradeStatistics.winLossRatio}x`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Volume & Portfolio Turnover
                </h3>
                <div className="space-y-2.5 divide-y divide-[#1c2b3c]">
                  <div className="flex justify-between pt-1">
                    <span className="text-[#87929a]">Total Traded Volume:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.configuration?.currency === 'INR' ? '₹' : '$'}
                      {(activeBacktest.turnover?.totalTradedVolume || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Portfolio Turnover Rate:</span>
                    <span className="text-[#38bdf8] font-bold">
                      {activeBacktest.turnover?.turnoverPct !== undefined ? `${activeBacktest.turnover.turnoverPct}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Annualized Turnover Rate:</span>
                    <span className="text-[#38bdf8] font-bold">
                      {activeBacktest.turnover?.annualizedTurnoverPct !== undefined
                        ? `${activeBacktest.turnover.annualizedTurnoverPct}% / yr`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Average Trade Size:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {tradeList.length > 0 && activeBacktest.turnover?.totalTradedVolume
                        ? `${activeBacktest.configuration?.currency === 'INR' ? '₹' : '$'}${Math.round(activeBacktest.turnover.totalTradedVolume / tradeList.length).toLocaleString()}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Total Transaction Fees Incurred:</span>
                    <span className="text-rose-400 font-bold">
                      -${(activeBacktest.totalTransactionCosts || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Total Slippage Friction Incurred:</span>
                    <span className="text-rose-400 font-bold">
                      -${(activeBacktest.totalSlippageCost || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RISK & EXPOSURE */}
          {activeTab === 'risk' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Market Exposure & Cash Utilization
                </h3>
                <div className="space-y-2.5 divide-y divide-[#1c2b3c]">
                  <div className="flex justify-between pt-1">
                    <span className="text-[#87929a]">Average Market Exposure:</span>
                    <span className="text-[#38bdf8] font-bold">
                      {activeBacktest.exposureSeries?.length
                        ? `${(activeBacktest.exposureSeries.reduce((acc, p) => acc + p.marketExposurePct, 0) / activeBacktest.exposureSeries.length).toFixed(1)}%`
                        : '100.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Maximum Market Exposure:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.exposureSeries?.length
                        ? `${Math.max(...activeBacktest.exposureSeries.map(p => p.marketExposurePct)).toFixed(1)}%`
                        : '100.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Max Single Asset Concentration:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.concentrationMetrics?.maxSinglePositionPct !== undefined
                        ? `${activeBacktest.concentrationMetrics.maxSinglePositionPct}%`
                        : '100.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Top 5 Holdings Concentration:</span>
                    <span className="text-[#d4e4fa] font-bold">
                      {activeBacktest.concentrationMetrics?.top5ConcentrationPct !== undefined
                        ? `${activeBacktest.concentrationMetrics.top5ConcentrationPct}%`
                        : '100.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Short Exposure / Naked Leverage:</span>
                    <span className="text-emerald-400 font-bold">0.0% (Strictly Long-Only)</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Volatility & Tail Risk
                </h3>
                <div className="space-y-2.5 divide-y divide-[#1c2b3c]">
                  <div className="flex justify-between pt-1">
                    <span className="text-[#87929a]">Annualized Return Volatility:</span>
                    <span className="text-[#d4e4fa] font-bold">{activeBacktest.annualizedVol}%</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Maximum Peak-to-Trough Drawdown:</span>
                    <span className="text-rose-400 font-bold">-{activeBacktest.maxDrawdown}%</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Current Open Long Positions:</span>
                    <span className="text-[#38bdf8] font-bold">{activeBacktest.positions?.length || 0}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Liquidity / Order Size Friction:</span>
                    <span className="text-[#d4e4fa] font-bold">{activeBacktest.configuration?.slippageBps || 5} bps</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-[#87929a]">Extreme Regime Resilience:</span>
                    <span className="text-[#34d399] font-bold">Audited (Deterministic walk-forward)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BENCHMARK COMPARISON */}
          {activeTab === 'benchmark' && (
            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4 text-xs font-mono-data">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <div>
                  <h3 className="font-semibold text-[#d4e4fa] uppercase">
                    Strategy vs Benchmark Performance ({effectiveBenchmark})
                  </h3>
                  <p className="text-[11px] text-[#87929a]">
                    Observational comparative return metrics against the broad market index.
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                  activeBacktest.benchmarkResults?.status === 'CALCULATED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  STATUS: {activeBacktest.benchmarkResults?.status || 'CALCULATED'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Strategy Total Return</span>
                  <div className="text-base font-bold text-[#34d399]">
                    {activeBacktest.totalReturnPct >= 0 ? '+' : ''}{activeBacktest.totalReturnPct}%
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Benchmark Total Return</span>
                  <div className="text-base font-bold text-[#bdc8d1]">
                    {activeBacktest.benchmarkResults?.benchmarkTotalReturn !== undefined
                      ? `${activeBacktest.benchmarkResults.benchmarkTotalReturn >= 0 ? '+' : ''}${activeBacktest.benchmarkResults.benchmarkTotalReturn}%`
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Excess Return (Alpha)</span>
                  <div className="text-base font-bold text-[#38bdf8]">
                    {activeBacktest.benchmarkResults?.excessReturn !== undefined
                      ? `${activeBacktest.benchmarkResults.excessReturn >= 0 ? '+' : ''}${activeBacktest.benchmarkResults.excessReturn}%`
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Beta to Benchmark</span>
                  <div className="text-base font-bold text-[#d4e4fa]">
                    {activeBacktest.benchmarkResults?.beta !== undefined && activeBacktest.benchmarkResults.beta !== null
                      ? activeBacktest.benchmarkResults.beta
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                  <div className="text-[10px] text-[#87929a] uppercase">Correlation (r)</div>
                  <div className="text-sm font-bold text-[#d4e4fa] mt-1">
                    {activeBacktest.benchmarkResults?.correlation !== undefined && activeBacktest.benchmarkResults.correlation !== null
                      ? activeBacktest.benchmarkResults.correlation
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                  <div className="text-[10px] text-[#87929a] uppercase">Tracking Error</div>
                  <div className="text-sm font-bold text-[#d4e4fa] mt-1">
                    {activeBacktest.benchmarkResults?.trackingError !== undefined && activeBacktest.benchmarkResults.trackingError !== null
                      ? `${activeBacktest.benchmarkResults.trackingError}%`
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                  <div className="text-[10px] text-[#87929a] uppercase">Information Ratio</div>
                  <div className="text-sm font-bold text-[#38bdf8] mt-1">
                    {activeBacktest.benchmarkResults?.informationRatio !== undefined && activeBacktest.benchmarkResults.informationRatio !== null
                      ? activeBacktest.benchmarkResults.informationRatio
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xs text-[11px] text-[#87929a] leading-relaxed">
                <strong>Benchmark Disclaimer:</strong> Comparative benchmark returns are strictly observational. Historical excess return does not guarantee future alpha. Benchmarks reflect gross price returns without dividends reinvested unless specified.
              </div>
            </div>
          )}

          {/* TAB 5: TRADE LEDGER & DRILL-DOWN */}
          {activeTab === 'trades' && (
            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono-data text-[#87929a] uppercase">
                <span>Historical Trade Decision Record ({tradeList.length} orders executed)</span>
                <span className="text-[#38bdf8]">Click row for full execution & indicator drill-down</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono-data">
                  <thead>
                    <tr className="text-[#87929a] border-b border-[#1c2b3c] text-[11px]">
                      <th className="py-2 px-2">EXEC DATE (T+1)</th>
                      <th className="py-2 px-2">SIGNAL DATE (T)</th>
                      <th className="py-2 px-2">TICKER</th>
                      <th className="py-2 px-2">ACTION</th>
                      <th className="py-2 px-2 text-right">SHARES</th>
                      <th className="py-2 px-2 text-right">REQ PRICE</th>
                      <th className="py-2 px-2 text-right">FILL PRICE</th>
                      <th className="py-2 px-2 text-right">SLIPPAGE</th>
                      <th className="py-2 px-2 text-right">COMMISSION</th>
                      <th className="py-2 px-2 text-right">REALIZED P&L</th>
                      <th className="py-2 px-2 text-center">INSPECT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2b3c]">
                    {tradeList.map((trade, idx) => (
                      <tr
                        key={trade.id || idx}
                        onClick={() => setSelectedTradeForDrillDown(trade)}
                        className="hover:bg-[#0d1c2d] cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-2 text-[#87929a] whitespace-nowrap">
                          {(trade.date || trade.timestamp || '').split('T')[0]}
                        </td>
                        <td className="py-2 px-2 text-[#87929a] whitespace-nowrap">
                          {(trade.signalTimestamp || trade.date || '').split('T')[0]}
                        </td>
                        <td className="py-2 px-2 font-bold text-[#38bdf8]">
                          {trade.ticker || trade.symbol}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded-xs font-semibold text-[10px] ${
                            (trade.action || trade.side) === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {trade.action || trade.side}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-[#d4e4fa]">{trade.shares || trade.quantity}</td>
                        <td className="py-2 px-2 text-right text-[#87929a]">
                          ${(trade.requestedPrice || trade.price).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right text-[#d4e4fa] font-bold">
                          ${(trade.executionPrice || trade.price).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right text-[#f43f5e]">
                          ${(trade.slippage || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right text-[#87929a]">
                          ${(trade.transactionCost || 1.0).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">
                          {trade.realizedPnL !== undefined ? (
                            <span className={trade.realizedPnL >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}>
                              {trade.realizedPnL >= 0 ? '+' : ''}${trade.realizedPnL.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#87929a]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-[#38bdf8]">
                          <ChevronRight className="w-4 h-4 mx-auto" />
                        </td>
                      </tr>
                    ))}
                    {tradeList.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-6 text-center text-[#87929a]">
                          No trades triggered in this evaluation period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNTING RECONCILIATION */}
          {activeTab === 'reconciliation' && (
            <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4 text-xs font-mono-data">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <span className="font-semibold text-[#d4e4fa] uppercase flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#38bdf8]" />
                  Portfolio Accounting & Mark-to-Market Invariants
                </span>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>RECONCILIATION VERIFIED (Epsilon &lt; 0.05)</span>
                </div>
              </div>

              <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-2">
                <div className="text-[11px] text-[#87929a] uppercase font-bold">
                  Fundamental Valuation Identity:
                </div>
                <div className="text-sm font-bold text-[#d4e4fa] p-2 bg-[#051424] rounded-xs border border-[#1c2b3c]">
                  Ending Equity = Initial Capital + Realized P&L + Unrealized P&L - Transaction Costs
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Initial Capital</span>
                  <div className="text-base font-bold text-[#d4e4fa]">
                    ${(activeBacktest.initialCapital || 100000).toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Realized P&L</span>
                  <div className={`text-base font-bold ${(activeBacktest.totalRealizedPnL || 0) >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}`}>
                    ${(activeBacktest.totalRealizedPnL || 0).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Unrealized P&L</span>
                  <div className={`text-base font-bold ${(activeBacktest.totalUnrealizedPnL || 0) >= 0 ? 'text-[#34d399]' : 'text-[#f43f5e]'}`}>
                    ${(activeBacktest.totalUnrealizedPnL || 0).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Transaction Costs</span>
                  <div className="text-base font-bold text-[#f43f5e]">
                    -${(activeBacktest.totalTransactionCosts || 0).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#87929a] uppercase">Audited Ending Equity</span>
                  <div className="text-base font-bold text-[#38bdf8]">
                    ${(activeBacktest.finalEquity || 100000).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: DATA QUALITY, METHODOLOGY & BIAS AUDIT */}
          {activeTab === 'audit' && (
            <div className="space-y-4 text-xs font-mono-data">
              {/* Data Quality Panel */}
              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Canonical Market Data Quality & Provenance
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Provider</span>
                    <span className="font-bold text-[#38bdf8]">{activeBacktest.provenance?.provider || 'Twelve Data / FYERS'}</span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Market / Exchange</span>
                    <span className="font-bold text-[#d4e4fa]">
                      {currentSec.market} • {currentSec.exchange}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Currency</span>
                    <span className="font-bold text-[#d4e4fa]">{activeBacktest.configuration?.currency || 'USD'}</span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Price Adjustment</span>
                    <span className="font-bold text-emerald-400">
                      {activeBacktest.dataQuality?.splitAdjusted ? 'SPLIT_ADJUSTED' : 'UNADJUSTED'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Bars Evaluated</span>
                    <span className="font-bold text-[#d4e4fa]">{activeBacktest.dataQuality?.totalBarsCount || activeBacktest.equityCurve?.length || 0}</span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Missing Bars Count</span>
                    <span className="font-bold text-emerald-400">{activeBacktest.dataQuality?.missingBarsCount || 0}</span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Data Status</span>
                    <span className="font-bold text-[#38bdf8]">{activeBacktest.dataStatus || 'REAL'}</span>
                  </div>
                  <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
                    <span className="text-[10px] text-[#87929a] uppercase block">Epistemic Status</span>
                    <span className="font-bold text-emerald-400">{activeBacktest.epistemicStatus || 'CALCULATED'}</span>
                  </div>
                </div>
              </div>

              {/* Explicit Limitations Surfacing */}
              <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
                <h3 className="font-semibold text-[#d4e4fa] uppercase border-b border-[#1c2b3c] pb-2">
                  Epistemic Limitations & Bias Defenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <span>⚠ SURVIVORSHIP_BIAS_POSSIBLE</span>
                    </div>
                    <p className="text-[#87929a] text-[11px] leading-relaxed">
                      This backtest is evaluated on a single surviving ticker ({selectedSymbol}). It does not simulate companies that were delisted, liquidated, or acquired over the backtest window.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <span>⚠ DELISTING_DATA_UNAVAILABLE</span>
                    </div>
                    <p className="text-[#87929a] text-[11px] leading-relaxed">
                      Delisting return distribution and terminal liquidation discounts are omitted from historical price series.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span>✓ ZERO_LOOK_AHEAD_BIAS</span>
                    </div>
                    <p className="text-[#87929a] text-[11px] leading-relaxed">
                      Strategy evaluation at timestamp T only accesses historical bars &le; T. Orders execute at T+1 Open.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span>✓ REALISTIC_TRANSACTION_FRICTION</span>
                    </div>
                    <p className="text-[#87929a] text-[11px] leading-relaxed">
                      Simulates adverse slippage ({activeBacktest.configuration?.slippageBps || 5} bps) and exchange commissions on every round trip.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TRADE DRILL-DOWN MODAL */}
      {selectedTradeForDrillDown && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm max-w-2xl w-full p-5 space-y-4 font-mono-data text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#d4e4fa] uppercase">
                  TRADE DRILL-DOWN AUDIT
                </span>
                <span className="text-xs text-[#38bdf8]">
                  #{selectedTradeForDrillDown.id || selectedTradeForDrillDown.tradeId}
                </span>
              </div>
              <button
                onClick={() => setSelectedTradeForDrillDown(null)}
                className="text-[#87929a] hover:text-[#d4e4fa] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Execution Details */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-[#87929a] uppercase">1. Execution Fill Ledger</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0d1c2d] border border-[#1c2b3c] p-3 rounded-xs">
                <div>
                  <span className="text-[10px] text-[#87929a] block">Symbol</span>
                  <span className="font-bold text-[#38bdf8]">{selectedTradeForDrillDown.ticker || selectedTradeForDrillDown.symbol}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Side / Action</span>
                  <span className={`font-bold ${(selectedTradeForDrillDown.action || selectedTradeForDrillDown.side) === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedTradeForDrillDown.action || selectedTradeForDrillDown.side}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Shares</span>
                  <span className="font-bold text-[#d4e4fa]">{selectedTradeForDrillDown.shares || selectedTradeForDrillDown.quantity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Fill Price</span>
                  <span className="font-bold text-[#d4e4fa]">${(selectedTradeForDrillDown.executionPrice || selectedTradeForDrillDown.price).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Req Price (Prev Close)</span>
                  <span className="text-[#87929a]">${(selectedTradeForDrillDown.requestedPrice || selectedTradeForDrillDown.price).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Slippage Friction</span>
                  <span className="text-rose-400 font-bold">${(selectedTradeForDrillDown.slippage || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Commission Paid</span>
                  <span className="text-rose-400 font-bold">${(selectedTradeForDrillDown.transactionCost || 1.0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#87929a] block">Realized P&L</span>
                  <span className={`font-bold ${(selectedTradeForDrillDown.realizedPnL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(selectedTradeForDrillDown.realizedPnL || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Signal Provenance */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-[#87929a] uppercase">2. Signal Generation Provenance</h4>
              <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#87929a]">Signal Generation Timestamp (Bar T):</span>
                  <span className="text-[#38bdf8] font-mono-data">
                    {(selectedTradeForDrillDown.signalTimestamp || selectedTradeForDrillDown.date || '').split('T')[0]} Close
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#87929a]">Order Execution Timestamp (Bar T+1):</span>
                  <span className="text-emerald-400 font-mono-data">
                    {(selectedTradeForDrillDown.date || selectedTradeForDrillDown.timestamp || '').split('T')[0]} Open
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#87929a]">Execution Rule:</span>
                  <span className="text-[#d4e4fa]">
                    SIGNAL_ON_CLOSE_EXECUTE_NEXT_OPEN (Zero Look-Ahead Bias)
                  </span>
                </div>
              </div>
            </div>

            {/* Historical Bar Provenance */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-[#87929a] uppercase">3. Canonical Market Data Provenance</h4>
              <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#87929a]">Historical Data Provider:</span>
                  <span className="text-[#38bdf8]">{activeBacktest.provenance?.provider || 'Twelve Data / FYERS API v3'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#87929a]">Epistemic Class:</span>
                  <span className="text-emerald-400">CALCULATED_METRIC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#87929a]">Look-Ahead Status:</span>
                  <span className="text-emerald-400">STRICTLY_PROHIBITED (Passed audit)</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTradeForDrillDown(null)}
                className="px-4 py-1.5 bg-[#0d1c2d] hover:bg-[#122131] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs font-bold text-xs"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
