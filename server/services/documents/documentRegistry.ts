/**
 * Phase 14: Server-Side Research Document Registry
 * 
 * Tracks ingested research documents, deterministic content hashes (SHA-256),
 * security associations, epistemic statuses, and processing lifecycles.
 */

import {
  ResearchDocument,
  DocumentProcessingStatus,
  DocumentRegistryStats
} from '../../../src/types';

export class DocumentRegistry {
  private documents: Map<string, ResearchDocument> = new Map();
  private documentsByHash: Map<string, string> = new Map(); // contentHash -> documentId

  /**
   * Registers a document or detects duplicate via contentHash.
   */
  public register(doc: ResearchDocument): {
    registered: boolean;
    isDuplicate: boolean;
    document: ResearchDocument;
  } {
    // 1. Exact content hash deduplication
    const existingDocId = this.documentsByHash.get(doc.contentHash);
    if (existingDocId && this.documents.has(existingDocId)) {
      const existing = this.documents.get(existingDocId)!;
      return {
        registered: false,
        isDuplicate: true,
        document: existing
      };
    }

    // 2. Store document
    this.documents.set(doc.documentId, doc);
    this.documentsByHash.set(doc.contentHash, doc.documentId);

    return {
      registered: true,
      isDuplicate: false,
      document: doc
    };
  }

  /**
   * Retrieves document by ID.
   */
  public getDocument(documentId: string): ResearchDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Retrieves document by content hash.
   */
  public getDocumentByHash(contentHash: string): ResearchDocument | undefined {
    const docId = this.documentsByHash.get(contentHash);
    return docId ? this.documents.get(docId) : undefined;
  }

  /**
   * Lists documents associated with a specific security.
   */
  public getDocumentsBySecurity(securityId?: string): ResearchDocument[] {
    if (!securityId) {
      return Array.from(this.documents.values()).filter(d => !d.securityId);
    }
    const target = securityId.toLowerCase();
    return Array.from(this.documents.values()).filter(d =>
      d.securityId?.toLowerCase() === target ||
      d.securityId?.toLowerCase() === `sec-${target}` ||
      d.securityId?.toLowerCase().replace(/^sec-/, '') === target
    );
  }

  /**
   * Lists all registered documents.
   */
  public getAllDocuments(): ResearchDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Updates document processing status and optional extraction warnings.
   */
  public updateStatus(
    documentId: string,
    status: DocumentProcessingStatus,
    warnings?: string[]
  ): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    doc.processingStatus = status;
    if (warnings && warnings.length > 0) {
      doc.extractionWarnings = [...(doc.extractionWarnings || []), ...warnings];
    }
    return true;
  }

  /**
   * Records generated evidence IDs and chunk IDs on the document record.
   */
  public updateEvidenceAndChunks(
    documentId: string,
    evidenceIds: string[],
    chunkIds: string[]
  ): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    doc.evidenceIds = evidenceIds;
    doc.chunkIds = chunkIds;
    return true;
  }

  /**
   * Deletes a document from the registry.
   */
  public deleteDocument(documentId: string): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    this.documentsByHash.delete(doc.contentHash);
    this.documents.delete(documentId);
    return true;
  }

  /**
   * Returns comprehensive registry metrics.
   */
  public getStats(): DocumentRegistryStats {
    const docs = Array.from(this.documents.values());
    const bySec: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalEvidence = 0;
    let totalChunks = 0;
    let ready = 0;
    let failed = 0;

    for (const d of docs) {
      const secKey = d.securityId || 'GENERAL';
      bySec[secKey] = (bySec[secKey] || 0) + 1;
      byType[d.documentType] = (byType[d.documentType] || 0) + 1;

      if (d.processingStatus === 'READY') ready++;
      if (d.processingStatus === 'FAILED') failed++;

      totalEvidence += d.evidenceIds?.length || 0;
      totalChunks += d.chunkIds?.length || 0;
    }

    return {
      totalDocuments: docs.length,
      readyDocuments: ready,
      failedDocuments: failed,
      totalEvidenceItems: totalEvidence,
      totalChunks: totalChunks,
      documentsBySecurity: bySec,
      documentsByType: byType
    };
  }

  /**
   * Clear in-memory state (useful for tests).
   */
  public clear(): void {
    this.documents.clear();
    this.documentsByHash.clear();
  }
}

export const documentRegistry = new DocumentRegistry();
