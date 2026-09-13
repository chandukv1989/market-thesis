import React, { useState, useEffect } from 'react';
import {
  EvidenceSource,
  Stock,
  SecurityIdentifier,
  PortfolioData,
  ResearchResponse,
  ResearchEpistemicClassification,
  ResearchNotebook,
  ResearchSourceItem,
  SourceCoverage,
  ResearchSnapshot,
  ResearchQueryType,
  ResearchSourceFilter
} from '../types';
import { ProvenanceBadge } from './common/ProvenanceBadge';
import { financialClient } from '../services/financialDataService';
import { CANONICAL_SECURITIES } from '../data/canonicalSecurities';
import { ResearchDocumentsPanel } from './research/ResearchDocumentsPanel';
import { DocumentCitationModal } from './research/DocumentCitationModal';
import {
  Search,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Cpu,
  RefreshCw,
  BookOpen,
  Calendar,
  TrendingUp,
  TrendingDown,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  History,
  Eye,
  FileText,
  Upload,
  FileSpreadsheet
} from 'lucide-react';

interface ResearchWorkspaceViewProps {
  onOpenEvidence: (evidence: EvidenceSource) => void;
  onSelectStock: (ticker: string) => void;
  stocks: Stock[];
  activeResearchContext?: { query: string; securities: SecurityIdentifier[] } | null;
  portfolio?: PortfolioData;
}

