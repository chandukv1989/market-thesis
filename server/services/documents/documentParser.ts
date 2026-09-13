/**
 * Phase 14: Deterministic Document Parsing Engine
 * 
 * Supports:
 * - PDF (page boundaries, page counts, deterministic text extraction)
 * - CSV (structured tabular parsing with headers, numeric columns, dates, ticker symbols)
 * - TXT (UTF-8 text, paragraph/section boundary preservation)
 * - Markdown (structured headings, lists, tables)
 * 
 * Unsupported formats return epistemicStatus = 'UNAVAILABLE' with clear explanation.
 * Content hashing uses SHA-256 for deterministic duplicate detection.
 */

import crypto from 'crypto';
import {
  DocumentExtractionOptions,
  DocumentParseResult,
  ExtractedPage,
  StructuredCsvData,
  StructuredCsvRow,
  StructuredCsvCell
} from './documentTypes';
import { SupportedDocumentFormat } from '../../../src/types';

import { PDFParse } from 'pdf-parse';

const PDFParseClass = PDFParse;

/**
 * Generate deterministic SHA-256 content hash of file buffer.
 */
export function computeContentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Detect format from file name or explicit format string.
 */
export function detectFormat(fileName: string, explicitFormat?: string): SupportedDocumentFormat {
  const normExplicit = (explicitFormat || '').toUpperCase().trim();
  if (normExplicit === 'PDF') return 'PDF';
  if (normExplicit === 'CSV') return 'CSV';
  if (normExplicit === 'TXT' || normExplicit === 'TEXT') return 'TXT';
  if (normExplicit === 'MD' || normExplicit === 'MARKDOWN') return 'MARKDOWN';

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'PDF';
    case 'csv':
      return 'CSV';
    case 'txt':
    case 'text':
    case 'log':
      return 'TXT';
    case 'md':
    case 'markdown':
      return 'MARKDOWN';
    default:
      return 'UNSUPPORTED';
  }
}

/**
 * Parses a PDF buffer and extracts text deterministically with page boundaries.
 */
async function parsePdfDocument(buffer: Buffer, fileName: string): Promise<DocumentParseResult> {
  const extractionWarnings: string[] = [];

  try {
    const parser = new PDFParseClass({ data: buffer });
    const parsed = await parser.getText();
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }

    const pages: ExtractedPage[] = [];
    let combinedText = '';

    if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
      for (const p of parsed.pages) {
        const text = (p.text || '').trim();
        pages.push({
          pageNumber: p.num,
          text,
          characterCount: text.length
        });
        combinedText += (combinedText ? '\n\n' : '') + `--- Page ${p.num} ---\n` + text;
      }
    } else if (parsed.text) {
      // Fallback single page if pages array not segregated
      const text = parsed.text.trim();
      pages.push({
        pageNumber: 1,
        text,
        characterCount: text.length
      });
      combinedText = text;
      extractionWarnings.push('PDF parsed without distinct page boundaries; single page context retained.');
    }

    if (!combinedText.trim()) {
      return {
        format: 'PDF',
        documentType: 'PDF',
        rawText: '',
        pages: [],
        characterCount: 0,
        pageCount: 0,
        epistemicStatus: 'UNAVAILABLE',
        processingStatus: 'FAILED',
        extractionWarnings: ['PDF document contained no extractable textual content or is scanned/encrypted without OCR.'],
        metadata: { fileName, pageCount: 0 }
      };
    }

    return {
      format: 'PDF',
      documentType: 'PDF',
      rawText: combinedText,
      pages,
      characterCount: combinedText.length,
      pageCount: pages.length || (parsed.total || 1),
      epistemicStatus: 'REAL',
      processingStatus: 'READY',
      extractionWarnings,
      metadata: {
        fileName,
        pageCount: pages.length,
        pdfVersion: (parsed as unknown as { version?: string })?.version
      }
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      format: 'PDF',
      documentType: 'PDF',
      rawText: '',
      characterCount: 0,
      pageCount: 0,
      epistemicStatus: 'UNAVAILABLE',
      processingStatus: 'FAILED',
      extractionWarnings: [`PDF parsing failed: ${errMsg}`],
      metadata: { fileName, error: errMsg }
    };
  }
}

/**
 * Standard CSV Line Parser handling quotes, commas, and line feeds.
 */
function parseCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses numeric cell with potential currency, units, multiplier (M/B/K/%), commas.
 */
function parseNumericCell(val: string): { numeric?: number; currency?: string; unit?: string } {
  if (!val) return {};

  let cleaned = val.trim();
  let currency: string | undefined;
  let unit: string | undefined;

  // Currency symbols
  if (cleaned.startsWith('$')) {
    currency = 'USD';
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith('€')) {
    currency = 'EUR';
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith('₹')) {
    currency = 'INR';
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith('£')) {
    currency = 'GBP';
    cleaned = cleaned.slice(1).trim();
  }

  // Trailing currency or percentage
  if (cleaned.endsWith('%')) {
    unit = '%';
    cleaned = cleaned.slice(0, -1).trim();
  } else if (cleaned.toUpperCase().endsWith('USD')) {
    currency = 'USD';
    cleaned = cleaned.slice(0, -3).trim();
  } else if (cleaned.toUpperCase().endsWith('INR')) {
    currency = 'INR';
    cleaned = cleaned.slice(0, -3).trim();
  }

  // Multipliers
  let multiplier = 1;
  const upper = cleaned.toUpperCase();
  if (upper.endsWith('B') || upper.endsWith('BN') || upper.endsWith('BILLION')) {
    multiplier = 1_000_000_000;
    cleaned = cleaned.replace(/[a-zA-Z]/g, '').trim();
    unit = unit || 'Billion';
  } else if (upper.endsWith('M') || upper.endsWith('MN') || upper.endsWith('MILLION')) {
    multiplier = 1_000_000;
    cleaned = cleaned.replace(/[a-zA-Z]/g, '').trim();
    unit = unit || 'Million';
  } else if (upper.endsWith('K')) {
    multiplier = 1_000;
    cleaned = cleaned.replace(/[a-zA-Z]/g, '').trim();
    unit = unit || 'Thousand';
  }

  // Remove commas
  cleaned = cleaned.replace(/,/g, '');

  // Check if standard number
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const num = parseFloat(cleaned) * multiplier;
    return { numeric: num, currency, unit };
  }

  return {};
}

/**
 * Checks if a string represents a date or period.
 */
function isDateString(val: string): boolean {
  if (!val) return false;
  // ISO date YYYY-MM-DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val)) return true;
  // Quarter notation e.g. Q1 2024, 2024Q3, FY2025
  if (/^(Q[1-4][- ]?\d{2,4}|\d{4}[- ]?Q[1-4]|FY[- ]?\d{2,4})$/i.test(val)) return true;
  // Standard parsable date
  const parsed = Date.parse(val);
  return !isNaN(parsed) && /[-/]/.test(val);
}

/**
 * Parses a CSV buffer into structured data.
 */
