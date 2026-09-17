/**
 * Phase 16: PostgreSQL Repository Implementations
 * 
 * Maps domain entities to/from PostgreSQL relations with strict type safety,
 * JSON serialization, and immutable historical artifact protection.
 */

import { PostgresClient } from './postgresClient';
import {
  ISecurityRepository,
  IResearchDocumentRepository,
  IPersistentEvidenceRepository,
  IResearchNotebookRepository,
  IResearchSnapshotRepository,
  IDecisionRepository,
  IStrategyRepository,
  IBacktestRepository,
  IWatchlistRepository,
  IAlertRepository,
  IPortfolioRepository,
  IResearchQueryRepository,
  IUserRepository,
  ISessionRepository
} from '../types';
import {
  CanonicalSecurity,
  ResearchDocument,
  EvidenceItem,
  EvidenceFilter,
  ResearchNotebook,
  ResearchSnapshot,
  InvestmentDecisionAssessment,
  Strategy,
  BacktestResult,
  AlertItem,
  HoldingPosition,
  ResearchQueryItem,
  DocumentProcessingStatus,
  User,
  AuthenticatedSession
} from '../../../src/types';

// ==========================================
// 1. SECURITY REPOSITORY
// ==========================================
export class PostgresSecurityRepository implements ISecurityRepository {
  constructor(private client: PostgresClient) {}