export const ResearchWorkspaceView: React.FC<ResearchWorkspaceViewProps> = ({
  onOpenEvidence,
  onSelectStock,
  stocks,
  activeResearchContext,
  portfolio
}) => {
  // Security & Date boundaries
  const [selectedSecurity, setSelectedSecurity] = useState<SecurityIdentifier>(
    CANONICAL_SECURITIES[0] // Default to NVDA
  );
  const [asOfDateInput, setAsOfDateInput] = useState<string>('');
  const [queryInput, setQueryInput] = useState<string>('');
  const [selectedQueryType, setSelectedQueryType] = useState<ResearchQueryType>('INVESTMENT_THESIS');

  // Notebook State
  const [activeNotebook, setActiveNotebook] = useState<ResearchNotebook | null>(null);
  const [coverage, setCoverage] = useState<SourceCoverage | null>(null);
  const [sources, setSources] = useState<ResearchSourceItem[]>([]);
  const [snapshots, setSnapshots] = useState<ResearchSnapshot[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<ResearchSnapshot | null>(null);

  // UI Panels
  const [showSourcesDrawer, setShowSourcesDrawer] = useState<boolean>(false);
  const [showCoverageDrawer, setShowCoverageDrawer] = useState<boolean>(false);
  const [showSnapshotsDrawer, setShowSnapshotsDrawer] = useState<boolean>(false);
  const [showDocumentsDrawer, setShowDocumentsDrawer] = useState<boolean>(false);
  const [documentsCount, setDocumentsCount] = useState<number>(0);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<ResearchSourceFilter>('ALL');
  const [selectedEvidenceDetail, setSelectedEvidenceDetail] = useState<string | null>(null);

  // Citation modal state
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState<boolean>(false);

  // Execution states
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [engineHealth, setEngineHealth] = useState<{ engine: string; isConfigured: boolean } | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | ResearchEpistemicClassification>('ALL');

  // Fetch engine health on mount
  useEffect(() => {
    financialClient.getResearchEngineStatus().then(status => {
      setEngineHealth(status);
    });
  }, []);

  // Sync routed query context from global search
  useEffect(() => {
    if (activeResearchContext?.query) {
      setQueryInput(activeResearchContext.query);
      if (activeResearchContext.securities.length > 0) {
        const found = CANONICAL_SECURITIES.find(
          s => s.id === activeResearchContext.securities[0].id ||
               s.symbol === activeResearchContext.securities[0].symbol
        );
        if (found) {
          setSelectedSecurity(found);
        }
      }
    }
  }, [activeResearchContext]);

  // Load Notebook, Coverage, Sources, and Snapshots when security or asOfDate changes
  useEffect(() => {
    loadNotebookData(selectedSecurity.id, asOfDateInput);
  }, [selectedSecurity.id, asOfDateInput]);

  const loadNotebookData = async (securityId: string, asOfDate?: string) => {
    try {
      setErrorMessage(null);
      const [nb, cov, srcList, snapList, docList] = await Promise.all([
        financialClient.getResearchNotebook(securityId, asOfDate || undefined),
        financialClient.getNotebookCoverage(securityId, asOfDate || undefined),
        financialClient.getNotebookSources(securityId, asOfDate || undefined),
        financialClient.getNotebookSnapshots(securityId),
        financialClient.getDocuments(securityId).catch(() => [])
      ]);

      setActiveNotebook(nb);
      setCoverage(cov);
      setSources(srcList);
      setSnapshots(snapList);
      setDocumentsCount(docList.length);

      // If snapshots exist, select the latest one
      if (snapList.length > 0 && !activeSnapshot) {
        setActiveSnapshot(snapList[snapList.length - 1]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handleExecuteResearch = async (overrideQueryType?: ResearchQueryType) => {
    const qType = overrideQueryType || selectedQueryType;
    setIsExecuting(true);
    setErrorMessage(null);
    setSelectedEvidenceDetail(null);

    try {
      const portfolioContext = portfolio ? {
        holdings: portfolio.holdings.map(h => ({
          securityId: h.ticker,
          symbol: h.ticker,
          shares: h.shares,
          averageCost: h.avgCost,
          currentPrice: h.currentPrice,
          weightPct: h.weight,
          unrealizedPnL: h.unrealizedPnL
        })),
        totalNav: portfolio.totalValue
      } : undefined;

      const snapshot = await financialClient.executeResearchNotebook(selectedSecurity.id, {
        queryType: qType,
        customQuery: queryInput.trim() || undefined,
        asOfDate: asOfDateInput.trim() || undefined,
        portfolioContext,
        sourceFilter: selectedSourceFilter !== 'ALL' ? selectedSourceFilter : undefined
      });

      setActiveSnapshot(snapshot);
      // Refresh notebook & snapshots list
      loadNotebookData(selectedSecurity.id, asOfDateInput);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  const researchPresets: { type: ResearchQueryType; label: string; desc: string }[] = [
    { type: 'INVESTMENT_THESIS', label: 'Investment Thesis', desc: 'Core thesis, moats & catalysts' },
    { type: 'BULL_CASE', label: 'Bull Case', desc: 'Verifiable upside vectors' },
    { type: 'BEAR_CASE', label: 'Bear Case', desc: 'Downside risks & headwinds' },
    { type: 'CATALYSTS', label: 'Catalysts', desc: 'Near-term corporate events' },
    { type: 'RISK', label: 'Filing Risks', desc: 'SEC EDGAR disclosed threats' },
    { type: 'QUANT_SIGNAL_EXPLANATION', label: 'Quant Signals', desc: 'Momentum & rule alignment' },
    { type: 'FUNDAMENTAL_ANALYSIS', label: 'Fundamentals', desc: 'Balance sheet & operating margin' },
    { type: 'RECENT_CHANGES', label: 'What Changed', desc: 'Sequential delta vs prior state' }
  ];

  const getCoverageBadge = (status?: SourceCoverage['status']) => {
    switch (status) {
      case 'HIGH_EVIDENCE_COVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono-data font-bold rounded-xs bg-emerald-950/70 border border-emerald-500/60 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            HIGH COVERAGE (3+ SOURCES)
          </span>
        );
      case 'MODERATE_EVIDENCE_COVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono-data font-bold rounded-xs bg-sky-950/70 border border-sky-500/60 text-sky-400">
            <ShieldCheck className="w-3 h-3" />
            MODERATE COVERAGE (2 SOURCES)
          </span>
        );
      case 'LIMITED_EVIDENCE_COVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono-data font-bold rounded-xs bg-amber-950/70 border border-amber-500/60 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            LIMITED COVERAGE
          </span>
        );
      case 'INSUFFICIENT_EVIDENCE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono-data font-bold rounded-xs bg-rose-950/70 border border-rose-500/60 text-rose-400">
            <AlertTriangle className="w-3 h-3" />
            INSUFFICIENT EVIDENCE
          </span>
        );
    }
  };

  const getBadgeForClassification = (cls: ResearchEpistemicClassification) => {
    switch (cls) {
      case 'FACT':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-emerald-950/60 border border-emerald-500/50 text-emerald-400">
            <CheckCircle2 className="w-2.5 h-2.5" />
            FACT
          </span>
        );
      case 'INFERENCE':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-sky-950/60 border border-sky-500/50 text-sky-400">
            <Sparkles className="w-2.5 h-2.5" />
            INFERENCE
          </span>
        );
      case 'UNCERTAINTY':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-amber-950/60 border border-amber-500/50 text-amber-400">
            <HelpCircle className="w-2.5 h-2.5" />
            UNCERTAINTY
          </span>
        );
      case 'SIMULATED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-purple-950/60 border border-purple-500/50 text-purple-400">
            <AlertTriangle className="w-2.5 h-2.5" />
            SIMULATED
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-zinc-900 border border-zinc-600 text-zinc-400">
            <Info className="w-2.5 h-2.5" />
            UNAVAILABLE
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto font-sans">
      {/* Top Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#38bdf8]" />
            <h1 className="text-base sm:text-lg font-bold text-[#d4e4fa] tracking-wider uppercase font-mono-data">
              INVESTMENT RESEARCH NOTEBOOK
            </h1>
            <span className="text-xs font-mono-data text-[#87929a] px-2 py-0.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs">
              PHASE 13 INTELLIGENCE
            </span>
          </div>
          <p className="text-xs text-[#87929a] mt-0.5">
            Point-in-time thesis synthesis, audited SEC EDGAR corpus, verifiable bull/bear cases, and what-changed tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-sm text-xs font-mono-data">
          <ShieldCheck className="w-4 h-4 text-[#34d399]" />
          <span className="text-[#34d399]">Epistemic Segregation</span>
          {engineHealth?.isConfigured ? (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-[#052e16] border border-[#16a34a] text-[#4ade80] rounded-xs font-bold">
              GEMINI 2.5 FLASH
            </span>
          ) : (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-[#2a1708] border border-[#b45309] text-[#f59e0b] rounded-xs font-bold">
              DETERMINISTIC FALLBACK
            </span>
          )}
        </div>
      </div>

      {/* Security Selector & PIT Boundary Control Bar */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Security dropdown / picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono-data text-[#87929a] uppercase font-bold">
              Security:
            </span>
            <select
              value={selectedSecurity.id}
              onChange={e => {
                const found = CANONICAL_SECURITIES.find(s => s.id === e.target.value);
                if (found) {
                  setSelectedSecurity(found);
                  setActiveSnapshot(null);
                }
              }}
              className="px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] text-xs font-mono-data rounded-sm focus:outline-none focus:border-[#38bdf8]"
            >
              {CANONICAL_SECURITIES.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.symbol} — {sec.companyName} ({sec.market} • {sec.exchange})
                </option>
              ))}
            </select>

            <button
              onClick={() => onSelectStock(selectedSecurity.symbol)}
              className="px-2.5 py-1 bg-[#0d1c2d] hover:bg-[#1c2b3c] border border-[#1c2b3c] hover:border-[#38bdf8] text-[#7bd0ff] text-xs font-mono-data rounded-xs flex items-center gap-1 transition-colors"
              title="Open Full Stock Terminal Deep Dive"
            >
              <span>Terminal Deep Dive</span>
              <ExternalLink className="w-3 h-3 text-[#38bdf8]" />
            </button>
          </div>

          {/* Point-in-time boundary */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono-data text-[#87929a] uppercase font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#38bdf8]" />
              Research As-Of Date:
            </span>
            <input
              type="date"
              value={asOfDateInput}
              onChange={e => {
                setAsOfDateInput(e.target.value);
                setActiveSnapshot(null);
              }}
              placeholder="YYYY-MM-DD (Latest)"
              className="px-2.5 py-1 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] text-xs font-mono-data rounded-sm focus:outline-none focus:border-[#38bdf8]"
            />
            {asOfDateInput && (
              <button
                onClick={() => setAsOfDateInput('')}
                className="text-[10px] font-mono-data text-[#87929a] hover:text-[#d4e4fa] underline"
              >
                Clear (Today)
              </button>
            )}
          </div>
        </div>

        {/* Notebook Summary & Drawer Toggles */}
        {activeNotebook && (
          <div className="pt-3 border-t border-[#1c2b3c] flex flex-wrap items-center justify-between gap-2 text-xs font-mono-data">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[#38bdf8] font-bold">
                {selectedSecurity.symbol}
              </span>
              <span className="text-[#87929a]">
                {selectedSecurity.companyName}
              </span>
              <span className="text-[#87929a]">
                [{selectedSecurity.sector} • {selectedSecurity.market}]
              </span>
              {getCoverageBadge(coverage?.status)}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setShowDocumentsDrawer(!showDocumentsDrawer);
                  setShowSourcesDrawer(false);
                  setShowCoverageDrawer(false);
                  setShowSnapshotsDrawer(false);
                }}
                className={`px-2.5 py-1 rounded-xs border text-[11px] flex items-center gap-1.5 transition-colors ${
                  showDocumentsDrawer
                    ? 'bg-[#38bdf8] text-[#051424] border-[#38bdf8] font-bold'
                    : 'bg-[#0d1c2d] text-[#7bd0ff] border-[#1c2b3c] hover:border-[#38bdf8]'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>User Documents ({documentsCount})</span>
                {showDocumentsDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                onClick={() => {
                  setShowSourcesDrawer(!showSourcesDrawer);
                  setShowCoverageDrawer(false);
                  setShowSnapshotsDrawer(false);
                  setShowDocumentsDrawer(false);
                }}
                className={`px-2.5 py-1 rounded-xs border text-[11px] flex items-center gap-1.5 transition-colors ${
                  showSourcesDrawer
                    ? 'bg-[#38bdf8] text-[#051424] border-[#38bdf8] font-bold'
                    : 'bg-[#0d1c2d] text-[#7bd0ff] border-[#1c2b3c] hover:border-[#38bdf8]'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>Source Corpus ({sources.length})</span>
                {showSourcesDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                onClick={() => {
                  setShowCoverageDrawer(!showCoverageDrawer);
                  setShowSourcesDrawer(false);
                  setShowSnapshotsDrawer(false);
                  setShowDocumentsDrawer(false);
                }}
                className={`px-2.5 py-1 rounded-xs border text-[11px] flex items-center gap-1.5 transition-colors ${
                  showCoverageDrawer
                    ? 'bg-[#38bdf8] text-[#051424] border-[#38bdf8] font-bold'
                    : 'bg-[#0d1c2d] text-[#7bd0ff] border-[#1c2b3c] hover:border-[#38bdf8]'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Coverage Gaps</span>
                {showCoverageDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                onClick={() => {
                  setShowSnapshotsDrawer(!showSnapshotsDrawer);
                  setShowSourcesDrawer(false);
                  setShowCoverageDrawer(false);
                  setShowDocumentsDrawer(false);
                }}
                className={`px-2.5 py-1 rounded-xs border text-[11px] flex items-center gap-1.5 transition-colors ${
                  showSnapshotsDrawer
                    ? 'bg-[#38bdf8] text-[#051424] border-[#38bdf8] font-bold'
                    : 'bg-[#0d1c2d] text-[#7bd0ff] border-[#1c2b3c] hover:border-[#38bdf8]'
                }`}
              >
                <History className="w-3 h-3" />
                <span>Snapshots ({snapshots.length})</span>
                {showSnapshotsDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer 0: User Grounded Research Documents */}
      {showDocumentsDrawer && (
        <ResearchDocumentsPanel
          selectedSecurity={selectedSecurity}
          onDocumentsChanged={() => loadNotebookData(selectedSecurity.id, asOfDateInput)}
        />
      )}

      {/* Drawer 1: Source Registry */}
      {showSourcesDrawer && (
        <div className="p-4 bg-[#091522] border border-[#38bdf8]/40 rounded-sm space-y-3 font-mono-data text-xs">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
            <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Source Registry Corpus for {selectedSecurity.symbol}
            </span>
            <span className="text-[11px] text-[#87929a]">
              {sources.filter(s => s.availabilityStatus === 'AVAILABLE').length} Available • {sources.filter(s => s.availabilityStatus === 'UNAVAILABLE').length} Unavailable
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sources.map((src, i) => (
              <div
                key={i}
                className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#d4e4fa]">{src.title}</span>
                    <span className={`px-1.5 py-0.2 text-[9px] rounded-xs border ${
                      src.sourceType === 'RESEARCH_DOCUMENT'
                        ? 'bg-[#172e48] text-[#38bdf8] border-[#38bdf8]/60 font-bold'
                        : 'bg-[#122131] text-[#7bd0ff] border-[#1c2b3c]'
                    }`}>
                      {src.sourceType}
                    </span>
                    <span className="text-[10px] text-[#87929a]">
                      Provider: {src.provider}
                    </span>
                  </div>
                  {src.sourceReference?.accessionNumber && (
                    <div className="text-[11px] text-[#87929a]">
                      SEC Accession: <span className="text-[#7bd0ff]">{src.sourceReference.accessionNumber}</span>
                    </div>
                  )}
                  {src.filingDate && (
                    <div className="text-[10px] text-[#87929a]">
                      Filing / Doc Date: {src.filingDate}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {src.sourceType === 'RESEARCH_DOCUMENT' && (
                    <button
                      onClick={() => {
                        setSelectedCitation({
                          title: src.title,
                          originalFileName: src.sourceReference?.documentId || src.title,
                          documentType: 'RESEARCH_DOCUMENT',
                          format: 'pdf',
                          publisher: src.provider,
                          documentDate: src.filingDate,
                          uploadDate: src.filingDate,
                          snippet: `Document '${src.title}' is registered in the evidence corpus. Full chunk embeddings and hybrid vector-BM25 retrieval are enabled.`,
                          epistemicStatus: src.epistemicStatus,
                          confidence: 1.0,
                          documentId: src.sourceReference?.documentId
                        });
                        setIsCitationModalOpen(true);
                      }}
                      className="px-2 py-0.5 text-[10px] bg-[#0284c7]/20 hover:bg-[#0284c7]/40 text-[#7bd0ff] border border-[#38bdf8]/40 rounded-xs flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect Citation</span>
                    </button>
                  )}
                  {src.availabilityStatus === 'AVAILABLE' ? (
                    <span className="px-2 py-0.5 text-[9px] bg-emerald-950/70 border border-emerald-500/60 text-emerald-400 font-bold rounded-xs">
                      AVAILABLE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] bg-rose-950/70 border border-rose-500/60 text-rose-400 font-bold rounded-xs">
                      UNAVAILABLE (KYC)
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-[9px] bg-[#090d14] border border-[#1c2b3c] text-[#87929a] rounded-xs">
                    {src.epistemicStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawer 2: Coverage & Gaps */}
      {showCoverageDrawer && coverage && (
        <div className="p-4 bg-[#091522] border border-[#38bdf8]/40 rounded-sm space-y-3 font-mono-data text-xs">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
            <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Source Coverage & Disclosed Gaps ({coverage.status})
            </span>
            <span className="text-[11px] text-[#87929a]">
              Earliest: {coverage.oldestSourceDate || 'N/A'} • Latest: {coverage.latestSourceDate || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0d1c2d] border border-emerald-500/30 rounded-xs space-y-1.5">
              <div className="font-bold text-emerald-400 text-[11px] uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Available Verified Sources ({coverage.availableSources.length})
              </div>
              <ul className="space-y-1 text-[11px] text-[#d4e4fa]">
                {coverage.availableSources.map((s, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-emerald-400">✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-[#0d1c2d] border border-amber-500/30 rounded-xs space-y-1.5">
              <div className="font-bold text-amber-400 text-[11px] uppercase flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Missing Disclosures ({coverage.missingSources.length})
              </div>
              <ul className="space-y-1 text-[11px] text-[#87929a]">
                {coverage.missingSources.map((s, i) => (
                  <li key={i} className="flex items-start gap-1 text-amber-300">
                    <span>⚠</span> {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-[#0d1c2d] border border-rose-500/30 rounded-xs space-y-1.5">
              <div className="font-bold text-rose-400 text-[11px] uppercase flex items-center gap-1">
                <Info className="w-3 h-3" />
                Unavailable Providers ({coverage.unavailableProviders.length})
              </div>
              <ul className="space-y-1 text-[11px] text-[#87929a]">
                {coverage.unavailableProviders.length > 0 ? (
                  coverage.unavailableProviders.map((s, i) => (
                    <li key={i} className="flex items-start gap-1 text-rose-300">
                      <span>✕</span> {s}
                    </li>
                  ))
                ) : (
                  <li className="text-[#87929a]">None reported.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Drawer 3: Snapshots History Timeline */}
      {showSnapshotsDrawer && (
        <div className="p-4 bg-[#091522] border border-[#38bdf8]/40 rounded-sm space-y-3 font-mono-data text-xs">
          <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
            <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Historical Research Snapshots for {selectedSecurity.symbol}
            </span>
            <span className="text-[11px] text-[#87929a]">
              {snapshots.length} Snapshot(s) Recorded
            </span>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {snapshots.map((snap, i) => (
              <div
                key={snap.snapshotId}
                onClick={() => setActiveSnapshot(snap)}
                className={`p-2.5 rounded-xs border cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                  activeSnapshot?.snapshotId === snap.snapshotId
                    ? 'bg-[#172e48] border-[#38bdf8] text-[#d4e4fa]'
                    : 'bg-[#0d1c2d] border-[#1c2b3c] hover:border-[#38bdf8] text-[#87929a]'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#38bdf8] uppercase">{snap.queryType}</span>
                    <span className="text-[#d4e4fa] text-[11px] truncate max-w-xs">{snap.query}</span>
                  </div>
                  <div className="text-[10px] text-[#87929a]">
                    Snapshot ID: {snap.snapshotId} • Research As-Of: {snap.researchAsOfDate}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px]">
                  <span>{snap.evidenceIds.length} Evidence Items</span>
                  <span className="text-[#38bdf8]">
                    {new Date(snap.createdAt).toLocaleDateString()} {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {activeSnapshot?.snapshotId === snap.snapshotId && (
                    <span className="px-1.5 py-0.5 bg-[#38bdf8] text-[#051424] font-bold rounded-xs text-[9px]">
                      VIEWING
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Research Presets & Inquiry Execution Bar */}
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-3">
        {/* Preset query buttons */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono-data uppercase text-[#87929a] font-bold">
            Standard Research Analysis Protocols:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-data">
            {researchPresets.map(preset => (
              <button
                key={preset.type}
                onClick={() => {
                  setSelectedQueryType(preset.type);
                  handleExecuteResearch(preset.type);
                }}
                disabled={isExecuting}
                className={`p-2.5 rounded-xs border text-left transition-all ${
                  selectedQueryType === preset.type
                    ? 'bg-[#172e48] border-[#38bdf8] text-[#d4e4fa]'
                    : 'bg-[#0d1c2d] hover:bg-[#122131] border-[#1c2b3c] hover:border-[#38bdf8] text-[#87929a] hover:text-[#d4e4fa]'
                }`}
              >
                <div className="font-bold text-[#38bdf8] text-[11px]">{preset.label}</div>
                <div className="text-[10px] text-[#87929a] truncate">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Source Retrieval Boundary Filter */}
        <div className="pt-2 border-t border-[#1c2b3c] flex flex-wrap items-center justify-between gap-2 text-xs font-mono-data">
          <div className="flex items-center gap-1.5 text-[11px] text-[#87929a]">
            <Layers className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="uppercase font-bold">Grounded Scope:</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['ALL', 'OFFICIAL_FILINGS', 'MARKET_DATA', 'RESEARCH_DOCUMENTS', 'PORTFOLIO', 'QUANTITATIVE'] as ResearchSourceFilter[]).map(filter => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedSourceFilter(filter)}
                className={`px-2 py-0.5 rounded-xs text-[10px] transition-colors border ${
                  selectedSourceFilter === filter
                    ? 'bg-[#38bdf8] text-[#051424] border-[#38bdf8] font-bold'
                    : 'bg-[#0d1c2d] text-[#87929a] border-[#1c2b3c] hover:text-[#d4e4fa] hover:border-[#38bdf8]/50'
                }`}
              >
                {filter === 'ALL' ? 'All Sources' :
                 filter === 'OFFICIAL_FILINGS' ? 'SEC Filings' :
                 filter === 'MARKET_DATA' ? 'Market Data' :
                 filter === 'RESEARCH_DOCUMENTS' ? `Research Docs (${documentsCount})` :
                 filter === 'PORTFOLIO' ? 'Portfolio Context' : 'Quant Strategy'}
              </button>
            ))}
          </div>
        </div>

        {/* Custom inquiry bar */}
        <div className="pt-2 border-t border-[#1c2b3c] space-y-2">
          <div className="text-[11px] font-mono-data uppercase text-[#87929a] font-bold">
            Or Custom Research Inquiry:
          </div>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-[#87929a]" />
            <input
              type="text"
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleExecuteResearch()}
              placeholder={`Ask research inquiry for ${selectedSecurity.symbol} (e.g. 'Evaluate hyperscaler capex exposure and margin persistence')...`}
              className="w-full pl-9 pr-32 py-2.5 bg-[#0d1c2d] border border-[#1c2b3c] focus:border-[#38bdf8] rounded-sm text-xs font-mono-data text-[#d4e4fa] placeholder-[#87929a] focus:outline-none"
            />
            <button
              onClick={() => handleExecuteResearch()}
              disabled={isExecuting}
              className="absolute right-2 px-3.5 py-1.5 bg-[#38bdf8] hover:bg-[#7bd0ff] disabled:opacity-50 text-[#051424] font-semibold text-xs font-mono-data rounded-xs transition-colors flex items-center gap-1.5"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3 h-3" />
                  <span>Synthesize</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Animation */}
      {isExecuting && (
        <div className="p-6 bg-[#090d14] border border-[#1c2b3c] rounded-sm space-y-3 font-mono-data text-xs">
          <div className="flex items-center gap-2 text-[#38bdf8]">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="font-bold tracking-wide uppercase">RESEARCH NOTEBOOK SYNTHESIS PIPELINE ACTIVE</span>
          </div>
          <div className="space-y-1.5 pl-6 text-[#87929a]">
            <div className="text-emerald-400 flex items-center gap-1.5">
              <span className="text-[#38bdf8]">▶</span> Bounding point-in-time evidence corpus (As-Of: {asOfDateInput || 'Real-Time'})...
            </div>
            <div className="text-emerald-400 flex items-center gap-1.5">
              <span className="text-[#38bdf8]">▶</span> Loading quantitative signals from QuantStrategyEngine...
            </div>
            <div className="text-emerald-400 flex items-center gap-1.5">
              <span className="text-[#38bdf8]">▶</span> Inspecting portfolio holdings & marginal risk contribution...
            </div>
            <div className="text-sky-300 flex items-center gap-1.5 animate-pulse">
              <span className="text-[#38bdf8]">▶</span> Synthesizing bull/bear cases & what-changed delta without fabrication...
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-[#1b0d12] border border-[#f43f5e]/40 rounded-sm space-y-1">
          <div className="flex items-center gap-2 text-[#f43f5e] font-semibold text-xs font-mono-data uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>Research Synthesis Notice</span>
          </div>
          <p className="text-xs text-[#fca5a5] font-mono-data">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Structured Research Snapshot View */}
      {activeSnapshot && !isExecuting && (
        <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-5 space-y-5">
          {/* Snapshot Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-[#172e48] border border-[#38bdf8]/40 text-[#38bdf8] text-[10px] font-mono-data font-bold uppercase rounded-xs">
                  {activeSnapshot.queryType}
                </span>
                <span className="text-[11px] font-mono-data text-[#87929a]">
                  Snapshot ID: {activeSnapshot.snapshotId}
                </span>
                <span className="text-[11px] font-mono-data text-[#87929a]">
                  • Point-in-Time As-Of: <span className="text-[#7bd0ff] font-bold">{activeSnapshot.researchAsOfDate}</span>
                </span>
                <span className="text-[11px] font-mono-data text-[#87929a]">
                  • Generated: {new Date(activeSnapshot.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#d4e4fa] font-mono-data">
                {selectedSecurity.symbol} — {activeSnapshot.query}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-right">
                <div className="text-[10px] font-mono-data text-[#87929a] uppercase">Grounding Evidence</div>
                <div className="text-sm font-bold font-mono-data text-[#34d399]">
                  {activeSnapshot.evidenceIds.length} Items
                </div>
              </div>
            </div>
          </div>

          {/* Executive Thesis Statement */}
          <div className="p-4 bg-[#0d1c2d] border-l-2 border-[#38bdf8] rounded-r-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono-data uppercase text-[#87929a] font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
                EXECUTIVE INVESTMENT THESIS
              </div>
              <div className="text-[10px] font-mono-data text-[#87929a]">
                Coverage: <span className="text-[#34d399] font-bold">{activeSnapshot.thesis.confidenceCoverage}</span>
              </div>
            </div>
            <p className="text-xs text-[#d4e4fa] leading-relaxed font-sans">
              {activeSnapshot.thesis.executiveThesis}
            </p>
          </div>

          {/* What Changed (Revision Comparison) */}
          <div className="p-3.5 bg-[#091522] border border-[#1c2b3c] rounded-sm space-y-3 font-mono-data text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                WHAT CHANGED (REVISION COMPARISON & THESIS IMPACT)
              </span>
              <span className={`px-2 py-0.5 text-[9px] rounded-xs font-bold ${
                activeSnapshot.thesis.whatChanged.status === 'UPDATED'
                  ? 'bg-sky-950/70 border border-sky-500/60 text-sky-400'
                  : 'bg-[#122131] border border-[#1c2b3c] text-[#87929a]'
              }`}>
                {activeSnapshot.thesis.whatChanged.status}
              </span>
            </div>

            {/* Delta metrics chips */}
            {((activeSnapshot.thesis.whatChanged.newDocumentCount ?? 0) > 0 ||
              (activeSnapshot.thesis.whatChanged.newEvidenceCount ?? 0) > 0 ||
              (activeSnapshot.thesis.whatChanged.newChunkCount ?? 0) > 0) && (
              <div className="flex items-center gap-2 flex-wrap">
                {(activeSnapshot.thesis.whatChanged.newDocumentCount ?? 0) > 0 && (
                  <span className="px-2 py-0.5 bg-[#172e48] border border-[#38bdf8]/50 text-[#38bdf8] text-[10px] rounded-xs font-bold">
                    +{activeSnapshot.thesis.whatChanged.newDocumentCount} Research Doc(s)
                  </span>
                )}
                {(activeSnapshot.thesis.whatChanged.newEvidenceCount ?? 0) > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 text-[10px] rounded-xs font-bold">
                    +{activeSnapshot.thesis.whatChanged.newEvidenceCount} Evidence Item(s)
                  </span>
                )}
                {(activeSnapshot.thesis.whatChanged.newChunkCount ?? 0) > 0 && (
                  <span className="px-2 py-0.5 bg-sky-950/60 border border-sky-500/50 text-sky-300 text-[10px] rounded-xs font-bold">
                    +{activeSnapshot.thesis.whatChanged.newChunkCount} Grounded Chunk(s)
                  </span>
                )}
              </div>
            )}

            {/* Thesis Impact Analysis (Bull / Bear shifts) */}
            {activeSnapshot.thesis.whatChanged.thesisImpact && (
              <div className="p-2.5 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#87929a] font-bold uppercase">Thesis Dynamic Impact:</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className="text-[#87929a]">Bull:</span>
                      <span className={`px-1.5 py-0.2 rounded-xs font-bold ${
                        activeSnapshot.thesis.whatChanged.thesisImpact.bullCase === 'STRENGTHENED'
                          ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-400'
                          : activeSnapshot.thesis.whatChanged.thesisImpact.bullCase === 'WEAKENED'
                          ? 'bg-rose-950/70 border border-rose-500/60 text-rose-400'
                          : 'bg-[#122131] text-[#87929a]'
                      }`}>
                        {activeSnapshot.thesis.whatChanged.thesisImpact.bullCase}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className="text-[#87929a]">Bear:</span>
                      <span className={`px-1.5 py-0.2 rounded-xs font-bold ${
                        activeSnapshot.thesis.whatChanged.thesisImpact.bearCase === 'STRENGTHENED'
                          ? 'bg-rose-950/70 border border-rose-500/60 text-rose-400'
                          : activeSnapshot.thesis.whatChanged.thesisImpact.bearCase === 'WEAKENED'
                          ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-400'
                          : 'bg-[#122131] text-[#87929a]'
                      }`}>
                        {activeSnapshot.thesis.whatChanged.thesisImpact.bearCase}
                      </span>
                    </span>
                  </div>
                </div>
                {activeSnapshot.thesis.whatChanged.thesisImpact.summary && (
                  <p className="text-[11px] text-[#d4e4fa] font-sans">
                    {activeSnapshot.thesis.whatChanged.thesisImpact.summary}
                  </p>
                )}
              </div>
            )}

            <ul className="space-y-1 pl-3 list-disc text-xs text-[#d4e4fa] font-sans">
              {activeSnapshot.thesis.whatChanged.changes.map((ch, idx) => (
                <li key={idx} className="leading-relaxed">{ch}</li>
              ))}
            </ul>

            {/* New Risks & Catalysts Detected in this revision */}
            {((activeSnapshot.thesis.whatChanged.newRisks && activeSnapshot.thesis.whatChanged.newRisks.length > 0) ||
              (activeSnapshot.thesis.whatChanged.newCatalysts && activeSnapshot.thesis.whatChanged.newCatalysts.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {activeSnapshot.thesis.whatChanged.newRisks && activeSnapshot.thesis.whatChanged.newRisks.length > 0 && (
                  <div className="p-2 bg-[#2a0e14]/60 border border-rose-500/40 rounded-xs space-y-1">
                    <span className="text-[10px] text-rose-400 font-bold uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      New Risks Disclosed:
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-[#fda4af] font-sans space-y-0.5">
                      {activeSnapshot.thesis.whatChanged.newRisks.map((nr, i) => (
                        <li key={i}>{nr}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeSnapshot.thesis.whatChanged.newCatalysts && activeSnapshot.thesis.whatChanged.newCatalysts.length > 0 && (
                  <div className="p-2 bg-[#052e16]/60 border border-emerald-500/40 rounded-xs space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      New Catalysts Identified:
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-[#86efac] font-sans space-y-0.5">
                      {activeSnapshot.thesis.whatChanged.newCatalysts.map((nc, i) => (
                        <li key={i}>{nc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeSnapshot.thesis.whatChanged.previousSnapshotDate && (
              <div className="text-[10px] text-[#87929a] pt-1 border-t border-[#1c2b3c]/60 flex items-center justify-between">
                <span>Prior Snapshot Baseline: {new Date(activeSnapshot.thesis.whatChanged.previousSnapshotDate).toLocaleString()}</span>
                {activeSnapshot.thesis.whatChanged.evidenceCoverageDelta && (
                  <span className="text-[#38bdf8]">{activeSnapshot.thesis.whatChanged.evidenceCoverageDelta}</span>
                )}
              </div>
            )}
          </div>

          {/* Verifiable Bull Case & Bear Case Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bull Case */}
            <div className="p-4 bg-[#0d1c2d] border border-emerald-500/30 rounded-xs space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="font-bold text-emerald-400 text-xs font-mono-data uppercase flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  BULL CASE & EXPANSION VECTORS
                </span>
                <span className="text-[10px] font-mono-data text-[#87929a]">
                  {activeSnapshot.thesis.bullCase.points.length} Claims
                </span>
              </div>
              <p className="text-xs text-[#87929a] font-sans italic">
                {activeSnapshot.thesis.bullCase.summary}
              </p>
              <div className="space-y-2">
                {activeSnapshot.thesis.bullCase.points.map((pt, i) => (
                  <div key={i} className="p-2.5 bg-[#091522] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      {getBadgeForClassification('FACT')}
                      <span className="text-[9px] font-mono-data text-[#38bdf8]">
                        Citation Linked
                      </span>
                    </div>
                    <p className="text-xs text-[#d4e4fa] font-sans leading-relaxed">
                      {pt}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bear Case */}
            <div className="p-4 bg-[#0d1c2d] border border-rose-500/30 rounded-xs space-y-3">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                <span className="font-bold text-rose-400 text-xs font-mono-data uppercase flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  BEAR CASE & DOWNSIDE THREATS
                </span>
                <span className="text-[10px] font-mono-data text-[#87929a]">
                  {activeSnapshot.thesis.bearCase.points.length} Claims
                </span>
              </div>
              <p className="text-xs text-[#87929a] font-sans italic">
                {activeSnapshot.thesis.bearCase.summary}
              </p>
              <div className="space-y-2">
                {activeSnapshot.thesis.bearCase.points.map((pt, i) => (
                  <div key={i} className="p-2.5 bg-[#091522] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      {getBadgeForClassification('INFERENCE')}
                      <span className="text-[9px] font-mono-data text-[#38bdf8]">
                        Citation Linked
                      </span>
                    </div>
                    <p className="text-xs text-[#d4e4fa] font-sans leading-relaxed">
                      {pt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Catalysts & Disclosed Risks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Catalysts */}
            <div className="p-4 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-3 font-mono-data text-xs">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#38bdf8]" />
                  CORPORATE CATALYSTS & TIMELINES
                </span>
                <span className="text-[10px] text-[#87929a]">
                  {activeSnapshot.catalysts.length} Tracked
                </span>
              </div>
              <div className="space-y-2">
                {activeSnapshot.catalysts.map((cat, i) => (
                  <div key={i} className="p-2.5 bg-[#091522] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#d4e4fa]">{cat.title}</span>
                      {cat.hasEvidence ? (
                        <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded-xs border border-emerald-500/40">
                          FILING EVIDENCE
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded-xs border border-amber-500/40">
                          FORWARD UNCERTAINTY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#87929a] font-sans">
                      {cat.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclosed Risks */}
            <div className="p-4 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-3 font-mono-data text-xs">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <span className="font-bold text-rose-400 uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  DISCLOSED RISKS & THREATS
                </span>
                <span className="text-[10px] text-[#87929a]">
                  {activeSnapshot.risks.length} Risks
                </span>
              </div>
              <div className="space-y-2">
                {activeSnapshot.risks.map((r, i) => (
                  <div key={i} className="p-2.5 bg-[#091522] border border-[#1c2b3c] rounded-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#d4e4fa]">{r.title}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-xs border ${
                        r.severity === 'HIGH'
                          ? 'bg-rose-950/70 border-rose-500/60 text-rose-400'
                          : 'bg-amber-950/70 border-amber-500/60 text-amber-400'
                      }`}>
                        {r.severity} SEVERITY
                      </span>
                    </div>
                    <p className="text-xs text-[#87929a] font-sans">
                      {r.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Thesis Invalidation Conditions */}
          <div className="p-3.5 bg-[#170e13] border border-rose-500/40 rounded-xs space-y-2 font-mono-data text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-bold uppercase">
              <AlertTriangle className="w-4 h-4" />
              <span>THESIS INVALIDATION CONDITIONS (FALSIFIABLE TRIGGERS)</span>
            </div>
            <ul className="space-y-1 pl-3 list-disc text-xs text-[#fca5a5] font-sans">
              {activeSnapshot.thesis.thesisInvalidationConditions.map((cond, i) => (
                <li key={i} className="leading-relaxed">{cond}</li>
              ))}
            </ul>
          </div>

          {/* Quantitative Strategy Alignment & Portfolio Context Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quantitative Context */}
            {activeSnapshot.thesis.quantitativeContext && (
              <div className="p-4 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-2.5 font-mono-data text-xs">
                <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                  <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
                    QUANT STRATEGY ALIGNMENT
                  </span>
                  <span className={`px-2 py-0.5 text-[9px] rounded-xs font-bold ${
                    activeSnapshot.thesis.quantitativeContext.signal === 'BUY'
                      ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-400'
                      : activeSnapshot.thesis.quantitativeContext.signal === 'SELL'
                      ? 'bg-rose-950/70 border border-rose-500/60 text-rose-400'
                      : 'bg-[#122131] border border-[#1c2b3c] text-[#87929a]'
                  }`}>
                    SIGNAL: {activeSnapshot.thesis.quantitativeContext.signal}
                  </span>
                </div>
                <div className="text-[11px] text-[#87929a]">
                  Strategy: <span className="text-[#d4e4fa] font-bold">{activeSnapshot.thesis.quantitativeContext.strategyName}</span>
                </div>
                <p className="text-xs text-[#d4e4fa] font-sans">
                  {activeSnapshot.thesis.quantitativeContext.backtestSummary}
                </p>
                {activeSnapshot.thesis.quantitativeContext.metrics && Object.keys(activeSnapshot.thesis.quantitativeContext.metrics).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1 text-[10px]">
                    {Object.entries(activeSnapshot.thesis.quantitativeContext.metrics).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 bg-[#090d14] border border-[#1c2b3c] rounded-xs text-[#7bd0ff]">
                        {k}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Portfolio Context */}
            {activeSnapshot.thesis.portfolioContext && (
              <div className="p-4 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs space-y-2.5 font-mono-data text-xs">
                <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                  <span className="font-bold text-[#38bdf8] uppercase flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#38bdf8]" />
                    PORTFOLIO CONTEXT & CONCENTRATION
                  </span>
                  <span className={`px-2 py-0.5 text-[9px] rounded-xs font-bold ${
                    activeSnapshot.thesis.portfolioContext.isHeld
                      ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-400'
                      : 'bg-[#122131] border border-[#1c2b3c] text-[#87929a]'
                  }`}>
                    {activeSnapshot.thesis.portfolioContext.isHeld ? 'POSITION HELD' : 'UNALLOCATED / WATCHLIST'}
                  </span>
                </div>
                {activeSnapshot.thesis.portfolioContext.isHeld ? (
                  <div className="space-y-1.5 text-xs text-[#d4e4fa]">
                    <div>Position Weight: <span className="text-[#38bdf8] font-bold">{activeSnapshot.thesis.portfolioContext.positionWeight?.toFixed(2)}%</span></div>
                    <div>Risk Contribution: <span className="text-amber-400 font-bold">{activeSnapshot.thesis.portfolioContext.riskContribution?.toFixed(2)}%</span></div>
                    <div>Shares Held: <span className="text-[#d4e4fa] font-bold">{activeSnapshot.thesis.portfolioContext.shares?.toLocaleString()}</span></div>
                  </div>
                ) : (
                  <p className="text-xs text-[#87929a] font-sans">
                    {selectedSecurity.symbol} is not currently held in the active investment portfolio. Sizing models recommend target allocation between 2.5% and 5.0% based on volatility parity.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Citation Modal */}
      <DocumentCitationModal
        isOpen={isCitationModalOpen}
        onClose={() => setIsCitationModalOpen(false)}
        citation={selectedCitation}
      />
    </div>
  );
};
