/**
 * Phase 14: Document to Evidence Adapter
 * 
 * Converts parsed research documents into audited EvidenceItem records.
 * Preserves documentId, securityId, page provenance, row/table provenance,
 * publication/availability dates, and epistemic statuses.
 */

import {
  ResearchDocument,
  EvidenceItem,
  EvidenceSourceReference,
  EvidenceEpistemicStatus
} from '../../../src/types';
import { DocumentParseResult, ExtractedPage, StructuredCsvRow } from './documentTypes';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';

export class DocumentEvidenceAdapter {
  /**
   * Transforms a parsed document into audited EvidenceItems.
   */
  public createEvidenceItems(
    doc: ResearchDocument,
    parseResult: DocumentParseResult
  ): EvidenceItem[] {
    const publishedAt = doc.publishedAt || doc.availableFrom || doc.uploadedAt;
    const availableAt = doc.availableFrom || doc.publishedAt || doc.uploadedAt;

    switch (parseResult.format) {
      case 'PDF':
        return this.createPdfEvidence(doc, parseResult.pages || [], publishedAt, availableAt);
      case 'CSV':
        return this.createCsvEvidence(doc, parseResult.csvData?.rows || [], publishedAt, availableAt);
      case 'TXT':
      case 'MARKDOWN':
        return this.createTextEvidence(doc, parseResult.rawText, publishedAt, availableAt);
      default:
        return [];
    }
  }

  /**
   * PDF Evidence Items: Page-level provenance.
   */
  private createPdfEvidence(
    doc: ResearchDocument,
    pages: ExtractedPage[],
    publishedAt: string,
    availableAt: string
  ): EvidenceItem[] {
    if (pages.length === 0) {
      // Single item fallback if no segregated pages
      return [{
        evidenceId: `ev-doc-${doc.documentId}-p1`,
        securityId: doc.securityId,
        sourceType: 'RESEARCH_DOCUMENT',
        provider: doc.provider,
        documentId: doc.documentId,
        documentType: 'PDF',
        title: doc.title,
        content: doc.title,
        publishedAt,
        availableAt,
        retrievedAt: doc.uploadedAt,
        epistemicStatus: doc.epistemicStatus,
        isSimulated: doc.isSimulated,
        sourceReference: {
          documentId: doc.documentId,
          fileName: doc.fileName,
          title: doc.title,
          provider: doc.provider,
          page: 1
        },
        metadata: {
          documentId: doc.documentId,
          fileName: doc.fileName,
          page: 1,
          contentHash: doc.contentHash
        }
      }];
    }

    return pages.map(p => {
      const sourceRef: EvidenceSourceReference = {
        documentId: doc.documentId,
        fileName: doc.fileName,
        title: doc.title,
        provider: doc.provider,
        page: p.pageNumber,
        publishedAt
      };

      return {
        evidenceId: `ev-doc-${doc.documentId}-p${p.pageNumber}`,
        securityId: doc.securityId,
        sourceType: 'RESEARCH_DOCUMENT',
        provider: doc.provider,
        documentId: doc.documentId,
        documentType: 'PDF',
        title: `${doc.title} (Page ${p.pageNumber})`,
        content: p.text,
        publishedAt,
        availableAt,
        retrievedAt: doc.uploadedAt,
        epistemicStatus: doc.epistemicStatus,
        isSimulated: doc.isSimulated,
        sourceReference: sourceRef,
        metadata: {
          documentId: doc.documentId,
          fileName: doc.fileName,
          page: p.pageNumber,
          contentHash: doc.contentHash
        }
      };
    });
  }

