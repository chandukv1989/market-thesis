/**
 * Phase 14: Research Document Ingestion Service
 * 
 * Orchestrates document upload, validation, deterministic parsing,
 * evidence creation, chunking (reusing existing EvidenceChunker),
 * embedding generation (reusing existing EmbeddingProvider),
 * and repository indexing (reusing existing EvidenceRepository).
 */

import {
  ResearchDocument,
  DocumentUploadRequest,
  DocumentUploadResult,
  EvidenceItem,
  EvidenceChunk,
  DocumentProcessingStatus
} from '../../../src/types';
import { documentRegistry } from './documentRegistry';
import { parseDocument, computeContentHash } from './documentParser';
import { documentEvidenceAdapter } from './documentEvidenceAdapter';
import { evidenceService } from '../evidence/evidenceService';
import { chunkEvidenceItem } from '../retrieval/chunking';
import { getEmbeddingProvider } from '../retrieval/embeddingProvider';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';

export class DocumentIngestionService {
  /**
   * Primary ingestion pipeline.
   */
  public async ingestDocument(request: DocumentUploadRequest): Promise<DocumentUploadResult> {
    const {
      title,
      fileName,
      securityId,
      provider = 'User Research Document',
      publishedAt,
      availableFrom,
      fileContentBase64,
      fileText,
      documentType: explicitType,
      uploadedBy = 'system_user',
      ownerUserId,
      userId
    } = request;

    const resolvedOwner = ownerUserId || userId;

    if (!fileName) {
      throw new Error('Document ingestion requires a valid fileName.');
    }

    // Phase 18 Hardening: Path traversal protection & file sanitization
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('Invalid fileName: Path traversal sequence or directory separators detected.');
    }

    const sanitizedFileName = fileName.trim();
    if (!sanitizedFileName) {
      throw new Error('Invalid fileName: Filename cannot be empty.');
    }

    // Prohibited executable & unsafe extensions
    const prohibitedExtensions = ['.exe', '.sh', '.bat', '.cmd', '.dll', '.so', '.bin', '.msi', '.vbs', '.js', '.py'];
    const lowerName = sanitizedFileName.toLowerCase();
    if (prohibitedExtensions.some(ext => lowerName.endsWith(ext))) {
      throw new Error(`Disallowed file extension in '${sanitizedFileName}'. Executable or script files are strictly prohibited.`);
    }

    // 1. Resolve buffer
    let buffer: Buffer;
    if (fileContentBase64) {
      buffer = Buffer.from(fileContentBase64, 'base64');
    } else if (fileText !== undefined) {
      buffer = Buffer.from(fileText, 'utf-8');
    } else {
      throw new Error('Document ingestion requires either fileContentBase64 or fileText.');
    }