function parseCsvDocument(buffer: Buffer, fileName: string): DocumentParseResult {
  const text = buffer.toString('utf-8').trim();
  const rawRows = parseCsvLines(text);

  if (rawRows.length === 0) {
    return {
      format: 'CSV',
      documentType: 'CSV',
      rawText: '',
      characterCount: 0,
      rowCount: 0,
      epistemicStatus: 'UNAVAILABLE',
      processingStatus: 'FAILED',
      extractionWarnings: ['CSV document was completely empty.'],
      metadata: { fileName, rowCount: 0 }
    };
  }

  const headers = rawRows[0].map(h => h.trim());
  const dataRows = rawRows.slice(1);

  // Column identification
  let dateCol: string | undefined;
  let symbolCol: string | undefined;
  const numericCols: string[] = [];

  for (const header of headers) {
    const lower = header.toLowerCase();
    if (!dateCol && (lower.includes('date') || lower.includes('period') || lower.includes('quarter') || lower.includes('year'))) {
      dateCol = header;
    }
    if (!symbolCol && (lower.includes('symbol') || lower.includes('ticker') || lower.includes('security'))) {
      symbolCol = header;
    }
  }

  // Infer numeric columns based on data values
  for (const header of headers) {
    if (header === dateCol || header === symbolCol) continue;
    let numericCount = 0;
    for (const r of dataRows.slice(0, 10)) {
      const idx = headers.indexOf(header);
      const val = r[idx];
      if (val && parseNumericCell(val).numeric !== undefined) {
        numericCount++;
      }
    }
    if (numericCount >= Math.min(2, dataRows.length)) {
      numericCols.push(header);
    }
  }

  // Build structured rows
  const structuredRows: StructuredCsvRow[] = [];
  const textRepresentationRows: string[] = [`Headers: ${headers.join(' | ')}`];

  dataRows.forEach((r, idx) => {
    const cells: Record<string, StructuredCsvCell> = {};
    let rowDate: string | undefined;
    let rowSymbol: string | undefined;

    headers.forEach((h, hIdx) => {
      const rawVal = r[hIdx] || '';
      const numInfo = parseNumericCell(rawVal);
      const isNum = numInfo.numeric !== undefined;

      cells[h] = {
        value: isNum ? numInfo.numeric! : (rawVal || null),
        numericValue: numInfo.numeric,
        isNumeric: isNum,
        currency: numInfo.currency,
        unit: numInfo.unit
      };

      if (h === dateCol && isDateString(rawVal)) {
        rowDate = rawVal;
      }
      if (h === symbolCol && rawVal) {
        rowSymbol = rawVal.toUpperCase();
      }
    });

    const rowText = `Row ${idx + 1}: ` + headers.map(h => `${h}: ${r[headers.indexOf(h)] || 'N/A'}`).join(' | ');
    textRepresentationRows.push(rowText);

    structuredRows.push({
      rowNumber: idx + 1,
      cells,
      date: rowDate,
      securitySymbol: rowSymbol,
      rawText: rowText
    });
  });

  const csvData: StructuredCsvData = {
    headers,
    numericColumns: numericCols,
    dateColumn: dateCol,
    symbolColumn: symbolCol,
    rows: structuredRows,
    totalRows: structuredRows.length
  };

  const combinedText = textRepresentationRows.join('\n');

  return {
    format: 'CSV',
    documentType: 'CSV',
    rawText: combinedText,
    csvData,
    characterCount: combinedText.length,
    rowCount: structuredRows.length,
    epistemicStatus: 'REAL',
    processingStatus: 'READY',
    extractionWarnings: [],
    metadata: {
      fileName,
      headers,
      numericColumns: numericCols,
      dateColumn: dateCol,
      symbolColumn: symbolCol,
      rowCount: structuredRows.length
    }
  };
}

/**
 * Parses plain TXT or Markdown document.
 */
function parseTextDocument(buffer: Buffer, fileName: string, format: 'TXT' | 'MARKDOWN'): DocumentParseResult {
  const text = buffer.toString('utf-8').trim();

  if (!text) {
    return {
      format,
      documentType: format,
      rawText: '',
      characterCount: 0,
      epistemicStatus: 'UNAVAILABLE',
      processingStatus: 'FAILED',
      extractionWarnings: [`${format} document was empty.`],
      metadata: { fileName }
    };
  }

  // Preserve paragraph/section blocks
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return {
    format,
    documentType: format,
    rawText: text,
    characterCount: text.length,
    epistemicStatus: 'REAL',
    processingStatus: 'READY',
    extractionWarnings: [],
    metadata: {
      fileName,
      paragraphCount: paragraphs.length,
      isMarkdown: format === 'MARKDOWN'
    }
  };
}

/**
 * Main parser entry point.
 */
export async function parseDocument(options: DocumentExtractionOptions): Promise<DocumentParseResult> {
  const { fileName, fileBuffer, explicitFormat } = options;
  const detected = detectFormat(fileName, explicitFormat);

  switch (detected) {
    case 'PDF':
      return await parsePdfDocument(fileBuffer, fileName);
    case 'CSV':
      return parseCsvDocument(fileBuffer, fileName);
    case 'TXT':
      return parseTextDocument(fileBuffer, fileName, 'TXT');
    case 'MARKDOWN':
      return parseTextDocument(fileBuffer, fileName, 'MARKDOWN');
    default:
      return {
        format: 'UNSUPPORTED',
        documentType: 'UNSUPPORTED',
        rawText: '',
        characterCount: 0,
        epistemicStatus: 'UNAVAILABLE',
        processingStatus: 'FAILED',
        extractionWarnings: [
          `Unsupported document format for "${fileName}". Only PDF, CSV, TXT, and Markdown documents are supported.`
        ],
        metadata: { fileName, requestedFormat: explicitFormat }
      };
  }
}
