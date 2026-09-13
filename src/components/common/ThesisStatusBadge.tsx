import React from 'react';
import { ThesisStatus } from '../../types';
import { CheckCircle2, TrendingUp, AlertTriangle, AlertOctagon, XCircle } from 'lucide-react';

interface ThesisStatusBadgeProps {
  status: ThesisStatus;
  size?: 'sm' | 'md';
}

export const ThesisStatusBadge: React.FC<ThesisStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getMeta = () => {
    switch (status) {
      case 'Healthy':
        return {
          label: 'Healthy',
          icon: CheckCircle2,
          classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400'
        };
      case 'Improving':
        return {
          label: 'Improving',
          icon: TrendingUp,
          classes: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          dot: 'bg-sky-400'
        };
      case 'Watch':
        return {
          label: 'Watch',
          icon: AlertTriangle,
          classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400'
        };
      case 'Deteriorating':
        return {
          label: 'Deteriorating',
          icon: AlertOctagon,
          classes: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          dot: 'bg-orange-400'
        };
      case 'Thesis Broken':
        return {
          label: 'Thesis Broken',
          icon: XCircle,
          classes: 'bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse',
          dot: 'bg-rose-500'
        };
    }
  };

  const meta = getMeta();
  const Icon = meta.icon;

  const sizeStyle = size === 'sm' 
    ? 'text-[11px] px-2 py-0.5' 
    : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono-data font-medium border rounded-sm ${meta.classes} ${sizeStyle}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{meta.label}</span>
    </span>
  );
};
