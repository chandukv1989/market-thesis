/**
 * Phase 15 - Investment Decision Intelligence
 * Default Decision Framework Configuration
 */

import { DecisionFrameworkConfiguration } from '../../../src/types';

export const DEFAULT_DECISION_CONFIG: DecisionFrameworkConfiguration = {
  version: '1.0.0',
  fundamentalWeight: 0.20,
  growthWeight: 0.15,
  valuationWeight: 0.15,
  marketTrendWeight: 0.10,
  quantitativeWeight: 0.10,
  backtestWeight: 0.05,
  riskWeight: 0.10,
  portfolioFitWeight: 0.05,
  evidenceCoverageWeight: 0.05,
  thesisStatusWeight: 0.05,
  minimumEvidenceThreshold: 3
};