    // Phase 18 Hardening: File size enforcement (10MB limit)
    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 10 MB.`);
    }

    // 2. Compute deterministic content hash (SHA-256)
    const contentHash = computeContentHash(buffer);

    // 3. Duplicate detection check
    const existingDoc = documentRegistry.getDocumentByHash(contentHash);
    if (existingDoc) {
      return {
        document: existingDoc,
        evidenceItemsCount: existingDoc.evidenceIds?.length || 0,
        chunksCount: existingDoc.chunkIds?.length || 0,
        extractionWarnings: ['Duplicate document detected via SHA-256 content hash; reusing existing document identity.'],
        isDuplicate: true
      };
    }

    // 4. Resolve security association
    const rawSecId = securityId || (request as any).securityIds?.[0];
    let canonicalSecId: string | undefined;
    if (rawSecId) {
      const canonical = resolveSecurity(rawSecId);
      if (canonical) {
        canonicalSecId = canonical.id;
      } else {
        canonicalSecId = rawSecId;
      }
    }

    // 5. Parse document deterministically
    const parseResult = await parseDocument({
      fileName: sanitizedFileName,
      fileBuffer: buffer,
      explicitFormat: explicitType
    });

    const now = new Date().toISOString();
    const docId = `doc-${contentHash.slice(0, 12)}`;

    // Build initial document record
    const document: ResearchDocument = {
      documentId: docId,
      securityId: canonicalSecId,
      title: title || sanitizedFileName.replace(/\.[^/.]+$/, ''),
      fileName: sanitizedFileName,
      documentType: parseResult.documentType,
      sourceType: 'RESEARCH_DOCUMENT',
      provider,
      publishedAt: publishedAt || availableFrom || now.split('T')[0],
      availableFrom: availableFrom || publishedAt || now.split('T')[0],
      uploadedAt: now,
      uploadedBy,
      ownerUserId: resolvedOwner,
      userId: resolvedOwner,
      pageCount: parseResult.pageCount,
      characterCount: parseResult.characterCount,
      rowCount: parseResult.rowCount,
      contentHash,
      epistemicStatus: parseResult.epistemicStatus,
      isSimulated: false,
      processingStatus: parseResult.processingStatus === 'FAILED' ? 'FAILED' : 'PROCESSING',
      extractionWarnings: [...parseResult.extractionWarnings],
      metadata: {
        ...parseResult.metadata,
        contentHash
      }
    };

    // If parsing failed or format is unsupported, register as failed and return
    if (parseResult.processingStatus === 'FAILED') {
      documentRegistry.register(document);
      return {
        document,
        evidenceItemsCount: 0,
        chunksCount: 0,
        extractionWarnings: document.extractionWarnings || [],
        isDuplicate: false
      };
    }

    // 6. Convert parsed document into audited EvidenceItems
    const evidenceItems = documentEvidenceAdapter.createEvidenceItems(document, parseResult);
    if (resolvedOwner) {
      for (const item of evidenceItems) {
        item.ownerUserId = resolvedOwner;
        (item as any).userId = resolvedOwner;
      }
    }

    // 7. Chunk each EvidenceItem using the existing chunking engine
    const allChunks: EvidenceChunk[] = [];
    for (const item of evidenceItems) {
      const itemChunks = chunkEvidenceItem(item);
      allChunks.push(...itemChunks);
    }

    // 8. Generate embeddings for chunks using existing embedding provider
    const embeddingProvider = getEmbeddingProvider();
    if (allChunks.length > 0) {
      try {
        const chunkTexts = allChunks.map(c => `${c.title}: ${c.content}`);
        await embeddingProvider.embedTexts(chunkTexts);
      } catch {
        // Graceful fallback to lexical search if embedding fails/unconfigured
      }
    }

    // 9. Store evidence in existing EvidenceRepository
    const repo = evidenceService.getRepository();
    repo.addEvidenceBatch(evidenceItems);

    // 10. Mark document as READY and record IDs
    document.processingStatus = 'READY';
    document.evidenceIds = evidenceItems.map(e => e.evidenceId);
    document.chunkIds = allChunks.map(c => c.chunkId);

    documentRegistry.register(document);

    return {
      document,
      evidenceItemsCount: evidenceItems.length,
      chunksCount: allChunks.length,
      extractionWarnings: document.extractionWarnings || [],
      isDuplicate: false
    };
  }

  /**
   * Validates document parsing without committing to repository.
   */
  public async validateDocument(request: DocumentUploadRequest): Promise<{
    valid: boolean;
    format: string;
    characterCount: number;
    pageCount?: number;
    rowCount?: number;
    warnings: string[];
    contentHash: string;
  }> {
    let buffer: Buffer;
    if (request.fileContentBase64) {
      buffer = Buffer.from(request.fileContentBase64, 'base64');
    } else if (request.fileText !== undefined) {
      buffer = Buffer.from(request.fileText, 'utf-8');
    } else {
      throw new Error('Validation requires fileContentBase64 or fileText.');
    }

    const contentHash = computeContentHash(buffer);
    const parseResult = await parseDocument({
      fileName: request.fileName,
      fileBuffer: buffer,
      explicitFormat: request.documentType
    });

    return {
      valid: parseResult.processingStatus === 'READY',
      format: parseResult.documentType,
      characterCount: parseResult.characterCount,
      pageCount: parseResult.pageCount,
      rowCount: parseResult.rowCount,
      warnings: parseResult.extractionWarnings,
      contentHash
    };
  }

  /**
   * Removes document from registry and purges its evidence from EvidenceRepository.
   */
  public deleteDocument(documentId: string): boolean {
    const doc = documentRegistry.getDocument(documentId);
    if (!doc) return false;

    // Purge associated evidence from repository
    const repo = evidenceService.getRepository();
    if (doc.evidenceIds && doc.evidenceIds.length > 0) {
      for (const evId of doc.evidenceIds) {
        repo.removeEvidence(evId);
      }
    }

    return documentRegistry.deleteDocument(documentId);
  }
}

export const documentIngestionService = new DocumentIngestionService();
