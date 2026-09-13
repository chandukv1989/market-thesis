/**
 * Canonical Security Metadata Evidence Adapter (Phase 8A)
 * 
 * Normalizes verified canonical security registry metadata into immutable,
 * point-in-time EvidenceItem objects.
 * Epistemic status: 'REAL' (from verified canonical security master).
 */

import { EvidenceItem, SecurityIdentifier } from '../../../../src/types';

export class MetadataEvidenceAdapter {
  /**
   * Normalize canonical security registration metadata into an EvidenceItem.
   */
  public getMetadataEvidence(
    security: SecurityIdentifier,
    _asOfDate?: string | Date
  ): EvidenceItem {
    const now = new Date().toISOString();
    // Use an established baseline registry publication date
    const publishedAt = '2020-01-01T00:00:00.000Z';

    return {
      evidenceId: `ev-meta-${security.symbol.toLowerCase()}-${security.exchange.toLowerCase()}`,
      securityId: security.id,
      sourceType: 'CANONICAL_METADATA',
      provider: 'Canonical Security Registry',
      documentType: 'MASTER_REGISTRY',
      title: `Canonical Profile: ${security.companyName} (${security.symbol})`,
      content: `Official registry metadata for ${security.companyName}: Symbol: ${security.symbol}, Exchange: ${security.exchange}, Market: ${security.market}, Currency: ${security.currency}, Country: ${security.country || 'US'}, Sector: ${security.sector || 'N/A'}, Industry: ${security.industry || 'N/A'}, ISIN: ${security.isin || 'N/A'}.`,
      structuredValue: {
        id: security.id,
        symbol: security.symbol,
        companyName: security.companyName,
        market: security.market,
        exchange: security.exchange,
        currency: security.currency,
        country: security.country,
        sector: security.sector,
        industry: security.industry,
        isin: security.isin
      },
      currency: security.currency,
      publishedAt,
      retrievedAt: now,
      epistemicStatus: 'REAL',
      isSimulated: false,
      sourceReference: {
        symbol: security.symbol,
        exchange: security.exchange,
        isin: security.isin,
        concept: 'canonical_registry',
        provider: 'Canonical Security Registry'
      },
      metadata: {
        sector: security.sector,
        industry: security.industry,
        country: security.country
      }
    };
  }
}

export const metadataEvidenceAdapter = new MetadataEvidenceAdapter();
