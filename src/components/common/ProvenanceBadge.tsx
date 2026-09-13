import React from 'react';
import { ProvenanceTag } from '../../types';

interface ProvenanceBadgeProps {
  tag: ProvenanceTag;
  size?: 'sm' | 'md' | 'xs';
  showDot?: boolean;
  className?: string;
  onClick?: () => void;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  tag,
  size = 'xs',
  showDot = true,
  className = '',
  onClick
}) => {
  const getStyles = () => {
    switch (tag) {
      case 'FACT':
        return {
          bg: 'bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/30',
          dot: 'bg-[#38bdf8]',
          title: 'Verified primary source filing or public disclosure'
        };
      case 'CALCULATION':
        return {
          bg: 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/30',
          dot: 'bg-[#34d399]',
          title: 'Deterministic quantitative calculation or financial formula'
        };
      case 'AI ANALYSIS':
        return {
          bg: 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/30',
          dot: 'bg-[#a78bfa]',
          title: 'Synthesized probabilistic assessment by LLM agent'
        };
      case 'RISK':
        return {
          bg: 'bg-[#f43f5e]/10 text-[#f43f5e] border-[#f43f5e]/30',
          dot: 'bg-[#f43f5e]',
          title: 'Identified downside risk vector or tail exposure'
        };
      case 'KEY CONCERN':
        return {
          bg: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
          dot: 'bg-[#f59e0b]',
          title: 'High priority vulnerability or monitoring trigger'
        };
      case 'UNCERTAINTY':
        return {
          bg: 'bg-[#94a3b8]/15 text-[#cbd5e1] border-[#94a3b8]/30',
          dot: 'bg-[#94a3b8]',
          title: 'Low certainty or wide confidence band'
        };
      case 'SOURCE':
        return {
          bg: 'bg-[#818cf8]/10 text-[#818cf8] border-[#818cf8]/30',
          dot: 'bg-[#818cf8]',
          title: 'Grounded citation reference'
        };
      default:
        return {
          bg: 'bg-slate-800/60 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          title: 'Information'
        };
    }
  };

  const style = getStyles();

  const sizeClasses = {
    xs: 'text-[10px] tracking-wider px-1.5 py-0.5',
    sm: 'text-[11px] tracking-wider px-2 py-0.5',
    md: 'text-xs tracking-wider px-2.5 py-1'
  }[size];

  return (
    <span
      title={style.title}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-mono-data font-semibold border rounded-sm uppercase select-none transition-colors ${style.bg} ${sizeClasses} ${onClick ? 'cursor-pointer hover:brightness-125' : ''} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />}
      <span>{tag}</span>
    </span>
  );
};
