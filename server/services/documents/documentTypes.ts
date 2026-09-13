/**
 * Phase 14: Document Intelligence Types & Parser Contracts
 */

import {
  ResearchDocument,
  DocumentProcessingStatus,
  SupportedDocumentFormat,
  EvidenceEpistemicStatus
} from '../../../src/types';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  characterCount: number;
}

export interface StructuredCsvCell {
  value: string | number | null;
  numericValue?: number;
  isNumeric: boolean;
  currency?: string;
  unit?: string;
}

export interface StructuredCsvRow {
  rowNumber: number;
  cells: Record<string, StructuredCsvCell>;
  date?: string;
  securitySymbol?: string;
  rawText: string;
}

export interface StructuredCsvData {
  headers: string[];
  numericColumns: string[];
  dateColumn?: string;
  symbolColumn?: string;
  rows: StructuredCsvRow[];
  totalRows: number;
}

export interface DocumentParseResult {
  format: SupportedDocumentFormat;
  documentType: string;
  rawText: string;
  pages?: ExtractedPage[];
  csvData?: StructuredCsvData;
  characterCount: number;
  pageCount?: number;
  rowCount?: number;
  epistemicStatus: EvidenceEpistemicStatus;
  processingStatus: DocumentProcessingStatus;
  extractionWarnings: string[];
  metadata: Record<string, unknown>;
}

export interface DocumentExtractionOptions {
  fileName: string;
  fileBuffer: Buffer;
  mimeType?: string;
  explicitFormat?: string;
}
