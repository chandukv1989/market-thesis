import React, { useState } from 'react';

interface EquityPoint {
  date: string;
  strategy: number;
  benchmark: number;
  drawdown: number;
}

interface EquityChartProps {
  data: EquityPoint[];
  height?: number;
  showDrawdown?: boolean;
}

export const EquityCurveChart: React.FC<EquityChartProps> = ({
  data,
  height = 240,
  showDrawdown = false
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const minVal = Math.min(...data.map(d => Math.min(d.strategy, d.benchmark))) * 0.95;
  const maxVal = Math.max(...data.map(d => Math.max(d.strategy, d.benchmark))) * 1.05;

  const width = 800;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

  const strategyPoints = data.map((d, i) => `${getX(i)},${getY(d.strategy)}`).join(' ');
  const benchmarkPoints = data.map((d, i) => `${getX(i)},${getY(d.benchmark)}`).join(' ');

  // Strategy area under curve
  const areaPoints = `${getX(0)},${padding.top + chartHeight} ${strategyPoints} ${getX(data.length - 1)},${padding.top + chartHeight}`;

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];

  return (
    <div className="relative w-full overflow-hidden bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm p-3">
      {/* Legend & Hover tooltip header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2 pb-2 border-b border-[#1c2b3c] text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#38bdf8]" />
            <span className="text-[#87929a] font-mono-data">Strategy:</span>
            <span className="font-mono-data font-semibold text-[#38bdf8]">
              ${hoveredData.strategy.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#94a3b8]" />
            <span className="text-[#87929a] font-mono-data">Benchmark (S&P 500):</span>
            <span className="font-mono-data font-semibold text-[#bdc8d1]">
              ${hoveredData.benchmark.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#87929a] font-mono-data">Alpha:</span>
            <span className="font-mono-data font-semibold text-[#34d399]">
              +{(
                ((hoveredData.strategy - hoveredData.benchmark) / hoveredData.benchmark) *
                100
              ).toFixed(1)}
              %
            </span>
          </div>
        </div>
        <div className="text-[11px] font-mono-data text-[#87929a]">
          Date: <span className="text-[#d4e4fa] font-medium">{hoveredData.date}</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + chartHeight * ratio;
          const val = maxVal - ratio * (maxVal - minVal);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1c2b3c"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                fill="#87929a"
                fontSize="10"
                fontFamily="JetBrains Mono"
                textAnchor="end"
              >
                ${(val / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => {
          const index = data.findIndex(item => item.date === d.date);
          const x = getX(index);
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              fill="#87929a"
              fontSize="10"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
            >
              {d.date}
            </text>
          );
        })}

        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#stratGrad)" />

        {/* Benchmark line */}
        <polyline
          fill="none"
          stroke="#64748b"
          strokeWidth="1.75"
          strokeDasharray="4 3"
          points={benchmarkPoints}
        />

        {/* Strategy line */}
        <polyline
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          points={strategyPoints}
        />

        {/* Interactive hover overlay columns */}
        {data.map((_, i) => {
          const x = getX(i);
          const colWidth = chartWidth / data.length;
          return (
            <rect
              key={i}
              x={x - colWidth / 2}
              y={padding.top}
              width={colWidth}
              height={chartHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}

        {/* Active hover crosshair & dots */}
        {hoverIndex !== null && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={padding.top + chartHeight}
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(data[hoverIndex].strategy)}
              r="4"
              fill="#38bdf8"
              stroke="#051424"
              strokeWidth="2"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(data[hoverIndex].benchmark)}
              r="3.5"
              fill="#94a3b8"
              stroke="#051424"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* Optional Drawdown Panel */}
      {showDrawdown && (
        <div className="mt-3 pt-3 border-t border-[#1c2b3c]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono-data text-[#87929a] uppercase text-[10px]">
              Underwater Drawdown Profile
            </span>
            <span className="font-mono-data text-xs text-[#f43f5e]">
              Peak Drawdown: {hoveredData.drawdown.toFixed(1)}%
            </span>
          </div>
          <svg viewBox={`0 0 ${width} 60`} className="w-full h-12">
            {data.map((d, i) => {
              const x = getX(i);
              const barWidth = Math.max(2, chartWidth / data.length - 1);
              const barH = (Math.abs(d.drawdown) / 20) * 45;
              return (
                <rect
                  key={i}
                  x={x - barWidth / 2}
                  y={5}
                  width={barWidth}
                  height={Math.max(1, barH)}
                  fill="#f43f5e"
                  opacity={i === hoverIndex ? 0.9 : 0.6}
                />
              );
            })}
            <line
              x1={padding.left}
              y1={5}
              x2={width - padding.right}
              y2={5}
              stroke="#3e484f"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export interface DrawdownChartProps {
  data: { date: string; drawdownPct: number }[];
  height?: number;
}

export const DrawdownChart: React.FC<DrawdownChartProps> = ({
  data,
  height = 160
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm p-4 text-center text-xs font-mono-data text-[#87929a]">
        No drawdown data available for this range.
      </div>
    );
  }

  // Drawdown values are non-positive: 0 to -max
  const maxDD = Math.max(0.1, ...data.map(d => Math.abs(d.drawdownPct || 0)));
  const width = 800;
  const padding = { top: 20, right: 30, bottom: 25, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (index: number) => padding.left + (index / Math.max(1, data.length - 1)) * chartWidth;
  // 0% drawdown is at y = padding.top, -maxDD is at y = padding.top + chartHeight
  const getY = (ddPct: number) => padding.top + (Math.abs(ddPct) / maxDD) * chartHeight;

  const linePoints = data.map((d, i) => `${getX(i)},${getY(d.drawdownPct || 0)}`).join(' ');
  const areaPoints = `${getX(0)},${padding.top} ${linePoints} ${getX(data.length - 1)},${padding.top}`;

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];

  return (
    <div className="relative w-full overflow-hidden bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 pb-2 border-b border-[#1c2b3c] text-xs font-mono-data">
        <div className="flex items-center gap-3">
          <span className="text-[#87929a] uppercase text-[10px] tracking-wide">
            Underwater Drawdown Curve
          </span>
          <span className="text-rose-400 font-bold">
            Drawdown: {hoveredData ? (-Math.abs(hoveredData.drawdownPct || 0)).toFixed(2) : 0}%
          </span>
          <span className="text-[#87929a] text-[11px]">
            (Max: -{maxDD.toFixed(2)}%)
          </span>
        </div>
        <div className="text-[11px] text-[#87929a]">
          Date: <span className="text-[#d4e4fa] font-medium">{hoveredData?.date}</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + chartHeight * ratio;
          const pctVal = -(ratio * maxDD);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1c2b3c"
                strokeDasharray={ratio === 0 ? undefined : '3 3'}
                strokeWidth={ratio === 0 ? 1.5 : 1}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fill="#87929a"
                fontSize="10"
                fontFamily="JetBrains Mono"
                textAnchor="end"
              >
                {pctVal.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* Date labels on X axis */}
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => {
          const idx = data.findIndex(item => item.date === d.date);
          return (
            <text
              key={i}
              x={getX(idx)}
              y={height - 6}
              fill="#87929a"
              fontSize="10"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
            >
              {d.date}
            </text>
          );
        })}

        {/* Underwater Area fill */}
        <polygon points={areaPoints} fill="url(#drawdownGrad)" />

        {/* Drawdown line */}
        <polyline
          fill="none"
          stroke="#f43f5e"
          strokeWidth="2"
          points={linePoints}
        />

        {/* 0% baseline */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={width - padding.right}
          y2={padding.top}
          stroke="#475569"
          strokeWidth="1.5"
        />

        {/* Interactive hover overlay */}
        {data.map((_, i) => {
          const x = getX(i);
          const colWidth = chartWidth / data.length;
          return (
            <rect
              key={i}
              x={x - colWidth / 2}
              y={padding.top}
              width={colWidth}
              height={chartHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}

        {/* Hover crosshair */}
        {hoverIndex !== null && data[hoverIndex] && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={padding.top + chartHeight}
              stroke="#f43f5e"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(data[hoverIndex].drawdownPct || 0)}
              r="4"
              fill="#f43f5e"
              stroke="#051424"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

interface FinancialBarsProps {
  quarters: {
    period: string;
    revenue: number;
    grossMarginPct: number;
    netIncome: number;
    freeCashFlow: number;
  }[];
}

export const FinancialQuarterlyChart: React.FC<FinancialBarsProps> = ({ quarters }) => {
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'freeCashFlow' | 'grossMarginPct'>('revenue');

  const maxVal = Math.max(
    ...quarters.map(q => (activeMetric === 'grossMarginPct' ? q.grossMarginPct : q[activeMetric]))
  );

  return (
    <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-xs font-semibold text-[#d4e4fa] tracking-wide">
          Quarterly Progression Breakdown
        </div>
        <div className="flex items-center gap-1 bg-[#051424] border border-[#1c2b3c] rounded-sm p-0.5 text-xs font-mono-data">
          <button
            onClick={() => setActiveMetric('revenue')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              activeMetric === 'revenue'
                ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                : 'text-[#87929a] hover:text-[#d4e4fa]'
            }`}
          >
            Revenue ($B)
          </button>
          <button
            onClick={() => setActiveMetric('freeCashFlow')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              activeMetric === 'freeCashFlow'
                ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                : 'text-[#87929a] hover:text-[#d4e4fa]'
            }`}
          >
            Free Cash Flow ($B)
          </button>
          <button
            onClick={() => setActiveMetric('grossMarginPct')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              activeMetric === 'grossMarginPct'
                ? 'bg-[#38bdf8] text-[#051424] font-semibold'
                : 'text-[#87929a] hover:text-[#d4e4fa]'
            }`}
          >
            Gross Margin (%)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 items-end pt-4 h-40">
        {quarters.map((q, idx) => {
          const val = activeMetric === 'grossMarginPct' ? q.grossMarginPct : q[activeMetric];
          const heightPct = Math.max(15, (val / maxVal) * 100);

          return (
            <div key={idx} className="flex flex-col items-center h-full justify-end group">
              <div className="font-mono-data text-[11px] text-[#38bdf8] mb-1 font-semibold group-hover:scale-110 transition-transform">
                {activeMetric === 'grossMarginPct' ? `${val.toFixed(1)}%` : `$${val.toFixed(1)}B`}
              </div>
              <div
                className="w-full max-w-[48px] bg-gradient-to-t from-[#38bdf8]/30 to-[#38bdf8] rounded-t-xs border-t border-x border-[#38bdf8] transition-all group-hover:brightness-125"
                style={{ height: `${heightPct}%` }}
              />
              <div className="text-[10px] font-mono-data text-[#87929a] mt-1.5 whitespace-nowrap">
                {q.period}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
