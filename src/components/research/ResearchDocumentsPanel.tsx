import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileCode,
  Tag,
  Building,
  User,
  Calendar,
  Filter
} from 'lucide-react';
import {
  ResearchDocument,
  SecurityIdentifier
} from '../../types';
import { financialClient } from '../../services/financialDataService';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentCitationModal } from './DocumentCitationModal';

interface ResearchDocumentsPanelProps {
  selectedSecurity: SecurityIdentifier;
  onDocumentsChanged: () => void;
  onSelectDocumentForFocus?: (doc: ResearchDocument) => void;
}

export const ResearchDocumentsPanel: React.FC<ResearchDocumentsPanelProps> = ({
  selectedSecurity,
  onDocumentsChanged,
  onSelectDocumentForFocus
}) => {
  const [documents, setDocuments] = useState<ResearchDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await financialClient.getDocuments(selectedSecurity.id);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedSecurity.id]);

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document and remove its evidence from the research notebook?')) {
      return;
    }
    setDeletingId(docId);
    try {
      await financialClient.deleteDocument(docId);
      await loadDocuments();
      onDocumentsChanged();
    } finally {
      setDeletingId(null);
    }
  };

  const handlePreviewCitation = (doc: ResearchDocument) => {
    const primaryEvidence = doc.extractedEvidenceIds && doc.extractedEvidenceIds.length > 0;
    setSelectedCitation({
      title: doc.title,
      originalFileName: doc.fileName,
      documentType: doc.documentType,
      format: doc.format,
      author: doc.author,
      publisher: doc.publisher,
      documentDate: doc.documentDate,
      uploadDate: doc.uploadedAt,
      pageNumber: doc.metadata?.pageCount ? 1 : undefined,
      rowNumber: doc.metadata?.rowCount ? 1 : undefined,
      sectionTitle: doc.metadata?.sheetName || (doc.metadata?.sections && doc.metadata.sections[0]),
      snippet: doc.metadata?.executiveSummary || `Document indexed with ${doc.chunkCount} grounded chunks and ${doc.evidenceCount} repository evidence items. Ready for hybrid retrieval and thesis synthesis.`,
      epistemicStatus: doc.epistemicDefault,
      confidence: 1.0,
      documentId: doc.id
    });
    setIsCitationModalOpen(true);
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'markdown':
      case 'md':
        return <FileCode className="w-4 h-4 text-sky-400" />;
      default:
        return <FileText className="w-4 h-4 text-[#38bdf8]" />;
    }
  };

  const filteredDocs = documents.filter(doc => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.fileName.toLowerCase().includes(q) ||
      (doc.author && doc.author.toLowerCase().includes(q)) ||
      (doc.publisher && doc.publisher.toLowerCase().includes(q)) ||
      (doc.tags && doc.tags.some(t => t.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="bg-[#090d14] border border-[#1c2b3c] rounded-sm p-4 space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b3c] pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#38bdf8]" />
          <h2 className="text-xs font-bold font-mono-data text-[#d4e4fa] uppercase tracking-wider">
            RESEARCH DOCUMENTS & USER-GROUNDED RAG
          </h2>
          <span className="px-2 py-0.5 text-[10px] font-mono-data bg-[#0d1c2d] border border-[#1c2b3c] text-[#87929a] rounded-xs">
            {documents.length} INGESTED
          </span>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="px-3 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-mono-data font-semibold rounded-xs flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Ingest Document</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      {documents.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#87929a] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Filter research documents by title, author, firm or tag..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] text-xs font-mono-data rounded-xs focus:outline-none focus:border-[#38bdf8]"
          />
        </div>
      )}

      {/* Document List */}
      {isLoading ? (
        <div className="py-8 text-center text-xs font-mono-data text-[#87929a]">
          Loading research documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="border border-dashed border-[#1c2b3c] rounded-xs p-6 text-center space-y-2 bg-[#0d1c2d]/30">
          <FileText className="w-8 h-8 text-[#87929a] mx-auto" />
          <h3 className="text-xs font-bold text-[#d4e4fa]">
            No User Research Documents Ingested for {selectedSecurity.symbol}
          </h3>
          <p className="text-[11px] text-[#87929a] max-w-md mx-auto">
            Upload sell-side broker reports, earnings transcripts, internal notes, or financial models (.pdf, .csv, .txt, .md) to ground this research notebook in custom intelligence.
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1c2b3c] hover:bg-[#283d54] text-[#7bd0ff] text-xs font-mono-data rounded-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Upload Document</span>
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono-data text-[#87929a]">
          No documents matching "{searchFilter}".
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredDocs.map(doc => (
            <div
              key={doc.id}
              className="p-3 bg-[#0d1c2d]/70 border border-[#1c2b3c] hover:border-[#38bdf8]/50 rounded-xs transition-colors space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-[#090d14] rounded-xs border border-[#1c2b3c] shrink-0 mt-0.5">
                    {getFormatIcon(doc.format)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#d4e4fa] leading-snug">
                      {doc.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-data text-[#87929a] mt-0.5">
                      <span className="uppercase text-[#7bd0ff] font-semibold">
                        {doc.format}
                      </span>
                      <span>•</span>
                      <span>{doc.documentType}</span>
                      {doc.publisher && (
                        <>
                          <span>•</span>
                          <span className="text-[#d4e4fa]">{doc.publisher}</span>
                        </>
                      )}
                      {doc.author && (
                        <>
                          <span>•</span>
                          <span>Analyst: {doc.author}</span>
                        </>
                      )}
                      {doc.documentDate && (
                        <>
                          <span>•</span>
                          <span>Dated: {doc.documentDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge & Actions */}
                <div className="flex items-center gap-1.5">
                  {doc.status === 'READY' || doc.status === 'PARSED' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-emerald-950/70 border border-emerald-500/60 text-emerald-400">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      INDEXED
                    </span>
                  ) : doc.status === 'FAILED' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-rose-950/70 border border-rose-500/60 text-rose-400">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      FAILED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono-data font-bold rounded-xs bg-sky-950/70 border border-sky-500/60 text-sky-400">
                      <Clock className="w-2.5 h-2.5 animate-spin" />
                      PROCESSING
                    </span>
                  )}

                  <button
                    onClick={() => handlePreviewCitation(doc)}
                    className="p-1 text-[#87929a] hover:text-[#38bdf8] hover:bg-[#1c2b3c] rounded-xs transition-colors"
                    title="View Document Details & Citation"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-1 text-[#87929a] hover:text-rose-400 hover:bg-[#1c2b3c] rounded-xs transition-colors"
                    title="Delete Document and Purge Evidence"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Document Metrics Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1c2b3c]/60 text-[10px] font-mono-data">
                <div className="flex items-center gap-3 text-[#87929a]">
                  <span>
                    Evidence Items:{' '}
                    <strong className="text-[#38bdf8]">{doc.evidenceCount}</strong>
                  </span>
                  <span>
                    Chunks:{' '}
                    <strong className="text-[#34d399]">{doc.chunkCount}</strong>
                  </span>
                  {doc.pageCount && (
                    <span>
                      Pages: <strong className="text-[#d4e4fa]">{doc.pageCount}</strong>
                    </span>
                  )}
                  {doc.rowCount && (
                    <span>
                      Rows: <strong className="text-[#d4e4fa]">{doc.rowCount}</strong>
                    </span>
                  )}
                  <span>
                    Epistemic:{' '}
                    <strong className="text-[#fbbf24]">{doc.epistemicDefault}</strong>
                  </span>
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {doc.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.2 bg-[#090d14] border border-[#1c2b3c] text-[#87929a] rounded-2xs text-[9px]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        targetSecurity={selectedSecurity}
        onUploadSuccess={() => {
          loadDocuments();
          onDocumentsChanged();
        }}
      />

      {/* Citation Modal */}
      <DocumentCitationModal
        isOpen={isCitationModalOpen}
        onClose={() => setIsCitationModalOpen(false)}
        citation={selectedCitation}
      />
    </div>
  );
};
