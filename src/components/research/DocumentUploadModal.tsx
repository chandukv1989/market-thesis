import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Building,
  Tag,
  Loader2,
  FileCheck,
  FileType
} from 'lucide-react';
import {
  DocumentUploadRequest,
  DocumentUploadResult,
  ResearchDocumentType,
  EvidenceEpistemicStatus,
  SecurityIdentifier
} from '../../types';
import { financialClient } from '../../services/financialDataService';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSecurity: SecurityIdentifier;
  onUploadSuccess: (result: DocumentUploadResult) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  targetSecurity,
  onUploadSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<ResearchDocumentType>('ANALYST_NOTE');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [epistemicDefault, setEpistemicDefault] = useState<EvidenceEpistemicStatus>('ANALYST_OPINION');
  const [tagsInput, setTagsInput] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<DocumentUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setUploadResult(null);

    // Auto-fill title if empty
    if (!title) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(cleanName);
    }

    // Auto-detect doc type from filename
    const lowerName = selectedFile.name.toLowerCase();
    if (lowerName.includes('10-k') || lowerName.includes('10-q') || lowerName.includes('filing')) {
      setDocType('SEC_DISCLOSURE');
      setEpistemicDefault('FACT');
    } else if (lowerName.includes('transcript') || lowerName.includes('earnings') || lowerName.includes('call')) {
      setDocType('EARNINGS_CALL_TRANSCRIPT');
      setEpistemicDefault('FACT');
    } else if (lowerName.includes('broker') || lowerName.includes('research') || lowerName.includes('target')) {
      setDocType('BROKER_REPORT');
      setEpistemicDefault('ANALYST_OPINION');
    } else if (lowerName.includes('model') || lowerName.includes('valuation') || lowerName.includes('dcf')) {
      setDocType('VALUATION_MODEL');
      setEpistemicDefault('INFERENCE');
    } else if (lowerName.includes('industry') || lowerName.includes('sector')) {
      setDocType('INDUSTRY_REPORT');
      setEpistemicDefault('ANALYST_INFERENCE');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const readFileContent = (selectedFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        reader.readAsDataURL(selectedFile);
        reader.onload = () => {
          const res = reader.result as string;
          // extract base64 part
          const base64 = res.split(',')[1] || res;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
      } else {
        reader.readAsText(selectedFile);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read text file'));
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a document to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const content = await readFileContent(file);
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const request: DocumentUploadRequest = {
        securityId: targetSecurity.id,
        fileName: file.name,
        fileContent: content,
        title: title.trim() || file.name,
        documentType: docType,
        author: author.trim() || undefined,
        publisher: publisher.trim() || undefined,
        documentDate: documentDate || undefined,
        tags: tags.length > 0 ? tags : undefined,
        epistemicDefault
      };

      const result = await financialClient.uploadDocument(request);
      setUploadResult(result);
      onUploadSuccess(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTitle('');
    setAuthor('');
    setPublisher('');
    setUploadResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-[#090d14] border border-[#1c2b3c] rounded-md max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2b3c] bg-[#0d1c2d]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1c2b3c]/60 rounded-xs border border-[#38bdf8]/30">
              <Upload className="w-4 h-4 text-[#38bdf8]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#d4e4fa] font-mono-data tracking-wide">
                INGEST RESEARCH DOCUMENT
              </h2>
              <p className="text-[11px] text-[#87929a]">
                Ground thesis in proprietary reports, broker notes, transcripts & models for {targetSecurity.symbol}
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

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {uploadResult ? (
            /* Upload Success Result View */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-[#052e16]/60 border border-[#16a34a]/60 rounded-xs text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#4ade80] mx-auto" />
                <h3 className="text-sm font-bold text-[#d4e4fa]">
                  Document Successfully Ingested & Grounded
                </h3>
                <p className="text-xs text-[#87929a]">
                  Evidence items and chunks have been registered into the active research repository for {targetSecurity.symbol}.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono-data">
                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-center">
                  <span className="text-[#87929a] block text-[10px]">EVIDENCE ITEMS</span>
                  <span className="text-base font-bold text-[#38bdf8]">
                    {uploadResult.evidenceCount}
                  </span>
                </div>
                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-center">
                  <span className="text-[#87929a] block text-[10px]">CHUNKS CREATED</span>
                  <span className="text-base font-bold text-[#34d399]">
                    {uploadResult.chunkCount}
                  </span>
                </div>
                <div className="p-3 bg-[#0d1c2d] border border-[#1c2b3c] rounded-xs text-center">
                  <span className="text-[#87929a] block text-[10px]">PAGES / ROWS</span>
                  <span className="text-base font-bold text-[#d4e4fa]">
                    {uploadResult.pageCount || uploadResult.rowCount || 1}
                  </span>
                </div>
              </div>

              {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                <div className="p-3 bg-[#2a1708] border border-[#b45309] rounded-xs text-xs text-[#fbbf24] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Parsing Warnings</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-[#fed7aa] space-y-0.5">
                    {uploadResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 bg-[#0d1c2d] hover:bg-[#1c2b3c] border border-[#1c2b3c] text-[#d4e4fa] text-xs font-mono-data rounded-xs transition-colors"
                >
                  Upload Another Document
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-mono-data rounded-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Upload Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xs p-5 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-[#38bdf8] bg-[#38bdf8]/10'
                    : file
                    ? 'border-[#16a34a] bg-[#052e16]/20'
                    : 'border-[#1c2b3c] hover:border-[#38bdf8]/60 bg-[#0d1c2d]/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv,.txt,.md"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileCheck className="w-8 h-8 text-[#4ade80]" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#d4e4fa]">{file.name}</p>
                      <p className="text-[10px] text-[#87929a] font-mono-data">
                        {(file.size / 1024).toFixed(1)} KB • Click or drag to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="w-8 h-8 text-[#87929a] mx-auto" />
                    <p className="text-xs font-semibold text-[#d4e4fa]">
                      Drag and drop PDF, CSV, TXT, or MD
                    </p>
                    <p className="text-[10px] text-[#87929a]">
                      Or click to browse from local filesystem (max 50 MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Document Title */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Q4 2025 Morgan Stanley Initiation Report"
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>

                {/* Document Type */}
                <div>
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={e => setDocType(e.target.value as ResearchDocumentType)}
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  >
                    <option value="ANALYST_NOTE">Analyst Note</option>
                    <option value="BROKER_REPORT">Broker / Sell-Side Report</option>
                    <option value="EARNINGS_CALL_TRANSCRIPT">Earnings Call Transcript</option>
                    <option value="INDUSTRY_REPORT">Industry / Market Report</option>
                    <option value="VALUATION_MODEL">Valuation Model / DCF</option>
                    <option value="INTERNAL_MEMO">Internal Research Memo</option>
                    <option value="SEC_DISCLOSURE">SEC Periodic Disclosure</option>
                    <option value="OTHER">Other Research Document</option>
                  </select>
                </div>

                {/* Epistemic Baseline */}
                <div>
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Epistemic Baseline
                  </label>
                  <select
                    value={epistemicDefault}
                    onChange={e => setEpistemicDefault(e.target.value as EvidenceEpistemicStatus)}
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  >
                    <option value="ANALYST_OPINION">Analyst Opinion (Sell-Side targets, sentiments)</option>
                    <option value="ANALYST_INFERENCE">Analyst Inference (TAM estimations, forecasts)</option>
                    <option value="FACT">Factual Disclosure (Audited, reported figures)</option>
                    <option value="UNCERTAINTY">Uncertainty / Forward Projection</option>
                  </select>
                </div>

                {/* Author */}
                <div>
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Author / Lead Analyst
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    placeholder="e.g. Toshiya Hari"
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>

                {/* Publisher / Firm */}
                <div>
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Publisher / Research Firm
                  </label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={e => setPublisher(e.target.value)}
                    placeholder="e.g. Goldman Sachs Global Investment Research"
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>

                {/* Document Date */}
                <div>
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Document Date
                  </label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={e => setDocumentDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-[11px] font-mono-data text-[#87929a] uppercase mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={e => setTagsInput(e.target.value)}
                    placeholder="e.g. AI Capex, GPU, Datacenter"
                    className="w-full px-3 py-1.5 bg-[#0d1c2d] border border-[#1c2b3c] text-[#d4e4fa] rounded-xs focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-[#2a0e14] border border-[#f43f5e]/60 rounded-xs text-xs text-[#fda4af] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#f43f5e] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2b3c]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-[#0d1c2d] hover:bg-[#1c2b3c] text-[#87929a] hover:text-[#d4e4fa] text-xs font-mono-data rounded-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!file || isUploading}
                  className="px-4 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono-data rounded-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ingest Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
