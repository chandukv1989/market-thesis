/**
 * Deterministic Evidence Chunking Module (Phase 8B)
 * 
 * Splits textual evidence items into deterministic chunks while preserving
 * parent provenance, security identity, availability dates, and epistemic statuses.
 * Short or structured evidence items remain single atomic chunks.
 */

import { EvidenceItem, EvidenceChunk } from '../../../src/types';

export interface ChunkingOptions {
  targetChunkSize?: number; // default ~500 chars
  overlapSize?: number;     // default ~60 chars
  minChunkSize?: number;     // default ~100 chars
}

const DEFAULT_TARGET_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP_SIZE = 60;
const DEFAULT_MIN_CHUNK_SIZE = 100;

/**
 * Split a text block into deterministic chunks on sentence/paragraph boundaries.
 */
function splitTextDeterministically(
  text: string,
  targetSize: number,
  overlap: number,
  minSize: number
): string[] {
  if (!text || text.length <= targetSize) {
    return [text.trim()];
  }

  // Split by double newline (paragraphs) or single newline, or sentence endings (. / ? / !)
  const rawSegments = text.split(/(?<=[.?!;:\n])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const segment of rawSegments) {
    const trimmedSeg = segment.trim();
    if (!trimmedSeg) continue;

    if (!currentChunk) {
      currentChunk = trimmedSeg;
    } else if (currentChunk.length + trimmedSeg.length + 1 <= targetSize) {
      currentChunk += ' ' + trimmedSeg;
    } else {
      // Current chunk has reached target capacity
      chunks.push(currentChunk);

      // Create overlap from the tail of currentChunk if possible
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapSlice = currentChunk.slice(-overlap);
        // Find first word boundary in the overlap slice to avoid partial words
        const spaceIdx = overlapSlice.indexOf(' ');
        const cleanOverlap = spaceIdx !== -1 ? overlapSlice.slice(spaceIdx + 1) : overlapSlice;
        currentChunk = cleanOverlap ? cleanOverlap + ' ' + trimmedSeg : trimmedSeg;
      } else {
        currentChunk = trimmedSeg;
      }
    }
  }

  if (currentChunk.trim()) {
    // If the last chunk is too small and we already have chunks, append to last chunk
    if (chunks.length > 0 && currentChunk.length < minSize) {
      chunks[chunks.length - 1] += ' ' + currentChunk.trim();
    } else {
      chunks.push(currentChunk.trim());
    }
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

/**
 * Deterministically chunks a single EvidenceItem.
 */
export function chunkEvidenceItem(
  item: EvidenceItem,
  optionsOrTargetSize?: ChunkingOptions | number,
  overlapSize?: number
): EvidenceChunk[] {
  let targetSize = DEFAULT_TARGET_CHUNK_SIZE;
  let overlap = DEFAULT_OVERLAP_SIZE;
  let minSize = DEFAULT_MIN_CHUNK_SIZE;

  if (typeof optionsOrTargetSize === 'number') {
    targetSize = optionsOrTargetSize;
    if (typeof overlapSize === 'number') overlap = overlapSize;
  } else if (optionsOrTargetSize && typeof optionsOrTargetSize === 'object') {
    targetSize = optionsOrTargetSize.targetChunkSize ?? DEFAULT_TARGET_CHUNK_SIZE;
    overlap = optionsOrTargetSize.overlapSize ?? DEFAULT_OVERLAP_SIZE;
    minSize = optionsOrTargetSize.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;
  }

  const content = item.content || '';

  // Short items or structured items with little text remain atomic single chunks
  if (content.length <= targetSize) {
    const chunkId = `${item.evidenceId}-chk-0`;
    return [
      {
        chunkId,
        evidenceId: item.evidenceId,
        securityId: item.securityId,
        sourceType: item.sourceType,
        provider: item.provider,
        documentId: item.documentId,
        documentType: item.documentType,
        title: item.title,
        content: content,
        chunkIndex: 0,
        totalChunks: 1,
        publishedAt: item.publishedAt,
        filingDate: item.filingDate,
        periodEnd: item.periodEnd,
        epistemicStatus: item.epistemicStatus,
        isSimulated: item.isSimulated,
        sourceReference: item.sourceReference,
        hasConflict: item.hasConflict,
        conflictDetails: item.conflictDetails,
        metadata: item.metadata
      }
    ];
  }

  // Long text: split deterministically
  const textSlices = splitTextDeterministically(content, targetSize, overlap, minSize);
  const totalChunks = textSlices.length;

  return textSlices.map((slice, index) => ({
    chunkId: `${item.evidenceId}-chk-${index}`,
    evidenceId: item.evidenceId,
    securityId: item.securityId,
    sourceType: item.sourceType,
    provider: item.provider,
    documentId: item.documentId,
    documentType: item.documentType,
    title: totalChunks > 1 ? `${item.title} (Part ${index + 1}/${totalChunks})` : item.title,
    content: slice,
    chunkIndex: index,
    totalChunks,
    publishedAt: item.publishedAt,
    filingDate: item.filingDate,
    periodEnd: item.periodEnd,
    epistemicStatus: item.epistemicStatus,
    isSimulated: item.isSimulated,
    sourceReference: item.sourceReference,
    hasConflict: item.hasConflict,
    conflictDetails: item.conflictDetails,
    metadata: {
      ...item.metadata,
      chunkOffset: index,
      parentContentLength: content.length
    }
  }));
}

/**
 * Deterministically chunks an array of EvidenceItems.
 */
export function chunkEvidenceBatch(
  items: EvidenceItem[],
  options?: ChunkingOptions
): EvidenceChunk[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const allChunks: EvidenceChunk[] = [];
  for (const item of items) {
    allChunks.push(...chunkEvidenceItem(item, options));
  }
  return allChunks;
}

export const chunkEvidenceItems = chunkEvidenceBatch;