  public async get(id: string): Promise<CanonicalSecurity | null> {
    const res = await this.client.query('SELECT * FROM canonical_securities WHERE id = $1;', [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToSecurity(res.rows[0]);
  }

  public async getByTicker(ticker: string, market?: string): Promise<CanonicalSecurity | null> {
    let sql = 'SELECT * FROM canonical_securities WHERE UPPER(ticker) = UPPER($1)';
    const params: any[] = [ticker];
    if (market) {
      sql += ' AND UPPER(market) = UPPER($2)';
      params.push(market);
    }
    sql += ' LIMIT 1;';
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) return null;
    return this.mapRowToSecurity(res.rows[0]);
  }

  public async getAll(): Promise<CanonicalSecurity[]> {
    const res = await this.client.query('SELECT * FROM canonical_securities ORDER BY ticker ASC;');
    return res.rows.map(r => this.mapRowToSecurity(r));
  }

  public async save(security: CanonicalSecurity): Promise<CanonicalSecurity> {
    const sql = `
      INSERT INTO canonical_securities (
        id, ticker, company_name, market, exchange, country, currency, isin, sector, industry, aliases, provider_symbol_mappings, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        exchange = EXCLUDED.exchange,
        currency = EXCLUDED.currency,
        isin = EXCLUDED.isin,
        sector = EXCLUDED.sector,
        industry = EXCLUDED.industry,
        aliases = EXCLUDED.aliases,
        provider_symbol_mappings = EXCLUDED.provider_symbol_mappings,
        updated_at = NOW()
      RETURNING *;
    `;
    const params = [
      security.id,
      security.ticker,
      security.companyName,
      security.market,
      security.exchange,
      security.country,
      security.currency,
      security.isin || null,
      security.sector || null,
      security.industry || null,
      JSON.stringify((security as any).aliases || []),
      JSON.stringify((security as any).providerSymbolMappings || {})
    ];
    const res = await this.client.query(sql, params);
    return this.mapRowToSecurity(res.rows[0]);
  }

  public async saveMany(securities: CanonicalSecurity[]): Promise<number> {
    let saved = 0;
    for (const sec of securities) {
      await this.save(sec);
      saved++;
    }
    return saved;
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM canonical_securities;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToSecurity(row: any): CanonicalSecurity {
    return {
      id: row.id,
      canonicalId: row.id,
      ticker: row.ticker,
      symbol: row.ticker,
      companyName: row.company_name,
      market: row.market,
      exchange: row.exchange,
      country: row.country,
      currency: row.currency,
      isin: row.isin || undefined,
      sector: row.sector || undefined,
      industry: row.industry || undefined
    } as CanonicalSecurity;
  }
}

// ==========================================
// 2. RESEARCH DOCUMENT REPOSITORY
// ==========================================
export class PostgresResearchDocumentRepository implements IResearchDocumentRepository {
  constructor(private client: PostgresClient) {}

  public async get(documentId: string): Promise<ResearchDocument | null> {
    const res = await this.client.query('SELECT * FROM research_documents WHERE document_id = $1;', [documentId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToDocument(res.rows[0]);
  }

  public async getByHash(contentHash: string): Promise<ResearchDocument | null> {
    const res = await this.client.query('SELECT * FROM research_documents WHERE content_hash = $1;', [contentHash]);
    if (res.rows.length === 0) return null;
    return this.mapRowToDocument(res.rows[0]);
  }

  public async getAll(filter?: { securityId?: string; documentType?: string }): Promise<ResearchDocument[]> {
    let sql = 'SELECT * FROM research_documents WHERE 1=1';
    const params: any[] = [];
    if (filter?.documentType) {
      params.push(filter.documentType);
      sql += ` AND document_type = $${params.length}`;
    }
    sql += ' ORDER BY uploaded_at DESC;';
    const res = await this.client.query(sql, params);
    const docs = res.rows.map(r => this.mapRowToDocument(r));
    if (filter?.securityId) {
      return docs.filter(d => (d as any).securityAssociations?.some((s: any) => s.securityId === filter.securityId) || d.securityId === filter.securityId);
    }
    return docs;
  }

  public async save(doc: ResearchDocument): Promise<{ saved: boolean; isDuplicate: boolean; document: ResearchDocument }> {
    // Check duplicate by content hash
    const existing = await this.getByHash(doc.contentHash);
    if (existing) {
      return { saved: false, isDuplicate: true, document: existing };
    }

    const d = doc as any;
    const filename = doc.fileName || d.filename || 'unnamed_doc';
    const source = d.source || doc.provider || 'RESEARCH_DOCUMENT';

    const sql = `
      INSERT INTO research_documents (
        document_id, filename, document_type, content_hash, title, source, author,
        published_at, available_from, uploaded_at, processing_status,
        security_associations, metadata, extraction_metadata, page_row_provenance, storage_reference, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      RETURNING *;
    `;
    const params = [
      doc.documentId,
      filename,
      doc.documentType,
      doc.contentHash,
      doc.title,
      source,
      doc.author || null,
      doc.publishedAt ? new Date(doc.publishedAt) : null,
      doc.availableFrom ? new Date(doc.availableFrom) : null,
      doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
      doc.processingStatus,
      JSON.stringify(d.securityAssociations || (doc.securityId ? [{ securityId: doc.securityId }] : [])),
      JSON.stringify(doc.metadata || {}),
      JSON.stringify(d.extractionMetadata || {}),
      JSON.stringify(d.pageRowProvenance || []),
      d.storageReference || null
    ];
    const res = await this.client.query(sql, params);
    return { saved: true, isDuplicate: false, document: this.mapRowToDocument(res.rows[0]) };
  }

  public async updateStatus(documentId: string, status: DocumentProcessingStatus, metadata?: any): Promise<boolean> {
    const res = await this.client.query(
      'UPDATE research_documents SET processing_status = $1, metadata = COALESCE($2, metadata), updated_at = NOW() WHERE document_id = $3;',
      [status, metadata ? JSON.stringify(metadata) : null, documentId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM research_documents;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToDocument(row: any): ResearchDocument {
    return {
      documentId: row.document_id,
      fileName: row.filename,
      filename: row.filename,
      documentType: row.document_type,
      contentHash: row.content_hash,
      title: row.title,
      sourceType: 'RESEARCH_DOCUMENT' as const,
      provider: row.source || 'SEC_EDGAR',
      author: row.author || undefined,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      availableFrom: row.available_from ? new Date(row.available_from).toISOString() : undefined,
      uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
      processingStatus: row.processing_status,
      epistemicStatus: 'REAL' as const,
      isSimulated: false,
      securityAssociations: typeof row.security_associations === 'string' ? JSON.parse(row.security_associations) : (row.security_associations || []),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      extractionMetadata: typeof row.extraction_metadata === 'string' ? JSON.parse(row.extraction_metadata) : (row.extraction_metadata || {}),
      pageRowProvenance: typeof row.page_row_provenance === 'string' ? JSON.parse(row.page_row_provenance) : (row.page_row_provenance || []),
      storageReference: row.storage_reference || undefined
    } as unknown as ResearchDocument;
  }
}

// ==========================================
// 3. EVIDENCE REPOSITORY
// ==========================================
export class PostgresEvidenceRepository implements IPersistentEvidenceRepository {
  constructor(private client: PostgresClient) {}

  public async addEvidence(item: EvidenceItem): Promise<boolean> {
    if (!item || !item.evidenceId) return false;

    // Check if evidence already exists
    const existing = await this.getEvidence(item.evidenceId);
    if (existing) {
      return false; // Immutable evidence: no overwriting
    }

    const sql = `
      INSERT INTO evidence_items (
        evidence_id, security_id, source_type, provider, document_id, document_type,
        title, content, structured_value, unit, currency, published_at, filing_date,
        period_start, period_end, retrieved_at, epistemic_status, is_simulated,
        source_reference, metadata, conflict_info, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (evidence_id) DO NOTHING;
    `;
    const params = [
      item.evidenceId,
      item.securityId || null,
      item.sourceType,
      item.provider,
      item.documentId || null,
      item.documentType || null,
      item.title,
      item.content,
      item.structuredValue !== undefined ? JSON.stringify(item.structuredValue) : null,
      item.unit || null,
      item.currency || null,
      item.publishedAt ? new Date(item.publishedAt) : null,
      item.filingDate ? new Date(item.filingDate) : null,
      item.periodStart ? new Date(item.periodStart) : null,
      item.periodEnd ? new Date(item.periodEnd) : null,
      item.retrievedAt ? new Date(item.retrievedAt) : new Date(),
      item.epistemicStatus,
      Boolean(item.isSimulated),
      JSON.stringify(item.sourceReference || {}),
      JSON.stringify(item.metadata || {}),
      (item as any).conflictInfo ? JSON.stringify((item as any).conflictInfo) : null,
      (item as any).version || 1
    ];

    const res = await this.client.query(sql, params);
    return (res.rowCount ?? 0) > 0;
  }

  public async getEvidence(evidenceId: string): Promise<EvidenceItem | null> {
    const res = await this.client.query('SELECT * FROM evidence_items WHERE evidence_id = $1;', [evidenceId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToEvidence(res.rows[0]);
  }

  public async get(evidenceId: string): Promise<EvidenceItem | null> {
    return this.getEvidence(evidenceId);
  }

  public async queryEvidence(filter: EvidenceFilter): Promise<EvidenceItem[]> {
    let sql = 'SELECT * FROM evidence_items WHERE 1=1';
    const params: any[] = [];

    if (filter.securityId) {
      params.push(filter.securityId);
      sql += ` AND security_id = $${params.length}`;
    }
    if (filter.sourceType) {
      const types = Array.isArray(filter.sourceType) ? filter.sourceType : [filter.sourceType];
      params.push(types);
      sql += ` AND source_type = ANY($${params.length})`;
    }
    if (filter.epistemicStatus) {
      const statuses = Array.isArray(filter.epistemicStatus) ? filter.epistemicStatus : [filter.epistemicStatus];
      params.push(statuses);
      sql += ` AND epistemic_status = ANY($${params.length})`;
    }
    if (filter.asOfDate) {
      const asOfStr = typeof filter.asOfDate === 'string' ? filter.asOfDate : (filter.asOfDate as Date).toISOString();
      const targetDate = asOfStr.includes('T') ? new Date(asOfStr) : new Date(`${asOfStr}T23:59:59.999Z`);
      params.push(targetDate);
      sql += ` AND (published_at IS NULL OR published_at <= $${params.length})`;
    }
    sql += ' ORDER BY published_at DESC NULLS LAST, created_at DESC;';

    const res = await this.client.query(sql, params);
    return res.rows.map(r => this.mapRowToEvidence(r));
  }

  public async getHistoricalEvidence(evidenceId: string, asOfDate?: string): Promise<EvidenceItem | null> {
    const item = await this.getEvidence(evidenceId);
    if (!item) return null;
    if (asOfDate && item.publishedAt) {
      const asOfStr = typeof asOfDate === 'string' ? asOfDate : (asOfDate as any).toISOString();
      const targetTime = asOfStr.includes('T') ? new Date(asOfStr).getTime() : new Date(`${asOfStr}T23:59:59.999Z`).getTime();
      if (new Date(item.publishedAt).getTime() > targetTime) {
        return null; // PIT violation: not available at asOfDate
      }
    }
    return item;
  }

  public async getEvidenceLineage(evidenceId: string): Promise<EvidenceItem[]> {
    // In our architecture, evidence versions or root concept relations are queried
    const root = await this.getEvidence(evidenceId);
    if (!root) return [];
    return [root];
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM evidence_items;');
    return Number(res.rows[0]?.total || 0);
  }

  public async getAll(): Promise<EvidenceItem[]> {
    const res = await this.client.query('SELECT * FROM evidence_items ORDER BY created_at DESC;');
    return res.rows.map(r => this.mapRowToEvidence(r));
  }

  private mapRowToEvidence(row: any): EvidenceItem {
    return {
      evidenceId: row.evidence_id,
      securityId: row.security_id || undefined,
      sourceType: row.source_type,
      provider: row.provider,
      documentId: row.document_id || undefined,
      documentType: row.document_type || undefined,
      title: row.title,
      content: row.content,
      structuredValue: row.structured_value !== null ? (typeof row.structured_value === 'string' ? JSON.parse(row.structured_value) : row.structured_value) : undefined,
      unit: row.unit || undefined,
      currency: row.currency || undefined,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      filingDate: row.filing_date ? new Date(row.filing_date).toISOString() : undefined,
      periodStart: row.period_start ? new Date(row.period_start).toISOString() : undefined,
      periodEnd: row.period_end ? new Date(row.period_end).toISOString() : undefined,
      retrievedAt: row.retrieved_at ? new Date(row.retrieved_at).toISOString() : new Date().toISOString(),
      epistemicStatus: row.epistemic_status,
      isSimulated: Boolean(row.is_simulated)
    } as EvidenceItem;
  }
}

// ==========================================
// 4. RESEARCH NOTEBOOK REPOSITORY
// ==========================================
export class PostgresResearchNotebookRepository implements IResearchNotebookRepository {
  constructor(private client: PostgresClient) {}

  public async get(notebookId: string): Promise<ResearchNotebook | null> {
    const res = await this.client.query('SELECT * FROM research_notebooks WHERE notebook_id = $1;', [notebookId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToNotebook(res.rows[0]);
  }

  public async getBySecurityId(securityId: string): Promise<ResearchNotebook | null> {
    const res = await this.client.query('SELECT * FROM research_notebooks WHERE security_id = $1 ORDER BY updated_at DESC LIMIT 1;', [securityId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToNotebook(res.rows[0]);
  }

  public async save(notebook: ResearchNotebook): Promise<ResearchNotebook> {
    const sql = `
      INSERT INTO research_notebooks (
        notebook_id, security_id, query_context, source_registry, evidence_references,
        claims, thesis, bull_case, bear_case, catalysts, risks, evidence_gaps,
        contradictions, invalidation_conditions, quantitative_context, portfolio_context,
        snapshot_references, framework_version, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (notebook_id) DO UPDATE SET
        source_registry = EXCLUDED.source_registry,
        evidence_references = EXCLUDED.evidence_references,
        claims = EXCLUDED.claims,
        thesis = EXCLUDED.thesis,
        bull_case = EXCLUDED.bull_case,
        bear_case = EXCLUDED.bear_case,
        catalysts = EXCLUDED.catalysts,
        risks = EXCLUDED.risks,
        evidence_gaps = EXCLUDED.evidence_gaps,
        contradictions = EXCLUDED.contradictions,
        invalidation_conditions = EXCLUDED.invalidation_conditions,
        quantitative_context = EXCLUDED.quantitative_context,
        portfolio_context = EXCLUDED.portfolio_context,
        snapshot_references = EXCLUDED.snapshot_references,
        updated_at = NOW()
      RETURNING *;
    `;
    const n = notebook as any;
    const notebookId = n.notebookId || n.id;
    const securityId = n.securityId || n.security?.id || 'unknown';
    const queryContext = n.title || n.queryContext || null;

    const params = [
      notebookId,
      securityId,
      queryContext,
      JSON.stringify(n.sourceRegistry || []),
      JSON.stringify(n.evidenceReferences || []),
      JSON.stringify(n.claims || []),
      JSON.stringify(n.thesis || {}),
      JSON.stringify(n.bullCase || []),
      JSON.stringify(n.bearCase || []),
      JSON.stringify(n.catalysts || []),
      JSON.stringify(n.risks || []),
      JSON.stringify(n.evidenceGaps || []),
      JSON.stringify(n.contradictions || []),
      JSON.stringify(n.invalidationConditions || []),
      JSON.stringify(n.quantitativeContext || {}),
      JSON.stringify(n.portfolioContext || {}),
      JSON.stringify(n.snapshots || []),
      n.frameworkVersion || '1.0.0'
    ];
    const res = await this.client.query(sql, params);
    return this.mapRowToNotebook(res.rows[0]);
  }

  public async getAll(): Promise<ResearchNotebook[]> {
    const res = await this.client.query('SELECT * FROM research_notebooks ORDER BY updated_at DESC;');
    return res.rows.map(r => this.mapRowToNotebook(r));
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM research_notebooks;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToNotebook(row: any): ResearchNotebook {
    const parse = (val: any, def: any) => typeof val === 'string' ? JSON.parse(val) : (val || def);
    return {
      notebookId: row.notebook_id,
      securityId: row.security_id,
      symbol: (row.security_id || '').replace(/^(us|in)-/, '').toUpperCase(),
      title: row.query_context || `Research Notebook ${row.security_id}`,
      description: '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      sourceCount: parse(row.source_registry, []).length,
      evidenceCount: parse(row.evidence_references, []).length,
      lastResearchDate: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      researchAsOfDate: null,
      sourceCoverage: {
        availableSources: [],
        missingSources: [],
        unavailableProviders: [],
        latestSourceDate: null,
        oldestSourceDate: null,
        sourceCount: 0,
        evidenceCount: 0,
        status: 'HIGH_EVIDENCE_COVERAGE'
      },
      provenance: {
        provider: 'POSTGRES',
        asOfDate: new Date().toISOString(),
        retrievedAt: new Date().toISOString()
      }
    };
  }
}

// ==========================================
// 5. RESEARCH SNAPSHOT REPOSITORY (IMMUTABLE)
// ==========================================
export class PostgresResearchSnapshotRepository implements IResearchSnapshotRepository {
  constructor(private client: PostgresClient) {}

  public async get(snapshotId: string): Promise<ResearchSnapshot | null> {
    const res = await this.client.query('SELECT * FROM research_snapshots WHERE snapshot_id = $1;', [snapshotId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToSnapshot(res.rows[0]);
  }

  public async getByNotebookId(notebookId: string): Promise<ResearchSnapshot[]> {
    const res = await this.client.query('SELECT * FROM research_snapshots WHERE notebook_id = $1 ORDER BY generated_at ASC;', [notebookId]);
    return res.rows.map(r => this.mapRowToSnapshot(r));
  }

  public async getBySecurityId(securityId: string): Promise<ResearchSnapshot[]> {
    const res = await this.client.query('SELECT * FROM research_snapshots WHERE security_id = $1 ORDER BY generated_at ASC;', [securityId]);
    return res.rows.map(r => this.mapRowToSnapshot(r));
  }

  public async getLatest(securityId: string, asOfDate?: string): Promise<ResearchSnapshot | null> {
    let sql = 'SELECT * FROM research_snapshots WHERE security_id = $1';
    const params: any[] = [securityId];
    if (asOfDate) {
      params.push(asOfDate);
      sql += ` AND as_of_date <= $${params.length}`;
    }
    sql += ' ORDER BY as_of_date DESC, generated_at DESC LIMIT 1;';
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) return null;
    return this.mapRowToSnapshot(res.rows[0]);
  }

  public async save(snapshot: ResearchSnapshot): Promise<ResearchSnapshot> {
    // Snapshots are IMMUTABLE: if exists, return existing
    const existing = await this.get(snapshot.snapshotId);
    if (existing) {
      return existing;
    }

    const s = snapshot as any;
    const asOfDate = s.researchAsOfDate || s.asOfDate || new Date().toISOString().split('T')[0];
    const generatedAt = s.createdAt || s.generatedAt ? new Date(s.createdAt || s.generatedAt) : new Date();

    const sql = `
      INSERT INTO research_snapshots (
        snapshot_id, notebook_id, security_id, as_of_date, previous_snapshot_id,
        framework_version, evidence_ids, claim_ids, thesis, bull_case, bear_case,
        catalysts, risks, what_changed, contradictions, evidence_gaps,
        invalidation_conditions, quantitative_context, portfolio_context,
        source_coverage, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (snapshot_id) DO NOTHING
      RETURNING *;
    `;
    const params = [
      s.snapshotId,
      s.notebookId,
      s.securityId,
      asOfDate,
      s.previousSnapshotId || null,
      s.frameworkVersion || '1.0.0',
      JSON.stringify(s.evidenceIds || []),
      JSON.stringify(s.claims || s.claimIds || []),
      typeof s.thesis === 'object' ? JSON.stringify(s.thesis) : (s.thesis || null),
      JSON.stringify(s.bullCase || s.thesis?.bullCase || []),
      JSON.stringify(s.bearCase || s.thesis?.bearCase || []),
      JSON.stringify(s.catalysts || []),
      JSON.stringify(s.risks || []),
      s.whatChanged || s.thesis?.whatChanged ? JSON.stringify(s.whatChanged || s.thesis?.whatChanged) : null,
      JSON.stringify(s.conflicts || s.contradictions || []),
      JSON.stringify(s.evidenceGaps || s.thesis?.evidenceGaps || {}),
      JSON.stringify(s.invalidationConditions || s.thesis?.thesisInvalidationConditions || []),
      JSON.stringify(s.quantitativeContext || s.thesis?.quantitativeContext || {}),
      JSON.stringify(s.portfolioContext || s.thesis?.portfolioContext || {}),
      JSON.stringify(s.sourceCoverage || {}),
      generatedAt
    ];
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) {
      return (await this.get(snapshot.snapshotId))!;
    }
    return this.mapRowToSnapshot(res.rows[0]);
  }

  public async getAll(): Promise<ResearchSnapshot[]> {
    const res = await this.client.query('SELECT * FROM research_snapshots ORDER BY generated_at DESC;');
    return res.rows.map(r => this.mapRowToSnapshot(r));
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM research_snapshots;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToSnapshot(row: any): ResearchSnapshot {
    const parse = (val: any, def: any) => typeof val === 'string' ? JSON.parse(val) : (val || def);
    const rawThesis = parse(row.thesis, null);
    const parsedThesis = typeof rawThesis === 'object' && rawThesis !== null ? rawThesis : {
      executiveThesis: typeof rawThesis === 'string' ? rawThesis : '',
      bullCase: parse(row.bull_case, { summary: '', points: [], evidenceIds: [] }),
      bearCase: parse(row.bear_case, { summary: '', points: [], evidenceIds: [] }),
      catalysts: parse(row.catalysts, []),
      risks: parse(row.risks, []),
      whatChanged: parse(row.what_changed, { status: 'STABLE', hasPriorSnapshot: false, changes: [], newEvidenceCount: 0 }),
      evidenceGaps: parse(row.evidence_gaps, { available: [], missing: [], unavailable: [] }),
      contradictions: parse(row.contradictions, []),
      thesisInvalidationConditions: parse(row.invalidation_conditions, []),
      confidenceCoverage: 'HIGH_EVIDENCE_COVERAGE'
    };

    return {
      snapshotId: row.snapshot_id,
      notebookId: row.notebook_id,
      securityId: row.security_id,
      createdAt: row.generated_at ? new Date(row.generated_at).toISOString() : new Date().toISOString(),
      researchAsOfDate: row.as_of_date,
      evidenceIds: parse(row.evidence_ids, []),
      thesis: parsedThesis,
      claims: parse(row.claim_ids, []),
      risks: parse(row.risks, []),
      catalysts: parse(row.catalysts, []),
      conflicts: parse(row.contradictions, []),
      evidenceGaps: parse(row.evidence_gaps, { available: [], missing: [], unavailable: [] })
    };
  }
}

// ==========================================
// 6. INVESTMENT DECISION REPOSITORY (IMMUTABLE)
// ==========================================
export class PostgresDecisionRepository implements IDecisionRepository {
  constructor(private client: PostgresClient) {}

  public async get(decisionId: string): Promise<InvestmentDecisionAssessment | null> {
    const res = await this.client.query('SELECT * FROM investment_decisions WHERE decision_id = $1;', [decisionId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToDecision(res.rows[0]);
  }

  public async getLatest(securityId: string, asOfDate?: string): Promise<InvestmentDecisionAssessment | null> {
    let sql = 'SELECT * FROM investment_decisions WHERE security_id = $1';
    const params: any[] = [securityId];
    if (asOfDate) {
      params.push(asOfDate);
      sql += ` AND as_of_date <= $${params.length}`;
    }
    sql += ' ORDER BY as_of_date DESC, generated_at DESC LIMIT 1;';
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) return null;
    return this.mapRowToDecision(res.rows[0]);
  }

  public async getHistory(securityId: string): Promise<InvestmentDecisionAssessment[]> {
    const res = await this.client.query(
      'SELECT * FROM investment_decisions WHERE security_id = $1 ORDER BY as_of_date DESC, generated_at DESC;',
      [securityId]
    );
    return res.rows.map(r => this.mapRowToDecision(r));
  }

  public async save(decision: InvestmentDecisionAssessment): Promise<InvestmentDecisionAssessment> {
    // Decisions are IMMUTABLE: never overwrite an existing historical record
    const existing = await this.get(decision.decisionId);
    if (existing) {
      return existing;
    }

    const d = decision as any;
    const securityId = d.securityId || d.canonicalSecurity?.id || 'unknown';

    const sql = `
      INSERT INTO investment_decisions (
        decision_id, security_id, as_of_date, composite_score, overall_assessment,
        conviction, dimension_assessments, invalidation_conditions, portfolio_context,
        quant_context, backtest_context, explanation, weights_config, score_inputs,
        data_quality, limitations, is_analytical_only, execution_prohibited,
        framework_version, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (decision_id) DO NOTHING
      RETURNING *;
    `;
    const params = [
      d.decisionId,
      securityId,
      d.asOfDate,
      d.compositeScore,
      d.overallAssessment,
      d.conviction,
      JSON.stringify(d.dimensionAssessments || {}),
      JSON.stringify(d.invalidationConditions || []),
      JSON.stringify(d.portfolioContext || {}),
      JSON.stringify(d.quantitativeContext || d.quantContext || {}),
      JSON.stringify(d.backtestContext || {}),
      JSON.stringify(d.explanation || {}),
      JSON.stringify(d.weightsConfig || {}),
      JSON.stringify(d.scoreInputs || {}),
      JSON.stringify(d.dataQuality || {}),
      JSON.stringify(d.limitations || []),
      true,
      true,
      d.frameworkVersion || '1.0.0',
      d.generatedAt ? new Date(d.generatedAt) : new Date()
    ];
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) {
      return (await this.get(decision.decisionId))!;
    }
    return this.mapRowToDecision(res.rows[0]);
  }

  public async getAll(): Promise<InvestmentDecisionAssessment[]> {
    const res = await this.client.query('SELECT * FROM investment_decisions ORDER BY generated_at DESC;');
    return res.rows.map(r => this.mapRowToDecision(r));
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM investment_decisions;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToDecision(row: any): InvestmentDecisionAssessment {
    const parse = (val: any, def: any) => typeof val === 'string' ? JSON.parse(val) : (val || def);
    const dims = parse(row.dimension_assessments, {});
    return {
      decisionId: row.decision_id,
      securityId: row.security_id,
      canonicalSecurity: {
        id: row.security_id,
        canonicalId: row.security_id,
        ticker: row.security_id.replace(/^(us|in)-/, '').toUpperCase(),
        symbol: row.security_id.replace(/^(us|in)-/, '').toUpperCase(),
        companyName: row.security_id,
        market: row.security_id.startsWith('in-') ? 'INDIA' : 'US',
        exchange: row.security_id.startsWith('in-') ? 'NSE' : 'NASDAQ',
        country: row.security_id.startsWith('in-') ? 'IN' : 'US',
        currency: row.security_id.startsWith('in-') ? 'INR' : 'USD'
      },
      asOfDate: row.as_of_date,
      compositeScore: Number(row.composite_score),
      overallAssessment: row.overall_assessment,
      conviction: row.conviction,
      dimensionAssessments: dims,
      dimensionsList: Object.values(dims),
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      evidenceCoverage: {
        rating: 'HIGH',
        totalEvidenceCount: 0,
        availableCategories: [],
        missingCategories: [],
        details: ''
      },
      keyDrivers: [],
      counterEvidence: [],
      keyRisks: [],
      catalysts: [],
      thesisStatus: {
        status: 'STABLE',
        summary: ''
      },
      invalidationConditions: parse(row.invalidation_conditions, []),
      portfolioContext: parse(row.portfolio_context, { isHeld: false, marginalRiskRating: 'NOT_HELD', implication: '' }),
      quantitativeContext: parse(row.quant_context, {}),
      valuationContext: {
        status: 'FAIR',
        availableMetrics: [],
        missingMetrics: [],
        rationale: ''
      },
      fundamentalContext: {
        status: 'STABLE',
        availablePeriodsCount: 0,
        summary: ''
      },
      marketContext: {
        currentPrice: 0,
        currency: 'USD',
        trend: 'NEUTRAL',
        provider: 'TWELVE_DATA',
        epistemicStatus: 'REAL'
      },
      dataQuality: parse(row.data_quality, {}),
      explanation: parse(row.explanation, {}),
      limitations: parse(row.limitations, []),
      isAnalyticalOnly: true as const,
      executionProhibited: true as const,
      frameworkVersion: row.framework_version || '1.0.0',
      generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : new Date().toISOString()
    } as InvestmentDecisionAssessment;
  }
}

// ==========================================
// 7. STRATEGY REPOSITORY
// ==========================================
export class PostgresStrategyRepository implements IStrategyRepository {
  constructor(private client: PostgresClient) {}

  public async get(strategyId: string, _version?: string): Promise<Strategy | null> {
    const res = await this.client.query('SELECT * FROM strategies WHERE strategy_id = $1;', [strategyId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToStrategy(res.rows[0]);
  }

  public async getAll(): Promise<Strategy[]> {
    const res = await this.client.query('SELECT * FROM strategies ORDER BY name ASC;');
    return res.rows.map(r => this.mapRowToStrategy(r));
  }

  public async save(strategy: Strategy): Promise<Strategy> {
    const s = strategy as any;
    const strategyId = s.id || s.strategyId;
    const name = s.title || s.name || strategyId;
    const description = s.description || null;
    const prompt = s.prompt || '';
    const status = s.status || 'AI Generated Strategy';
    const targetUniverse = s.targetUniverse || 'US_EQUITIES';
    const rebalanceFrequency = s.rebalanceFrequency || 'DAILY';

    const sql = `
      INSERT INTO strategies (
        strategy_id, name, description, rules, indicators, position_sizing,
        risk_constraints, portfolio_construction, parameters, version, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (strategy_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        rules = EXCLUDED.rules,
        indicators = EXCLUDED.indicators,
        position_sizing = EXCLUDED.position_sizing,
        risk_constraints = EXCLUDED.risk_constraints,
        portfolio_construction = EXCLUDED.portfolio_construction,
        parameters = EXCLUDED.parameters,
        version = EXCLUDED.version,
        updated_at = NOW()
      RETURNING *;
    `;
    const params = [
      strategyId,
      name,
      description,
      JSON.stringify(s.rules || []),
      JSON.stringify(s.indicators || []),
      JSON.stringify(s.positionSizing || {}),
      JSON.stringify(s.riskConstraints || []),
      JSON.stringify(s.portfolioConstruction || {}),
      JSON.stringify(s.parameters || {}),
      s.version || '1.0.0'
    ];
    const res = await this.client.query(sql, params);
    return this.mapRowToStrategy(res.rows[0]);
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM strategies;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToStrategy(row: any): Strategy {
    const parse = (val: any, def: any) => typeof val === 'string' ? JSON.parse(val) : (val || def);
    return {
      id: row.strategy_id,
      title: row.name,
      description: row.description || '',
      prompt: row.prompt || '',
      status: row.status || 'AI Generated Strategy',
      targetUniverse: row.target_universe || 'US_EQUITIES',
      rebalanceFrequency: row.rebalance_frequency || 'DAILY',
      rules: parse(row.rules, []),
      lastRun: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
    } as Strategy;
  }
}

// ==========================================
// 8. BACKTEST REPOSITORY (IMMUTABLE)
// ==========================================
export class PostgresBacktestRepository implements IBacktestRepository {
  constructor(private client: PostgresClient) {}

  public async get(backtestId: string): Promise<BacktestResult | null> {
    const res = await this.client.query('SELECT * FROM backtests WHERE backtest_id = $1;', [backtestId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToBacktest(res.rows[0]);
  }

  public async getByStrategyId(strategyId: string): Promise<BacktestResult[]> {
    const res = await this.client.query('SELECT * FROM backtests WHERE strategy_id = $1 ORDER BY generated_at DESC;', [strategyId]);
    return res.rows.map(r => this.mapRowToBacktest(r));
  }

  public async getAll(): Promise<BacktestResult[]> {
    const res = await this.client.query('SELECT * FROM backtests ORDER BY generated_at DESC;');
    return res.rows.map(r => this.mapRowToBacktest(r));
  }

  public async save(backtest: BacktestResult): Promise<BacktestResult> {
    // Backtests are IMMUTABLE: never rerun or overwrite
    const b = backtest as any;
    const backtestId = b.backtestId || b.id;
    const existing = await this.get(backtestId);
    if (existing) {
      return existing;
    }

    const strategyId = b.strategyId || b.configuration?.strategyId || 'unknown';
    const strategyVersion = b.strategyVersion || b.configuration?.strategyVersion || '1.0.0';
    const configuration = b.configuration || {};
    const metrics = b.metrics || {
      totalReturn: b.totalReturn,
      totalReturnPct: b.totalReturnPct,
      cagr: b.cagr,
      sharpeRatio: b.sharpeRatio,
      sortinoRatio: b.sortinoRatio,
      maxDrawdown: b.maxDrawdown,
      annualizedVol: b.annualizedVol,
      winRate: b.winRate
    };

    const sql = `
      INSERT INTO backtests (
        backtest_id, strategy_id, strategy_version, configuration, metrics,
        equity_curve, trades, accounting, benchmark, status, data_fingerprint,
        is_analytical_only, execution_prohibited, framework_version, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (backtest_id) DO NOTHING
      RETURNING *;
    `;
    const params = [
      backtestId,
      strategyId,
      strategyVersion,
      JSON.stringify(configuration),
      JSON.stringify(metrics),
      JSON.stringify(b.equityCurve || []),
      JSON.stringify(b.trades || []),
      JSON.stringify(b.accounting || {}),
      JSON.stringify(b.benchmark || {}),
      b.status || 'COMPLETED',
      b.dataFingerprint || null,
      b.isAnalyticalOnly ?? true,
      b.executionProhibited ?? true,
      b.frameworkVersion || '1.0.0',
      b.generatedAt ? new Date(b.generatedAt) : new Date()
    ];
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) {
      return (await this.get(backtestId))!;
    }
    return this.mapRowToBacktest(res.rows[0]);
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM backtests;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToBacktest(row: any): BacktestResult {
    const parse = (val: any, def: any) => typeof val === 'string' ? JSON.parse(val) : (val || def);
    const metrics = parse(row.metrics, {});
    const trades = parse(row.trades, []);
    return {
      id: row.backtest_id,
      backtestId: row.backtest_id,
      strategyId: row.strategy_id,
      strategyVersion: row.strategy_version,
      configuration: parse(row.configuration, {}),
      totalReturn: metrics.totalReturn ?? metrics.totalReturnPct ?? 0,
      totalReturnPct: metrics.totalReturnPct,
      cagr: metrics.cagr ?? 0,
      sharpeRatio: metrics.sharpeRatio ?? 0,
      sortinoRatio: metrics.sortinoRatio ?? 0,
      maxDrawdown: metrics.maxDrawdown ?? 0,
      annualizedVol: metrics.annualizedVol ?? 0,
      winRate: metrics.winRate ?? 0,
      tradesCount: Array.isArray(trades) ? trades.length : 0,
      benchmarkTotalReturn: parse(row.benchmark, {}).totalReturn ?? 0,
      equityCurve: parse(row.equity_curve, []),
      trades: trades,
      status: row.status
    } as BacktestResult;
  }
}

// ==========================================
// 9. WATCHLIST REPOSITORY
// ==========================================
export class PostgresWatchlistRepository implements IWatchlistRepository {
  constructor(private client: PostgresClient) {}

  public async getWatchlist(id = 'default'): Promise<string[]> {
    const res = await this.client.query('SELECT security_ids FROM watchlists WHERE watchlist_id = $1;', [id]);
    if (res.rows.length === 0) return [];
    const val = res.rows[0].security_ids;
    return typeof val === 'string' ? JSON.parse(val) : (val || []);
  }

  public async saveWatchlist(tickers: string[], id = 'default'): Promise<void> {
    const sql = `
      INSERT INTO watchlists (watchlist_id, name, security_ids, updated_at)
      VALUES ($1, 'Default Watchlist', $2, NOW())
      ON CONFLICT (watchlist_id) DO UPDATE SET
        security_ids = EXCLUDED.security_ids,
        updated_at = NOW();
    `;
    await this.client.query(sql, [id, JSON.stringify(tickers)]);
  }

  public async addTicker(ticker: string, id = 'default'): Promise<void> {
    const list = await this.getWatchlist(id);
    if (!list.includes(ticker)) {
      list.push(ticker);
      await this.saveWatchlist(list, id);
    }
  }

  public async removeTicker(ticker: string, id = 'default'): Promise<void> {
    const list = await this.getWatchlist(id);
    const updated = list.filter(t => t !== ticker);
    await this.saveWatchlist(updated, id);
  }
}

// ==========================================
// 10. ALERT REPOSITORY
// ==========================================
export class PostgresAlertRepository implements IAlertRepository {
  constructor(private client: PostgresClient) {}

  public async get(alertId: string): Promise<AlertItem | null> {
    const res = await this.client.query('SELECT * FROM alerts WHERE alert_id = $1;', [alertId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToAlert(res.rows[0]);
  }

  public async getAll(): Promise<AlertItem[]> {
    const res = await this.client.query('SELECT * FROM alerts ORDER BY timestamp DESC;');
    return res.rows.map(r => this.mapRowToAlert(r));
  }

  public async save(alert: AlertItem): Promise<AlertItem> {
    const a = alert as any;
    const message = a.message || a.whatChanged || '';
    const sql = `
      INSERT INTO alerts (alert_id, security_id, ticker, type, severity, title, message, timestamp, is_read)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (alert_id) DO UPDATE SET
        is_read = EXCLUDED.is_read
      RETURNING *;
    `;
    const params = [
      alert.id,
      alert.ticker || null,
      alert.ticker || '',
      alert.type,
      alert.severity,
      alert.title,
      message,
      alert.timestamp,
      alert.read ?? alert.isRead ?? false
    ];
    const res = await this.client.query(sql, params);
    return this.mapRowToAlert(res.rows[0]);
  }

  public async saveMany(alerts: AlertItem[]): Promise<number> {
    let saved = 0;
    for (const a of alerts) {
      await this.save(a);
      saved++;
    }
    return saved;
  }

  public async update(alertId: string, updates: Partial<AlertItem>): Promise<boolean> {
    if (updates.read !== undefined || (updates as any).isRead !== undefined) {
      const readVal = updates.read ?? (updates as any).isRead;
      const res = await this.client.query('UPDATE alerts SET is_read = $1 WHERE alert_id = $2;', [readVal, alertId]);
      return (res.rowCount ?? 0) > 0;
    }
    return false;
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM alerts;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToAlert(row: any): AlertItem {
    return {
      id: row.alert_id,
      ticker: row.ticker,
      type: row.type,
      severity: row.severity,
      title: row.title,
      whatChanged: row.message || '',
      whyItMatters: '',
      evidence: { source: 'SYSTEM', filingDate: row.timestamp, confidence: 1.0 },
      timestamp: row.timestamp,
      read: Boolean(row.is_read),
      isRead: Boolean(row.is_read),
      provenanceType: 'FACT'
    };
  }
}

// ==========================================
// 11. PORTFOLIO REPOSITORY
// ==========================================
export class PostgresPortfolioRepository implements IPortfolioRepository {
  constructor(private client: PostgresClient) {}

  public async getPositions(portfolioId = 'default'): Promise<HoldingPosition[]> {
    const res = await this.client.query('SELECT * FROM portfolio_positions WHERE portfolio_id = $1;', [portfolioId]);
    return res.rows.map(r => ({
      ticker: r.ticker,
      shares: Number(r.shares),
      avgCost: Number(r.avg_cost)
    }));
  }

  public async savePositions(positions: HoldingPosition[], portfolioId = 'default'): Promise<void> {
    await this.client.runTransaction(async client => {
      await client.query('DELETE FROM portfolio_positions WHERE portfolio_id = $1;', [portfolioId]);
      for (const pos of positions) {
        await client.query(
          'INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost, updated_at) VALUES ($1, $2, $3, $4, NOW());',
          [portfolioId, pos.ticker, pos.shares, pos.avgCost]
        );
      }
    });
  }

  public async updatePosition(ticker: string, shares: number, avgCost: number, portfolioId = 'default'): Promise<void> {
    const sql = `
      INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (portfolio_id, ticker) DO UPDATE SET
        shares = EXCLUDED.shares,
        avg_cost = EXCLUDED.avg_cost,
        updated_at = NOW();
    `;
    await this.client.query(sql, [portfolioId, ticker, shares, avgCost]);
  }
}

// ==========================================
// 12. RESEARCH QUERY REPOSITORY
// ==========================================
export class PostgresResearchQueryRepository implements IResearchQueryRepository {
  constructor(private client: PostgresClient) {}

  public async get(queryId: string): Promise<ResearchQueryItem | null> {
    const res = await this.client.query('SELECT * FROM research_queries WHERE query_id = $1;', [queryId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToQuery(res.rows[0]);
  }

  public async getAll(): Promise<ResearchQueryItem[]> {
    const res = await this.client.query('SELECT * FROM research_queries ORDER BY created_at DESC;');
    return res.rows.map(r => this.mapRowToQuery(r));
  }

  public async save(query: ResearchQueryItem): Promise<ResearchQueryItem> {
    const q = query as any;
    const queryId = q.id || q.queryId;
    const queryString = q.query || '';
    const date = q.date || new Date().toISOString();
    const answerSummary = q.answerSummary || q.generatedAnswer || '';
    const groundedFacts = q.groundedFacts || q.evidenceReferences || [];
    const sources = q.sources || q.securityContext || [];

    const sql = `
      INSERT INTO research_queries (
        query_id, query, intent, security_context, as_of_date, retrieval_metadata,
        evidence_references, generated_answer, framework_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (query_id) DO NOTHING
      RETURNING *;
    `;
    const params = [
      queryId,
      queryString,
      q.intent || null,
      JSON.stringify(sources),
      q.asOfDate || null,
      JSON.stringify(q.retrievalMetadata || {}),
      JSON.stringify(groundedFacts),
      answerSummary,
      q.frameworkVersion || '1.0.0'
    ];
    const res = await this.client.query(sql, params);
    if (res.rows.length === 0) {
      return (await this.get(queryId))!;
    }
    return this.mapRowToQuery(res.rows[0]);
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM research_queries;');
    return Number(res.rows[0]?.total || 0);
  }

  private mapRowToQuery(row: any): ResearchQueryItem {
    const parse = (val: any, def: any) => typeof val === 'string' ? JSON.parse(val) : (val || def);
    return {
      id: row.query_id,
      query: row.query,
      date: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      answerSummary: row.generated_answer || '',
      groundedFacts: parse(row.evidence_references, []),
      sources: parse(row.security_context, [])
    };
  }
}

// ==========================================
// 13. USER REPOSITORY
// ==========================================
export class PostgresUserRepository implements IUserRepository {
  constructor(private client: PostgresClient) {}

  public async get(userId: string): Promise<User | null> {
    const res = await this.client.query('SELECT * FROM users WHERE user_id = $1 LIMIT 1;', [userId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  public async getByEmail(normalizedEmail: string): Promise<User | null> {
    const res = await this.client.query('SELECT * FROM users WHERE normalized_email = $1 LIMIT 1;', [normalizedEmail.toLowerCase()]);
    if (res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  public async save(user: User): Promise<User> {
    const sql = `
      INSERT INTO users (user_id, email, normalized_email, password_hash, status, created_at, updated_at, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        normalized_email = EXCLUDED.normalized_email,
        password_hash = EXCLUDED.password_hash,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        last_login_at = EXCLUDED.last_login_at
      RETURNING *;
    `;
    const params = [
      user.userId,
      user.email,
      user.normalizedEmail,
      user.passwordHash,
      user.status,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt
    ];
    const res = await this.client.query(sql, params);
    return this.mapRowToUser(res.rows[0]);
  }

  public async update(userId: string, updates: Partial<User>): Promise<boolean> {
    const existing = await this.get(userId);
    if (!existing) return false;
    const merged: User = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.save(merged);
    return true;
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM users;');
    return Number(res.rows[0]?.total || 0);
  }

  public async getAll(): Promise<User[]> {
    const res = await this.client.query('SELECT * FROM users ORDER BY created_at DESC;');
    return res.rows.map(r => this.mapRowToUser(r));
  }

  private mapRowToUser(row: any): User {
    return {
      userId: row.user_id,
      email: row.email,
      normalizedEmail: row.normalized_email,
      passwordHash: row.password_hash,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null
    };
  }
}

// ==========================================
// 14. SESSION REPOSITORY
// ==========================================
export class PostgresSessionRepository implements ISessionRepository {
  constructor(private client: PostgresClient) {}

  public async get(sessionId: string): Promise<AuthenticatedSession | null> {
    const res = await this.client.query('SELECT * FROM user_sessions WHERE session_id = $1 AND is_valid = true AND expires_at > NOW() LIMIT 1;', [sessionId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToSession(res.rows[0]);
  }

  public async save(session: AuthenticatedSession): Promise<AuthenticatedSession> {
    const sql = `
      INSERT INTO user_sessions (session_id, user_id, created_at, expires_at, last_activity_at, ip_address, user_agent, is_valid)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_id) DO UPDATE SET
        expires_at = EXCLUDED.expires_at,
        last_activity_at = EXCLUDED.last_activity_at,
        is_valid = EXCLUDED.is_valid
      RETURNING *;
    `;
    const params = [
      session.sessionId,
      session.userId,
      session.createdAt,
      session.expiresAt,
      session.lastActivityAt,
      session.ipAddress || null,
      session.userAgent || null,
      session.isValid
    ];
    const res = await this.client.query(sql, params);
    return this.mapRowToSession(res.rows[0]);
  }

  public async invalidate(sessionId: string): Promise<boolean> {
    const res = await this.client.query('UPDATE user_sessions SET is_valid = false WHERE session_id = $1;', [sessionId]);
    return (res.rowCount || 0) > 0;
  }

  public async invalidateAllForUser(userId: string): Promise<number> {
    const res = await this.client.query('UPDATE user_sessions SET is_valid = false WHERE user_id = $1 AND is_valid = true;', [userId]);
    return res.rowCount || 0;
  }

  public async cleanupExpired(): Promise<number> {
    const res = await this.client.query('DELETE FROM user_sessions WHERE is_valid = false OR expires_at <= NOW();');
    return res.rowCount || 0;
  }

  public async count(): Promise<number> {
    const res = await this.client.query('SELECT COUNT(*) AS total FROM user_sessions WHERE is_valid = true AND expires_at > NOW();');
    return Number(res.rows[0]?.total || 0);
  }

  public async getAll(): Promise<AuthenticatedSession[]> {
    const res = await this.client.query('SELECT * FROM user_sessions ORDER BY created_at DESC;');
    return res.rows.map(r => this.mapRowToSession(r));
  }

  private mapRowToSession(row: any): AuthenticatedSession {
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      lastActivityAt: new Date(row.last_activity_at).toISOString(),
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      isValid: Boolean(row.is_valid)
    };
  }
}

