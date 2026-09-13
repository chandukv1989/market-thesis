import React from 'react';
import {
  LayoutDashboard,
  Compass,
  FileSearch,
  Briefcase,
  Layers,
  LineChart,
  Eye,
  Bell,
  Cpu,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ActiveScreen } from '../types';

interface SidebarProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  unreadAlertsCount: number;
  selectedTicker: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  unreadAlertsCount,
  selectedTicker,
  isCollapsed,
  onToggleCollapse
}) => {
  const navItems = [
    { id: 'dashboard' as ActiveScreen, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'discover' as ActiveScreen, label: 'Discover', icon: Compass },
    {
      id: 'deep-dive' as ActiveScreen,
      label: `Deep Dive (${selectedTicker})`,
      icon: Cpu,
      highlight: true
    },
    { id: 'portfolio' as ActiveScreen, label: 'Portfolio', icon: Briefcase },
    { id: 'strategies' as ActiveScreen, label: 'Strategies', icon: Layers },
    { id: 'backtesting' as ActiveScreen, label: 'Backtesting', icon: LineChart },
    { id: 'research' as ActiveScreen, label: 'Research & RAG', icon: BookOpen },
    { id: 'watchlist' as ActiveScreen, label: 'Watchlist', icon: Eye },
    {
      id: 'alerts' as ActiveScreen,
      label: 'Alerts',
      icon: Bell,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined
    }
  ];

  return (
    <aside
      className={`relative flex flex-col justify-between bg-[#090d14] border-r border-[#1c2b3c] transition-all duration-200 select-none z-20 ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div>
        {/* Workspace Brand / Header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-[#1c2b3c]">
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-xs bg-[#38bdf8] flex items-center justify-center text-[#051424] font-bold text-xs">
                II
              </div>
              <div className="leading-tight truncate">
                <div className="font-semibold text-xs text-[#d4e4fa] tracking-wider uppercase">
                  INVESTMENT INTEL
                </div>
                <div className="text-[10px] text-[#87929a] font-mono-data">TERMINAL V0</div>
              </div>
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1 text-[#87929a] hover:text-[#d4e4fa] hover:bg-[#1c2b3c] rounded-xs transition-colors mx-auto"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`relative flex items-center w-full px-2.5 py-2 rounded-xs text-xs font-mono-data transition-all group ${
                  isActive
                    ? 'bg-[#122131] text-[#38bdf8] border-l-2 border-[#38bdf8] font-semibold'
                    : 'text-[#87929a] hover:text-[#d4e4fa] hover:bg-[#0d1c2d]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#38bdf8]' : 'text-[#87929a] group-hover:text-[#d4e4fa]'
                  }`}
                />
                {!isCollapsed && (
                  <span className="ml-2.5 truncate flex-1 text-left">{item.label}</span>
                )}
                {!isCollapsed && item.badge && (
                  <span className="ml-auto px-1.5 py-0.2 bg-[#f43f5e] text-white text-[10px] font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
                {isCollapsed && item.badge && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#f43f5e] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Terminal Info & Epistemic Disclaimer */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-[#1c2b3c] bg-[#051424]/60 text-[10px] font-mono-data text-[#87929a] space-y-1.5">
          <div className="text-[#38bdf8] font-semibold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
            DECISION SUPPORT ONLY
          </div>
          <p className="leading-tight text-[#87929a]">
            Non-deterministic outputs. Not financial advice. Zero guaranteed returns.
          </p>
          <div className="text-[#3e484f] pt-1">SEC EDGAR • FACTSET SIM</div>
        </div>
      ) : (
        <div className="p-2 border-t border-[#1c2b3c] flex justify-center text-[10px] text-[#38bdf8]">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8]" title="Decision Support System" />
        </div>
      )}
    </aside>
  );
};
