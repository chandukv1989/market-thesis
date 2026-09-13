/**
 * Portfolio Evidence Adapter (Phase 8A)
 * 
 * Normalizes deterministic portfolio position weights, cost bases, and unrealized
 * P&L calculations into canonical EvidenceItem objects.
 * Strictly assigns epistemic status 'CALCULATED' to distinguish from primary market facts.
 */

import {
  EvidenceItem,
  ResearchPortfolioHoldingContext,
  SecurityIdentifier,
  PortfolioMetrics
} from '../../../../src/types';

export class PortfolioEvidenceAdapter {
  /**
   * Directly transform a PortfolioMetrics contract into canonical EvidenceItem objects.
   */
  public transformPortfolioMetrics(metrics: PortfolioMetrics, asOfDate?: string | Date): EvidenceItem[] {
    return this.getEvidenceFromPortfolio({ metrics }, undefined, asOfDate);
  }

  /**
   * Convert internal portfolio holding context and metrics into canonical EvidenceItem objects.
   */
  public getEvidenceFromPortfolio(
    portfolioContext: {
      holdings?: ResearchPortfolioHoldingContext[];
      totalNav?: number;
      metrics?: PortfolioMetrics;
    },
    securities?: SecurityIdentifier[],
    asOfDate?: string | Date
  ): EvidenceItem[] {
    const evidenceItems: EvidenceItem[] = [];
    const now = new Date().toISOString();
    const publishedAt = asOfDate ? new Date(asOfDate).toISOString() : now;
    const metrics = portfolioContext?.metrics;

    const targetSymbols = new Set(
      (securities || []).map(s => s.symbol.toUpperCase())
    );
    const targetIds = new Set(
      (securities || []).map(s => s.id)
    );

    // 1. Process holdings if present in portfolioContext.holdings
    if (portfolioContext?.holdings && portfolioContext.holdings.length > 0) {
      for (const h of portfolioContext.holdings) {
        if (
          securities &&
          securities.length > 0 &&
          !targetSymbols.has(h.symbol.toUpperCase()) &&
          !targetIds.has(h.securityId)
        ) {
          continue;
        }

        // 1. Position Sizing & Unrealized P&L Evidence
        evidenceItems.push({
          evidenceId: `ev-port-${h.symbol.toLowerCase()}`,
          securityId: h.securityId,
          sourceType: 'PORTFOLIO',
          provider: 'Internal Portfolio Ledger',
          documentType: 'PORTFOLIO_POSITION',
          title: `Portfolio Holding: ${h.symbol}`,
          content: `Deterministic portfolio ledger position in ${h.symbol}: Holding ${h.shares.toLocaleString()} shares at average cost basis ${h.averageCost}. Current market price: ${h.currentPrice}. Allocation: ${h.weightPct?.toFixed(2)}% of NAV ($${portfolioContext.totalNav?.toLocaleString() || 'N/A'}). Unrealized P&L: ${h.unrealizedPnL >= 0 ? '+' : ''}${h.unrealizedPnL.toLocaleString()}.`,
          structuredValue: {
            shares: h.shares,
            averageCost: h.averageCost,
            currentPrice: h.currentPrice,
            weightPct: h.weightPct,
            unrealizedPnL: h.unrealizedPnL,
            totalNav: portfolioContext.totalNav
          },
          unit: 'USD',
          publishedAt,
          retrievedAt: now,
          epistemicStatus: 'CALCULATED',
          isSimulated: false,
          sourceReference: {
            symbol: h.symbol,
            calculationSource: 'PortfolioNavWeightedLedger',
            totalNav: portfolioContext.totalNav,
            concept: 'portfolio_weight',
            provider: 'Internal Portfolio Ledger'
          },
          metadata: {
            shares: h.shares,
            costBasis: h.averageCost * h.shares,
            marketValue: h.currentPrice * h.shares
          }
        });
      }
    }

    // 2. Process metrics if provided (Phase 9)
    if (metrics) {
      // Position-level analytics from metrics
      if (metrics.positions) {
        for (const pos of metrics.positions) {
          if (
            securities &&
            securities.length > 0 &&
            !targetSymbols.has(pos.symbol.toUpperCase()) &&
            !targetIds.has(pos.securityId)
          ) {
            continue;
          }

          // Position weight evidence item
          evidenceItems.push({
            evidenceId: `ev-port-weight-${pos.symbol.toLowerCase()}`,
            securityId: pos.securityId,
            sourceType: 'PORTFOLIO',
            provider: 'Portfolio Intelligence Engine',
            documentType: 'PORTFOLIO_METRIC',
            title: `Portfolio Weight: ${pos.symbol}`,
            content: `${pos.symbol} portfolio weight = ${pos.weightPct.toFixed(2)}% of portfolio NAV ($${metrics.totalValue.toLocaleString()}). Market value: $${pos.marketValue.toLocaleString()}.`,
            structuredValue: {
              symbol: pos.symbol,
              weightPct: pos.weightPct,
              marketValue: pos.marketValue,
              shares: pos.shares,
              currency: pos.currency
            },
            unit: '%',
            publishedAt,
            retrievedAt: now,
            epistemicStatus: 'CALCULATED',
            isSimulated: pos.isSimulated,
            sourceReference: {
              symbol: pos.symbol,
              calculationSource: 'DeterministicNavReconciliation',
              provider: 'Portfolio Intelligence Engine'
            },
            metadata: {
              symbol: pos.symbol,
              weightPct: pos.weightPct,
              marketValue: pos.marketValue
            }
          });

          // Risk contribution evidence item
          if (pos.riskContributionPct.value !== null) {
            evidenceItems.push({
              evidenceId: `ev-port-riskcontrib-${pos.symbol.toLowerCase()}`,
              securityId: pos.securityId,
              sourceType: 'PORTFOLIO',
              provider: 'Portfolio Risk Analytics',
              documentType: 'PORTFOLIO_RISK',
              title: `Risk Contribution: ${pos.symbol}`,
              content: `${pos.symbol} contributes ${pos.riskContributionPct.value.toFixed(1)}% of calculated portfolio risk (Beta: ${pos.beta.value ?? 'N/A'}).`,
              structuredValue: {
                symbol: pos.symbol,
                riskContributionPct: pos.riskContributionPct.value,
                beta: pos.beta.value,
                marginalRisk: pos.marginalRiskContribution.value
              },
              unit: '%',
              publishedAt,
              retrievedAt: now,
              epistemicStatus: 'CALCULATED',
              isSimulated: pos.isSimulated,
              sourceReference: {
                symbol: pos.symbol,
                calculationSource: 'CovarianceRiskContribution',
                methodology: pos.riskContributionPct.methodology || 'w_i * (Sigma * w)_i / var_p',
                provider: 'Portfolio Risk Analytics'
              }
            });
          }

          // Daily attribution evidence item
          if (pos.dailyPnLContribution !== 0) {
            evidenceItems.push({
              evidenceId: `ev-port-attribution-${pos.symbol.toLowerCase()}`,
              securityId: pos.securityId,
              sourceType: 'PORTFOLIO',
              provider: 'Portfolio Performance Attribution',
              documentType: 'PORTFOLIO_ATTRIBUTION',
              title: `Daily Performance Contribution: ${pos.symbol}`,
              content: `${pos.symbol} contributed ${pos.dailyPnLContribution >= 0 ? '+' : ''}$${pos.dailyPnLContribution.toLocaleString()} (${pos.dailyReturnContributionPct >= 0 ? '+' : ''}${pos.dailyReturnContributionPct.toFixed(2)}% to portfolio return) today with a price movement of ${pos.dailyPriceChangePct >= 0 ? '+' : ''}${pos.dailyPriceChangePct.toFixed(2)}%.`,
              structuredValue: {
                symbol: pos.symbol,
                dailyPnLContribution: pos.dailyPnLContribution,
                dailyReturnContributionPct: pos.dailyReturnContributionPct,
                dailyPriceChangePct: pos.dailyPriceChangePct
              },
              unit: 'USD',
              publishedAt,
              retrievedAt: now,
              epistemicStatus: 'CALCULATED',
              isSimulated: pos.isSimulated,
              sourceReference: {
                symbol: pos.symbol,
                calculationSource: 'DailyHoldingPnLAttribution',
                provider: 'Portfolio Performance Attribution'
              }
            });
          }
        }
      }

      // Sector exposure evidence items
      if (metrics.sectorExposure) {
        for (const sec of metrics.sectorExposure) {
          evidenceItems.push({
            evidenceId: `ev-port-sector-${sec.sector.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            sourceType: 'PORTFOLIO',
            provider: 'Portfolio Intelligence Engine',
            documentType: 'PORTFOLIO_EXPOSURE',
            title: `Sector Exposure: ${sec.sector}`,
            content: `${sec.sector} exposure = ${sec.weightPct.toFixed(1)}% of portfolio ($${sec.marketValue.toLocaleString()}) across ${sec.positionCount} positions. Daily P&L contribution: ${sec.dailyPnLContribution >= 0 ? '+' : ''}$${sec.dailyPnLContribution.toLocaleString()}.`,
            structuredValue: {
              sector: sec.sector,
              weightPct: sec.weightPct,
              marketValue: sec.marketValue,
              positionCount: sec.positionCount,
              dailyPnLContribution: sec.dailyPnLContribution
            },
            unit: '%',
            publishedAt,
            retrievedAt: now,
            epistemicStatus: 'CALCULATED',
            isSimulated: metrics.isSimulated,
            sourceReference: {
              calculationSource: 'SectorAggregation',
              provider: 'Portfolio Intelligence Engine'
            }
          });
        }
      }

      // Currency exposure evidence items
      if (metrics.currencyExposure) {
        for (const curr of metrics.currencyExposure) {
          evidenceItems.push({
            evidenceId: `ev-port-currency-${curr.currency.toLowerCase()}`,
            sourceType: 'PORTFOLIO',
            provider: 'Portfolio Intelligence Engine',
            documentType: 'PORTFOLIO_EXPOSURE',
            title: `Currency Exposure: ${curr.currency}`,
            content: `${curr.currency} exposure = ${curr.weightPct.toFixed(1)}% (Native value: ${curr.currency === 'INR' ? '₹' : '$'}${curr.marketValueNative.toLocaleString()}) across ${curr.positionCount} positions. ${curr.isBaseCurrency ? 'Base portfolio currency.' : (curr.fxRateToBase.value ? `Converted at FX ${curr.fxRateToBase.value}.` : 'Segregated without cross-currency mixing.')}`,
            structuredValue: {
              currency: curr.currency,
              weightPct: curr.weightPct,
              marketValueNative: curr.marketValueNative,
              isBaseCurrency: curr.isBaseCurrency,
              fxRateToBase: curr.fxRateToBase.value
            },
            unit: curr.currency,
            publishedAt,
            retrievedAt: now,
            epistemicStatus: 'CALCULATED',
            isSimulated: metrics.isSimulated,
            sourceReference: {
              calculationSource: 'CurrencySegregationLedger',
              provider: 'Portfolio Intelligence Engine'
            }
          });
        }
      }

      // Concentration metrics evidence item
      if (metrics.concentration) {
        evidenceItems.push({
          evidenceId: 'ev-port-concentration',
          sourceType: 'PORTFOLIO',
          provider: 'Portfolio Risk Analytics',
          documentType: 'PORTFOLIO_CONCENTRATION',
          title: 'Portfolio Concentration & HHI',
          content: `Portfolio concentration analysis: Largest holding is ${metrics.concentration.largestPosition.symbol} at ${metrics.concentration.largestPosition.weightPct.toFixed(1)}%. Top 5 holdings account for ${metrics.concentration.top5WeightPct.toFixed(1)}% of assets. Herfindahl-Hirschman Index (HHI) is ${metrics.concentration.herfindahlHirschmanIndex}. Observations: ${metrics.concentration.observations.join(' ')}`,
          structuredValue: {
            top1WeightPct: metrics.concentration.top1WeightPct,
            top5WeightPct: metrics.concentration.top5WeightPct,
            top10WeightPct: metrics.concentration.top10WeightPct,
            hhi: metrics.concentration.herfindahlHirschmanIndex,
            largestPosition: metrics.concentration.largestPosition
          },
          unit: 'HHI',
          publishedAt,
          retrievedAt: now,
          epistemicStatus: 'CALCULATED',
          isSimulated: metrics.isSimulated,
          sourceReference: {
            calculationSource: 'HerfindahlHirschmanIndex',
            formula: 'sum(w_i^2)',
            provider: 'Portfolio Risk Analytics'
          }
        });
      }

      // Portfolio Beta & Risk Overview
      if (metrics.risk?.portfolioBeta?.value !== null) {
        evidenceItems.push({
          evidenceId: 'ev-port-risk-overview',
          sourceType: 'PORTFOLIO',
          provider: 'Portfolio Risk Analytics',
          documentType: 'PORTFOLIO_RISK',
          title: 'Portfolio Systematic Beta & Risk Profile',
          content: `Portfolio Beta is calculated at ${metrics.risk.portfolioBeta.value} vs S&P 500 benchmark. Portfolio volatility: ${metrics.risk.portfolioVolatility.value !== null ? `${metrics.risk.portfolioVolatility.value.toFixed(1)}% annualized` : 'UNAVAILABLE (empirical bars not provided)'}. Drawdown: ${metrics.risk.maxDrawdown.value !== null ? `${metrics.risk.maxDrawdown.value.toFixed(1)}% max drawdown` : 'UNAVAILABLE (NAV history not provided)'}.`,
          structuredValue: {
            portfolioBeta: metrics.risk.portfolioBeta.value,
            portfolioVolatility: metrics.risk.portfolioVolatility.value,
            maxDrawdown: metrics.risk.maxDrawdown.value
          },
          unit: 'Beta',
          publishedAt,
          retrievedAt: now,
          epistemicStatus: 'CALCULATED',
          isSimulated: metrics.isSimulated,
          sourceReference: {
            calculationSource: 'PortfolioBetaWeightedModel',
            provider: 'Portfolio Risk Analytics'
          }
        });
      }
    }

    return evidenceItems;
  }
}

export const portfolioEvidenceAdapter = new PortfolioEvidenceAdapter();
