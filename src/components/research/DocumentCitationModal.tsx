import React from 'react';
import {
  FileText,
  X,
  Calendar,
  User,
  Building,
  Hash,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { ResearchDocument, ResearchEpistemicClassification } from '../../types';

interface DocumentCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: {
    title: string;
    originalFileName?: string;
    documentType?: string;
    format?: string;
    author?: string;
    publisher?: string;
    documentDate?: string;
    uploadDate?: string;
    pageNumber?: number;
    rowNumber?: number;
    sectionTitle?: string;
    snippet: string;
    epistemicStatus?: string;
    confidence?: number;
    documentId?: string;
  } | null;
}

export const DocumentCitationModal: React.FC<DocumentCitationModalProps> = ({
  isOpen,
  onClose,
  citation
}) => {
  if (!isOpen || !citation) return null;

  const renderEpistemicBadge = (status?: string) => {
    switch (status) {
      case 'FACT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono-data font-bold rounded-xs bg-emerald-950/80 border border-emerald-500/60 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            FACT
          </span>
        );
      case 'INFERENCE':
      case 'ANALYST_INFERENCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono-data font-bold rounded-xs bg-sky-950/80 border border-sky-500/60 text-sky-400">
            <Sparkles className="w-3 h-3" />
            INFERENCE
          </span>
        );
      case 'OPINION':
      case 'ANALYST_OPINION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono-data font-bold rounded-xs bg-amber-950/80 border border-amber-500/60 text-amber-400">
            <HelpCircle className="w-3 h-3" />
            ANALYST OPINION
          </span>
        );
      case 'UNCERTAINTY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono-data font-bold rounded-xs bg-rose-950/80 border border-rose-500/60 text-rose-400">
            <AlertTriangle className="w-3 h-3" />
            UNCERTAINTY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono-data font-bold rounded-xs bg-zinc-900 border border-zinc-700 text-zinc-300">
            <Info className="w-3 h-3" />
            {status || 'DOCUMENT'}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-md max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2b3c] bg-[#0d1c2d]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1c2b3c]/60 rounded-xs border border-[#38bdf8]/30">
              <FileText className="w-4 h-4 text-[#38bdf8]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#d4e4fa] font-mono-data tracking-wide">
                DOCUMENT CITATION & PROVENANCE
              </h2>
              <p className="text-[11px] text-[#87929a]">
                Structured verification quote with auditable source tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#87929a] hover:text-[#d4e4fa] hover:bg-[#1c2b3c] rounded-xs transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Document Title and Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1c2b3c]">
            <div>
              <h3 className="text-base font-semibold text-[#d4e4fa]">
                {citation.title}
              </h3>
              {citation.originalFileName && citation.originalFileName !== citation.title && (
                <p className="text-xs font-mono-data text-[#87929a] mt-0.5">
                  File: {citation.originalFileName}
                </p>
              )}
            </div>
            <div>{renderEpistemicBadge(citation.epistemicStatus)}</div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-[#0d1c2d]/50 border border-[#1c2b3c] rounded-xs text-xs font-mono-data">
            {citation.format && (
              <div>
                <span className="text-[#87929a] block text-[10px] uppercase">Format</span>
                <span className="text-[#38bdf8] font-bold">{citation.format.toUpperCase()}</span>
              </div>
            )}
            {citation.documentType && (
              <div>
                <span className="text-[#87929a] block text-[10px] uppercase">Doc Type</span>
                <span className="text-[#d4e4fa]">{citation.documentType}</span>
              </div>
            )}
            {citation.author && (
              <div>
                <span className="text-[#87929a] block text-[10px] uppercase">Author</span>
                <span className="text-[#d4e4fa]">{citation.author}</span>
              </div>
            )}
            {citation.publisher && (
              <div>
                <span className="text-[#87929a] block text-[10px] uppercase">Publisher</span>
                <span className="text-[#d4e4fa]">{citation.publisher}</span>
              </div>
            )}
            {citation.documentDate && (
              <div>
                <span className="text-[#87929a] block text-[10px] uppercase">Document Date</span>
                <span className="text-[#d4e4fa]">{citation.documentDate}</span>
              </div>
            )}
            {citation.uploadDate && (
              <div>
                <span className="text-[#87929a] block text-[10px] uppercase">Uploaded</span>
                <span className="text-[#d4e4fa]">{new Date(citation.uploadDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Provenance Locator */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-data">
            <span className="text-[#87929a]">PROVENANCE LOCATOR:</span>
            {citation.pageNumber !== undefined && (
              <span className="px-2 py-0.5 bg-[#1c2b3c] text-[#7bd0ff] rounded-xs border border-[#38bdf8]/30">
                Page {citation.pageNumber}
              </span>
            )}
            {citation.rowNumber !== undefined && (
              <span className="px-2 py-0.5 bg-[#1c2b3c] text-[#7bd0ff] rounded-xs border border-[#38bdf8]/30">
                Row {citation.rowNumber}
              </span>
            )}
            {citation.sectionTitle && (
              <span className="px-2 py-0.5 bg-[#1c2b3c] text-[#7bd0ff] rounded-xs border border-[#38bdf8]/30">
                Section: {citation.sectionTitle}
              </span>
            )}
            {citation.confidence !== undefined && (
              <span className="px-2 py-0.5 bg-[#052e16] text-[#4ade80] rounded-xs border border-[#16a34a]">
                Match: {(citation.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Extracted Snippet / Evidence Card */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono-data font-semibold text-[#87929a] uppercase tracking-wider">
              EXTRACTED GROUNDED PASSAGE
            </span>
            <div className="p-4 bg-[#05080f] border border-[#1c2b3c] rounded-xs text-xs text-[#d4e4fa] leading-relaxed font-mono whitespace-pre-wrap selection:bg-[#38bdf8]/30">
              {citation.snippet}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1c2b3c] bg-[#0d1c2d]/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1c2b3c] hover:bg-[#25384e] text-[#d4e4fa] text-xs font-mono-data rounded-xs transition-colors"
          >
            Close Citation
          </button>
        </div>
      </div>
    </div>
  );
};
