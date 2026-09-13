/**
 * In-Memory Evidence Repository (Phase 8A)
 * 
 * Provides deterministic storage, retrieval, deduplication, conflict preservation,
 * and point-in-time querying for canonical EvidenceItem objects.
 */

import {
  EvidenceItem,
  EvidenceFilter,
  EvidenceSourceType,
  IEvidenceRepository
} from '../../../src/types';

/**
 * Generate a deterministic fingerprint for exact deduplication.
 * Identical security, source, concept/document, period, and value are deduplicated.
 */
export function generateEvidenceFingerprint(item: EvidenceItem): string {
  const sec = (item.securityId || 'global').trim().toLowerCase();
  const source = (item.sourceType || 'unknown').trim().toLowerCase();
  const prov = (item.provider || 'unknown').trim().toLowerCase();
  const doc = (item.documentId || item.documentType || item.sourceReference?.concept || 'doc').toString().trim().toLowerCase();
  const period = (item.periodEnd || item.filingDate || item.periodStart || 'current').trim();
  const val = typeof item.structuredValue === 'object' && item.structuredValue !== null
    ? JSON.stringify(item.structuredValue)
    : String(item.structuredValue ?? item.content ?? '').trim();

  return `${sec}::${source}::${prov}::${doc}::${period}::${val}`;
}

/**
 * Generate a concept/topic key used to detect conflicting reports for the same subject & period.
 */
export function generateConceptKey(item: EvidenceItem): string {
  const sec = (item.securityId || 'global').trim().toLowerCase();
  const docOrConcept = (item.sourceReference?.concept || item.documentType || item.documentId || item.title || 'concept').toString().trim().toLowerCase();
  const period = (item.periodEnd || item.filingDate || item.periodStart || 'period').trim();
  return `${sec}::${docOrConcept}::${period}`;
}

export class EvidenceRepository implements IEvidenceRepository {
  private itemsById = new Map<string, EvidenceItem>();
  private itemsByFingerprint = new Map<string, string>(); // fingerprint -> evidenceId
  private itemsByConceptKey = new Map<string, string[]>(); // conceptKey -> evidenceId[]

  /**
   * Add a single evidence item to the repository.
   * Handles deduplication and conflict preservation.
   * Returns true if added, false if exact duplicate.
   */
  public addEvidence(rawItem: EvidenceItem): boolean {
    if (!rawItem || !rawItem.evidenceId) {
      return false;
    }

    // 1. Sanitize to guarantee credential isolation
    const item = this.sanitizeItem(rawItem);

    // 2. Exact Deduplication Check
    const fingerprint = generateEvidenceFingerprint(item);
    if (this.itemsByFingerprint.has(fingerprint)) {
      return false; // Identical evidence already exists, skip
    }

    // 3. Conflict Detection
    const conceptKey = generateConceptKey(item);
    const existingIdsWithSameConcept = this.itemsByConceptKey.get(conceptKey) || [];

    for (const existingId of existingIdsWithSameConcept) {
      const existing = this.itemsById.get(existingId);
      if (existing) {
        // If different providers report differing values for the same concept/period, flag conflict
        const isDifferentProvider = existing.provider.toLowerCase() !== item.provider.toLowerCase();
        const isDifferentValue = String(existing.structuredValue) !== String(item.structuredValue) &&
                                 existing.structuredValue !== null && item.structuredValue !== null;

        if (isDifferentValue) {
          existing.hasConflict = true;
          existing.conflictDetails = `Discrepancy with ${item.provider}: reported ${String(item.structuredValue)} ${item.unit || ''} vs ${String(existing.structuredValue)} ${existing.unit || ''}`.trim();

          item.hasConflict = true;
          item.conflictDetails = `Discrepancy with ${existing.provider}: reported ${String(existing.structuredValue)} ${existing.unit || ''} vs ${String(item.structuredValue)} ${item.unit || ''}`.trim();
        }
      }
    }

    // 4. Store Evidence
    this.itemsById.set(item.evidenceId, item);
    this.itemsByFingerprint.set(fingerprint, item.evidenceId);

    existingIdsWithSameConcept.push(item.evidenceId);
    this.itemsByConceptKey.set(conceptKey, existingIdsWithSameConcept);

    return true;
  }

