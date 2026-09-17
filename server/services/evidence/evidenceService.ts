/**
 * Evidence Service (Phase 8A)
 * 
 * Orchestrates multi-source evidence gathering across:
 * - SEC EDGAR XBRL facts and filings (SecEvidenceAdapter)
 * - Twelve Data / India market data quotes & candles (MarketEvidenceAdapter)
 * - Deterministic portfolio position weights & P&L (PortfolioEvidenceAdapter)
 * - Canonical security registry metadata (MetadataEvidenceAdapter)
 * 
 * Stores gathered evidence in EvidenceRepository with deterministic deduplication,
 * conflict tracking, and point-in-time filtering.
 */

import {
  EvidenceItem,
  EvidenceGatherOptions,
  ResearchEvidenceItem,
  SecurityIdentifier,
  IEvidenceRepository,
  EvidenceSourceType
} from '../../../src/types';
import { resolveSecurity } from '../../../src/data/canonicalSecurities';
import { EvidenceRepository } from './evidenceRepository';
import { secEvidenceAdapter } from './adapters/secEvidenceAdapter';
import { marketEvidenceAdapter } from './adapters/marketEvidenceAdapter';
import { portfolioEvidenceAdapter } from './adapters/portfolioEvidenceAdapter';
import { metadataEvidenceAdapter } from './adapters/metadataEvidenceAdapter';
import { finmagineEvidenceAdapter } from './adapters/finmagineEvidenceAdapter';

export class EvidenceService {
  private repository: EvidenceRepository;

  constructor(repository?: EvidenceRepository) {
    this.repository = repository || new EvidenceRepository();
  }

  /**
   * Access the backing EvidenceRepository.
   */
  public getRepository(): IEvidenceRepository {
    return this.repository;
  }

  /**
   * Gather and normalize evidence across all configured adapters.
   * Deterministically deduplicates, preserves conflicts, and returns point-in-time items.
   */
  public async gatherEvidence(options: EvidenceGatherOptions): Promise<EvidenceItem[]> {
    const {
      securityIds,
      securities: explicitSecurities,
      asOfDate,
      portfolioContext,
      filter
    } = options;

    // 1. Resolve securities
    let targetSecurities: SecurityIdentifier[] = [];
    if (explicitSecurities && explicitSecurities.length > 0) {
      targetSecurities = explicitSecurities;
    } else if (securityIds && securityIds.length > 0) {
      targetSecurities = securityIds
        .map(id => resolveSecurity(id))
        .filter((s): s is SecurityIdentifier => s !== null);
    }

    const gatheredItems: EvidenceItem[] = [];

    // 2. Gather Canonical Metadata Evidence
    for (const sec of targetSecurities) {
      const metaItem = metadataEvidenceAdapter.getMetadataEvidence(sec, asOfDate);
      gatheredItems.push(metaItem);
    }

    // 3. Gather Market Data Evidence (Quotes & Candles)
    for (const sec of targetSecurities) {
      const quotes = await marketEvidenceAdapter.getQuoteEvidence(sec, asOfDate);
      gatheredItems.push(...quotes);

      // Also gather historical candles if appropriate
      const candles = await marketEvidenceAdapter.getHistoricalEvidence(sec, asOfDate);
      gatheredItems.push(...candles);
    }

    // 4. Gather SEC EDGAR Evidence (for US equities)
    for (const sec of targetSecurities) {
      const secFacts = await secEvidenceAdapter.getEvidenceForSecurity(sec, asOfDate);
      gatheredItems.push(...secFacts);
    }

    // 5. Gather Portfolio Evidence (Calculated)
    if ((portfolioContext?.holdings && portfolioContext.holdings.length > 0) || portfolioContext?.metrics) {
      const portItems = portfolioEvidenceAdapter.getEvidenceFromPortfolio(
        portfolioContext,
        targetSecurities,
        asOfDate
      );
      gatheredItems.push(...portItems);
    }

    // 6. Gather Supplemental Finmagine Evidence (Research, Ratios, Valuation)
    const asOfStr = asOfDate instanceof Date ? asOfDate.toISOString() : asOfDate;
    for (const sec of targetSecurities) {
      try {
        const finmagineItems = await finmagineEvidenceAdapter.getEvidenceForSecurity(sec, asOfStr);
        gatheredItems.push(...finmagineItems);
      } catch (err) {
        console.warn(`[EvidenceService] Finmagine gathering error for ${sec.symbol}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // 7. Register into EvidenceRepository (deduplicates and flags conflicts)
    this.repository.addEvidenceBatch(gatheredItems);

    // 7. Point-in-time and filtered return
    if (asOfDate) {
      return this.repository.getEvidenceAvailableAsOf(asOfDate, filter);
    } else if (filter) {
      return this.repository.queryEvidence(filter);
    }

    // Default: return all newly gathered items (sanitized from repository)
    return gatheredItems.map(item => this.repository.getEvidence(item.evidenceId) || item);
  }

  /**
   * Bridge: Convert EvidenceItem to Phase 7A ResearchEvidenceItem.
   * Ensures 100% backward-compatibility for GeminiResearchEngine.
   */
  public toResearchEvidenceItem(item: EvidenceItem): ResearchEvidenceItem {
    return {
      id: item.evidenceId,
      securityId: item.securityId,
      symbol: (item.sourceReference?.symbol as string) || item.securityId,
      sourceType: item.sourceType as EvidenceSourceType,
      provider: item.provider,
      epistemicStatus: item.epistemicStatus as 'REAL' | 'SIMULATED' | 'UNAVAILABLE' | 'CALCULATED',
      isSimulated: item.isSimulated,
      retrievedAt: item.retrievedAt,
      description: item.content || item.title,
      filingDate: item.filingDate,
      accessionNumber: (item.sourceReference?.accessionNumber as string) || item.documentId,
      data: (typeof item.structuredValue === 'object' && item.structuredValue !== null)
        ? (item.structuredValue as Record<string, unknown>)
        : { value: item.structuredValue, unit: item.unit, currency: item.currency }
    };
  }
}

export const evidenceService = new EvidenceService();