  /**
   * CSV Evidence Items: Row-level structured provenance.
   */
  private createCsvEvidence(
    doc: ResearchDocument,
    rows: StructuredCsvRow[],
    defaultPublishedAt: string,
    defaultAvailableAt: string
  ): EvidenceItem[] {
    return rows.map(r => {
      // Date and security extraction from row if present
      const rowPublishedAt = r.date || defaultPublishedAt;
      const rowAvailableAt = r.date || defaultAvailableAt;

      let rowSecurityId = doc.securityId;
      if (!rowSecurityId && r.securitySymbol) {
        const canonical = resolveSecurity(r.securitySymbol);
        if (canonical) {
          rowSecurityId = canonical.id;
        }
      }

      // Convert cells into structured map
      const structuredMap: Record<string, unknown> = {};
      let conceptMetric: string | undefined;
      let conceptValue: number | undefined;

      for (const [colName, cell] of Object.entries(r.cells)) {
        structuredMap[colName] = cell.value;
        const lowerCol = colName.toLowerCase();
        if (!conceptMetric && cell.isNumeric && cell.numericValue !== undefined) {
          if (lowerCol.includes('revenue') || lowerCol.includes('sales')) {
            conceptMetric = 'revenue';
            conceptValue = cell.numericValue;
          } else if (lowerCol.includes('eps') || lowerCol.includes('earnings per share')) {
            conceptMetric = 'eps';
            conceptValue = cell.numericValue;
          } else if (lowerCol.includes('net income') || lowerCol.includes('profit')) {
            conceptMetric = 'net_income';
            conceptValue = cell.numericValue;
          }
        }
      }

      // Concept key for conflict tracking if applicable
      const conceptKey = (conceptMetric && rowSecurityId)
        ? `${rowSecurityId}:${conceptMetric}:${r.date || 'LATEST'}`
        : undefined;

      const sourceRef: EvidenceSourceReference = {
        documentId: doc.documentId,
        fileName: doc.fileName,
        title: doc.title,
        provider: doc.provider,
        row: r.rowNumber,
        publishedAt: rowPublishedAt
      };

      return {
        evidenceId: `ev-doc-${doc.documentId}-row-${r.rowNumber}`,
        securityId: rowSecurityId,
        sourceType: 'RESEARCH_DOCUMENT',
        provider: doc.provider,
        documentId: doc.documentId,
        documentType: 'CSV',
        title: `${doc.title} (Row ${r.rowNumber}${r.date ? ` - ${r.date}` : ''})`,
        content: r.rawText,
        structuredValue: structuredMap,
        conceptKey,
        publishedAt: rowPublishedAt,
        availableAt: rowAvailableAt,
        retrievedAt: doc.uploadedAt,
        epistemicStatus: doc.epistemicStatus,
        isSimulated: doc.isSimulated,
        sourceReference: sourceRef,
        metadata: {
          documentId: doc.documentId,
          fileName: doc.fileName,
          rowNumber: r.rowNumber,
          date: r.date,
          symbol: r.securitySymbol,
          contentHash: doc.contentHash
        }
      };
    });
  }

  /**
   * Text & Markdown Evidence: Section-level provenance.
   */
  private createTextEvidence(
    doc: ResearchDocument,
    rawText: string,
    publishedAt: string,
    availableAt: string
  ): EvidenceItem[] {
    const sections = rawText
      .split(/\n{2,}/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sections.length === 0) {
      return [];
    }

    // Group paragraphs into manageable ~800-1200 char sections
    const groupedSections: string[] = [];
    let currentGroup = '';

    for (const sec of sections) {
      if (!currentGroup) {
        currentGroup = sec;
      } else if (currentGroup.length + sec.length + 2 <= 1200) {
        currentGroup += '\n\n' + sec;
      } else {
        groupedSections.push(currentGroup);
        currentGroup = sec;
      }
    }
    if (currentGroup) {
      groupedSections.push(currentGroup);
    }

    return groupedSections.map((secText, idx) => {
      const sourceRef: EvidenceSourceReference = {
        documentId: doc.documentId,
        fileName: doc.fileName,
        title: doc.title,
        provider: doc.provider,
        section: idx + 1,
        publishedAt
      };

      return {
        evidenceId: `ev-doc-${doc.documentId}-sec-${idx + 1}`,
        securityId: doc.securityId,
        sourceType: 'RESEARCH_DOCUMENT',
        provider: doc.provider,
        documentId: doc.documentId,
        documentType: doc.documentType,
        title: `${doc.title} (Section ${idx + 1}/${groupedSections.length})`,
        content: secText,
        publishedAt,
        availableAt,
        retrievedAt: doc.uploadedAt,
        epistemicStatus: doc.epistemicStatus,
        isSimulated: doc.isSimulated,
        sourceReference: sourceRef,
        metadata: {
          documentId: doc.documentId,
          fileName: doc.fileName,
          sectionIndex: idx + 1,
          totalSections: groupedSections.length,
          contentHash: doc.contentHash
        }
      };
    });
  }
}

export const documentEvidenceAdapter = new DocumentEvidenceAdapter();