  /**
   * Add multiple evidence items in batch.
   * Returns the count of newly inserted items.
   */
  public addEvidenceBatch(items: EvidenceItem[]): number {
    if (!Array.isArray(items) || items.length === 0) return 0;
    let added = 0;
    for (const item of items) {
      if (this.addEvidence(item)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Retrieve a specific evidence item by its canonical ID.
   */
  public getEvidence(evidenceId: string): EvidenceItem | undefined {
    return this.itemsById.get(evidenceId);
  }

  /**
   * Retrieve all evidence matching a security ID.
   */
  public getEvidenceBySecurity(securityId: string): EvidenceItem[] {
    const norm = securityId.trim().toLowerCase();
    return Array.from(this.itemsById.values()).filter(item => {
      const itemSec = (item.securityId || '').trim().toLowerCase();
      const itemSym = (item.sourceReference?.symbol || '').trim().toLowerCase();
      return itemSec === norm || itemSym === norm;
    });
  }

  /**
   * Retrieve all evidence matching a source type.
   */
  public getEvidenceBySource(sourceType: EvidenceSourceType): EvidenceItem[] {
    return Array.from(this.itemsById.values()).filter(item => item.sourceType === sourceType);
  }

  /**
   * Mandatory Point-In-Time Retrieval.
   * Filters strictly on publishedAt (availability date) <= asOfDate.
   * Excludes any evidence not yet published by asOfDate.
   */
  public getEvidenceAvailableAsOf(asOfDate: string | Date, filter?: EvidenceFilter): EvidenceItem[] {
    const asOfTime = new Date(asOfDate).getTime();
    if (isNaN(asOfTime)) {
      return [];
    }

    return Array.from(this.itemsById.values()).filter(item => {
      // 1. Point-in-time check: publishedAt must be <= asOfDate
      const pubTime = new Date(item.publishedAt).getTime();
      if (isNaN(pubTime) || pubTime > asOfTime) {
        return false;
      }

      // 2. Apply additional filters if supplied
      if (filter && !this.matchesFilter(item, filter)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Query evidence using deterministic filters.
   */
  public queryEvidence(filter: EvidenceFilter): EvidenceItem[] {
    let results = Array.from(this.itemsById.values()).filter(item => this.matchesFilter(item, filter));

    if (typeof filter.limit === 'number' && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Remove a specific evidence item.
   */
  public removeEvidence(evidenceId: string): boolean {
    const item = this.itemsById.get(evidenceId);
    if (!item) return false;

    const fingerprint = generateEvidenceFingerprint(item);
    this.itemsByFingerprint.delete(fingerprint);

    const conceptKey = generateConceptKey(item);
    const existing = this.itemsByConceptKey.get(conceptKey);
    if (existing) {
      this.itemsByConceptKey.set(conceptKey, existing.filter(id => id !== evidenceId));
    }

    return this.itemsById.delete(evidenceId);
  }

  /**
   * Get all stored evidence.
   */
  public getAll(): EvidenceItem[] {
    return Array.from(this.itemsById.values());
  }

  /**
   * Total count of unique evidence items.
   */
  public count(): number {
    return this.itemsById.size;
  }

  /**
   * Clear repository.
   */
  public clear(): void {
    this.itemsById.clear();
    this.itemsByFingerprint.clear();
    this.itemsByConceptKey.clear();
  }

  /**
   * Internal filter evaluation.
   */
  private matchesFilter(item: EvidenceItem, filter: EvidenceFilter): boolean {
    // Security / Symbol
    if (filter.securityId) {
      const normSec = filter.securityId.toLowerCase();
      const itemSec = (item.securityId || '').toLowerCase();
      const itemSym = (item.sourceReference?.symbol || '').toLowerCase();
      if (itemSec !== normSec && itemSym !== normSec) return false;
    }

    if (filter.symbol) {
      const normSym = filter.symbol.toLowerCase();
      const itemSym = (item.sourceReference?.symbol || item.securityId || '').toLowerCase();
      if (itemSym !== normSym) return false;
    }

    // Source Type
    if (filter.sourceType) {
      const sources = Array.isArray(filter.sourceType) ? filter.sourceType : [filter.sourceType];
      if (!sources.includes(item.sourceType)) return false;
    }

    // Provider
    if (filter.provider) {
      const providers = (Array.isArray(filter.provider) ? filter.provider : [filter.provider]).map(p => p.toLowerCase());
      if (!providers.includes(item.provider.toLowerCase())) return false;
    }

    // Epistemic Status
    if (filter.epistemicStatus) {
      const statuses = Array.isArray(filter.epistemicStatus) ? filter.epistemicStatus : [filter.epistemicStatus];
      if (!statuses.includes(item.epistemicStatus)) return false;
    }

    // Document Type
    if (filter.documentType) {
      if ((item.documentType || '').toLowerCase() !== filter.documentType.toLowerCase()) return false;
    }

    // Concept
    if (filter.concept) {
      const normConcept = filter.concept.toLowerCase();
      const itemConcept = (item.sourceReference?.concept || '').toLowerCase();
      if (!itemConcept.includes(normConcept)) return false;
    }

    // Date range filtering (by publishedAt)
    const pubTime = new Date(item.publishedAt).getTime();
    if (!isNaN(pubTime)) {
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        if (!isNaN(start) && pubTime < start) return false;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime();
        if (!isNaN(end) && pubTime > end) return false;
      }
      if (filter.asOfDate) {
        const asOf = new Date(filter.asOfDate).getTime();
        if (!isNaN(asOf) && pubTime > asOf) return false;
      }
    }

    return true;
  }

  /**
   * Sanitize evidence item to prevent sensitive credential leakage.
   */
  private sanitizeItem(item: EvidenceItem): EvidenceItem {
    const cloned: EvidenceItem = JSON.parse(JSON.stringify(item));

    // Strip sensitive keys if accidentally present
    const sensitivePatterns = [/api[_-]?key/i, /token/i, /secret/i, /password/i, /credential/i];

    const cleanseObject = (obj: Record<string, unknown> | undefined) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (sensitivePatterns.some(p => p.test(key))) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanseObject(obj[key] as Record<string, unknown>);
        }
      }
    };

    if (cloned.sourceReference) cleanseObject(cloned.sourceReference as Record<string, unknown>);
    if (cloned.metadata) cleanseObject(cloned.metadata);
    if (typeof cloned.structuredValue === 'object' && cloned.structuredValue !== null) {
      cleanseObject(cloned.structuredValue as Record<string, unknown>);
    }

    return cloned;
  }
}

export const evidenceRepository = new EvidenceRepository();
