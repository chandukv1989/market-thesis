/**
 * SEC EDGAR Evidence Adapter (Phase 8A)
 * 
 * Normalizes audited SEC 10-K/10-Q XBRL company facts and submission filings
 * into canonical, point-in-time EvidenceItem objects.
 * Reuses existing financialDataService without duplicating API endpoints.
 */

import { EvidenceItem, SecurityIdentifier } from '../../../../src/types';
import { financialDataService } from '../../financialDataService';

export class SecEvidenceAdapter {
  /**
   * Gather and normalize SEC EDGAR facts and filings for a given security.
   */
  public async getEvidenceForSecurity(
    security: SecurityIdentifier,
    asOfDate?: string | Date
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = [];
    const now = new Date().toISOString();

    // SEC reporting only applies to US equities
    if (security.market !== 'US') {
      evidenceItems.push({
        evidenceId: `ev-sec-${security.symbol.toLowerCase()}-not-applicable`,
        securityId: security.id,
        sourceType: 'SEC_EDGAR',
        provider: 'SEC EDGAR',
        title: `SEC Disclosures for ${security.symbol}`,
        content: `SEC EDGAR filings are NOT APPLICABLE to non-US Indian equities listed on ${security.exchange}. Statutory reporting follows Indian SEBI / Exchange disclosures.`,
        documentType: 'EXCHANGE_DISCLOSURE',
        publishedAt: '2020-01-01T00:00:00.000Z',
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        sourceReference: {
          symbol: security.symbol,
          exchange: security.exchange,
          provider: 'SEC EDGAR'
        }
      });
      return evidenceItems;
    }

    try {
      // 1. Normalized Financial Facts (XBRL)
      const financials = await financialDataService.getSecurityFinancials(security.symbol);
      if (financials && financials.facts && financials.facts.length > 0) {
        for (const fact of financials.facts) {
          // Normalize publishedAt from filedDate (filing availability timestamp)
          const publishedAt = fact.filedDate
            ? (fact.filedDate.includes('T') ? fact.filedDate : `${fact.filedDate}T00:00:00.000Z`)
            : fact.retrievedAt || now;

          // Point-in-time guard: if asOfDate is provided, skip facts published after asOfDate
          if (asOfDate) {
            const asOfTime = new Date(asOfDate).getTime();
            const pubTime = new Date(publishedAt).getTime();
            if (!isNaN(asOfTime) && !isNaN(pubTime) && pubTime > asOfTime) {
              continue; // Exclude future disclosures
            }
          }

          const docType = fact.form || '10-Q/10-K';
          const periodEnd = fact.fiscalPeriod && fact.fiscalYear ? `${fact.fiscalYear}-${fact.fiscalPeriod}` : undefined;

          evidenceItems.push({
            evidenceId: `ev-sec-fact-${security.symbol.toLowerCase()}-${fact.metric.toLowerCase()}-${fact.fiscalPeriod || 'FY'}-${fact.fiscalYear || ''}`.replace(/[^a-zA-Z0-9-_]/g, '-'),
            securityId: security.id,
            sourceType: 'SEC_EDGAR',
            provider: 'SEC EDGAR',
            documentId: fact.accessionNumber,
            documentType: docType,
            title: `SEC ${docType}: ${fact.label}`,
            content: `Audited SEC ${docType} disclosure for ${security.companyName} (${security.symbol}): ${fact.label} is ${fact.value.toLocaleString()} ${fact.unit} for period ${fact.fiscalPeriod || ''} ${fact.fiscalYear || ''}.`,
            structuredValue: fact.value,
            unit: fact.unit,
            currency: security.currency,
            publishedAt,
            filingDate: fact.filedDate,
            periodEnd,
            retrievedAt: fact.retrievedAt || now,
            epistemicStatus: 'REAL',
            isSimulated: false,
            sourceReference: {
              symbol: security.symbol,
              cik: financials.cik,
              form: fact.form,
              accessionNumber: fact.accessionNumber,
              concept: fact.metric,
              url: fact.sourceUrl,
              provider: 'SEC EDGAR'
            },
            metadata: {
              company: financials.companyName || security.companyName,
              cik: financials.cik,
              metric: fact.metric,
              fiscalYear: fact.fiscalYear,
              fiscalPeriod: fact.fiscalPeriod
            }
          });
        }
      }

      // 2. Recent Filings Metadata
      const filings = await financialDataService.getRecentFilings(security.symbol);
      if (filings && filings.length > 0) {
        for (const filing of filings.slice(0, 5)) {
          const publishedAt = filing.filingDate
            ? (filing.filingDate.includes('T') ? filing.filingDate : `${filing.filingDate}T00:00:00.000Z`)
            : now;

          if (asOfDate) {
            const asOfTime = new Date(asOfDate).getTime();
            const pubTime = new Date(publishedAt).getTime();
            if (!isNaN(asOfTime) && !isNaN(pubTime) && pubTime > asOfTime) {
              continue;
            }
          }

          evidenceItems.push({
            evidenceId: `ev-sec-filing-${security.symbol.toLowerCase()}-${filing.accessionNumber || filing.form.toLowerCase()}`.replace(/[^a-zA-Z0-9-_]/g, '-'),
            securityId: security.id,
            sourceType: 'SEC_EDGAR',
            provider: 'SEC EDGAR',
            documentId: filing.accessionNumber,
            documentType: filing.form,
            title: `SEC Filing ${filing.form}`,
            content: `Verified SEC filing Form ${filing.form} for ${security.companyName} (${security.symbol}) filed on ${filing.filingDate}. Primary document: ${filing.primaryDocument || 'filing.htm'}. Accession: ${filing.accessionNumber}.`,
            structuredValue: {
              form: filing.form,
              filingDate: filing.filingDate,
              reportDate: filing.reportDate,
              accessionNumber: filing.accessionNumber
            },
            publishedAt,
            filingDate: filing.filingDate,
            periodEnd: filing.reportDate,
            retrievedAt: now,
            epistemicStatus: 'REAL',
            isSimulated: false,
            sourceReference: {
              symbol: security.symbol,
              form: filing.form,
              accessionNumber: filing.accessionNumber,
              url: `https://www.sec.gov/Archives/edgar/data/${filing.accessionNumber}/${filing.primaryDocument}`,
              provider: 'SEC EDGAR'
            },
            metadata: {
              form: filing.form,
              filingDate: filing.filingDate,
              reportDate: filing.reportDate
            }
          });
        }
      }
    } catch (err: unknown) {
      evidenceItems.push({
        evidenceId: `ev-sec-${security.symbol.toLowerCase()}-unavailable`,
        securityId: security.id,
        sourceType: 'SEC_EDGAR',
        provider: 'SEC EDGAR',
        title: `SEC EDGAR Disclosures Unavailable for ${security.symbol}`,
        content: `SEC EDGAR facts for ${security.symbol} are currently UNAVAILABLE.`,
        documentType: 'DISCLOSURE_ERROR',
        publishedAt: now,
        retrievedAt: now,
        epistemicStatus: 'UNAVAILABLE',
        isSimulated: false,
        sourceReference: {
          symbol: security.symbol,
          provider: 'SEC EDGAR'
        }
      });
    }

    return evidenceItems;
  }
}

export const secEvidenceAdapter = new SecEvidenceAdapter();
