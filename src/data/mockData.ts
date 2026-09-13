import { Stock, PortfolioData, Strategy, AlertItem, ResearchQueryItem, AppState, BacktestResult } from '../types';
import { derivePortfolio, DEFAULT_HOLDING_POSITIONS } from '../state/portfolioEngine';
import { INDIAN_STOCKS } from './indianStocks';
import { CANONICAL_SECURITIES } from './canonicalSecurities';

const US_STOCKS_BASE: Stock[] = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductors',
    price: 128.60,
    change: 3.52,
    changePercent: 2.81,
    volume: '48.2M',
    marketCap: '$3.16T',
    peRatio: 46.2,
    forwardPe: 29.8,
    psRatio: 26.4,
    evEbitda: 38.5,
    fcfYield: 2.8,
    dividendYield: 0.03,
    roic: 64.2,
    beta: 1.68,
    debtToEquity: 0.18,
    overallScore: 88,
    confidence: 94,
    dataCompleteness: 98,
    lastCalculated: '2024-09-06 14:32:10 UTC',
    dataFreshness: 'Refreshed 4m ago • SEC 10-Q Q2 FY25',
    factorScores: {
      growth: 96,
      quality: 92,
      valuation: 54,
      risk: 68,
      momentum: 89,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 6, total: 6 },
    whyThisStock: 'Unrivaled full-stack compute platform advantage (CUDA ecosystem + Blackwell architecture) driving sustained datacenter revenue growth, extraordinary gross margin retention (>74%), and expanding free cash flow generation.',
    aiInterpretation: 'Blackwell production yield ramp confirmed at TSMC. Hyperscaler capex guidance increases provide strong revenue visibility through CY25, though customer ASIC diversification remains a 24-month tail risk.',
    keyConcern: 'Extreme customer concentration (top 4 hyperscalers represent ~41% of datacenter revenue) and TSMC CoWoS packaging capacity ceiling.',
    thesisStatus: 'Healthy',
    thesisOverview: 'NVIDIA maintains a systemic structural monopoly on accelerated computing infrastructure. High switching costs in CUDA software libraries and full-rack networking (NVLink/InfiniBand) shield gross margins against commoditization pressures.',
    thesisPillars: [
      {
        name: 'Growth & Datacenter Demand',
        score: 96,
        status: 'Strong',
        fact: 'Datacenter revenue reached $26.3B in Q2 FY25, growing 154% year-over-year.',
        calculation: 'Datacenter now represents 87.5% of total corporate revenues, up from 75.8% in Q2 FY24.',
        aiAnalysis: 'Hyperscalers (MSFT, GOOGL, AMZN, META) elevated aggregate 2024 capex guidance to >$205B, creating sustained revenue backlog through mid-2025.',
        uncertainty: 'Long-term inference revenue conversion depends on enterprise GenAI ROI realization.',
        evidenceRef: 'SEC 10-Q filed Aug 28, 2024, Page 22'
      },
      {
        name: 'Quality & Moat Durability',
        score: 92,
        status: 'Strong',
        fact: 'Gross margin expanded to 75.1% GAAP (75.7% Non-GAAP) for the trailing quarter.',
        calculation: 'ROIC of 64.2% exceeds weighted average cost of capital (WACC of 9.4%) by 5,480 basis points.',
        aiAnalysis: 'Developer lock-in within CUDA is reinforced by 5M+ active GPU developers and accelerated libraries optimized for Blackwell architecture.',
        evidenceRef: 'Earnings Transcript Q2 FY25, CFO commentary'
      },
      {
        name: 'Valuation & Multiple Compression Risk',
        score: 54,
        status: 'Neutral',
        fact: 'Trading at 29.8x forward consensus FY26 EPS estimates, compared to 5-year median of 41.2x.',
        calculation: 'PEG ratio calculated at 0.94 based on consensus 3-year projected EPS CAGR of 34.2%.',
        aiAnalysis: 'Multiples have de-rated from peak 55x forward earnings as earnings execution outpaced stock appreciation.',
        uncertainty: 'Valuation multiple is highly vulnerable to any quarterly guidance deceleration below 15% sequential growth.',
        evidenceRef: 'Consensus Bloomberg Estimates / FactSet reconciliation'
      },
      {
        name: 'Risk & Tail Exposures',
        score: 68,
        status: 'Vulnerable',
        fact: 'China datacenter revenue share declined from 21% in FY23 to ~12% in current quarter under BIS export restrictions.',
        calculation: 'Beta of 1.68 indicates 68% amplified volatility relative to the S&P 500 benchmark.',
        aiAnalysis: 'Geopolitical concentration in Taiwan (TSMC fabrication + ASE packaging) represents an unhedged operational risk vector.',
        uncertainty: 'Potential tightening of US export controls on H20 modified GPUs.',
        evidenceRef: 'SEC 10-K FY24 Item 1A Risk Factors'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-1',
        condition: 'Hyperscaler aggregate GenAI capex cuts exceed 15% YoY in any rolling 2-quarter window',
        threshold: '< -15% YoY capex',
        currentStatus: '+38% YoY projected (Safe)',
        status: 'Safe',
        probabilityEstimate: '12% probability in 12m',
        impactSeverity: 'Severe'
      },
      {
        id: 'TB-2',
        condition: 'Non-GAAP Gross Margin falls below 70.0% due to packaging yield losses or pricing concession',
        threshold: '< 70.0% Gross Margin',
        currentStatus: '75.7% Non-GAAP (Safe)',
        status: 'Safe',
        probabilityEstimate: '18% probability in 12m',
        impactSeverity: 'High'
      },
      {
        id: 'TB-3',
        condition: 'Custom Hyperscaler silicon (Google TPU, AWS Trainium, Meta MTIA) captures >25% of training workloads',
        threshold: '> 25% custom silicon share',
        currentStatus: '~9% estimated training share (Watch)',
        status: 'Warning',
        probabilityEstimate: '32% probability in 24m',
        impactSeverity: 'High'
      },
      {
        id: 'TB-4',
        condition: 'Severe export ban expansion prohibiting all H20/L20 derivative shipments to greater Asia-Pac',
        threshold: 'Total BIS ban on modified silicon',
        currentStatus: 'H20 permitted under current export license (Safe)',
        status: 'Safe',
        probabilityEstimate: '25% probability in 12m',
        impactSeverity: 'Moderate'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Quantitative Growth Specialist',
        conviction: 'High',
        summary: 'Blackwell architecture delivers a 4x leap in training compute density and 30x in inference speed. Sovereign AI initiatives from Japan, Europe, and GCC nations create an entirely incremental multi-billion dollar buyer category independent of commercial hyperscalers.',
        coreArguments: [
          'Blackwell ultra-chips sold out through first 12 months of shipment lifecycle',
          'Sovereign AI capital allocations expected to add $12-15B in high-margin shipments',
          'Enterprise software inference monetizing through NVIDIA AI Enterprise software licenses'
        ],
        keyVulnerability: 'Underestimates speed at which hyperscalers deploy internal ASICs for inference.',
        confidenceScore: 92
      },
      {
        role: 'Base Case',
        author: 'Institutional Sector Strategist',
        conviction: 'High',
        summary: 'Sustained 35-45% revenue expansion through FY26 as enterprise GenAI deployment transitions from initial experimentation to production clusters. Valuation multiple remains stable around 28-32x forward earnings.',
        coreArguments: [
          'Hyperscalers committed to multi-year data center cluster build-outs',
          'Software switching costs preserve pricing power through NVLink rack architecture',
          'Free cash flow exceeds $65B annually, funding massive share buyback accretions'
        ],
        keyVulnerability: 'Potential lull in enterprise capex during mid-2025 inference model optimization.',
        confidenceScore: 88
      },
      {
        role: 'Bear Case',
        author: 'Macro Contrarian Analyst',
        conviction: 'Moderate',
        summary: 'Capex digestion cycle inevitable in late 2025 as end-user software monetization fails to justify $200B+ annual infrastructure investments. Gross margins will revert toward historical semiconductor norms (62-65%).',
        coreArguments: [
          'Venture-backed GenAI startups burning cash without scalable unit economics',
          'Hyperscaler internal silicon (TPU v5p, Trainium2) rapidly eroding training monopolies',
          'Severe customer concentration: top 4 customers control NVIDIA pricing destiny'
        ],
        keyVulnerability: 'Assumes abrupt software slowdown rather than evolutionary multi-year adoption.',
        confidenceScore: 71
      },
      {
        role: 'Risk Analyst',
        author: 'Supply Chain & Geopolitical Lead',
        conviction: 'High',
        summary: 'Single-source dependency on TSMC Fab 18 and Advanced Packaging (CoWoS-L) in Tainan/Taichung is a binary risk vector. Taiwan seismic or geopolitical disruption cannot be diversified in under 36 months.',
        coreArguments: [
          '100% of Blackwell high-volume packaging dependent on TSMC CoWoS capacity',
          'US regulatory restrictions continually threat remaining revenue channels into Asian markets',
          'Power grid bottlenecks in US metropolitan regions limiting data center energization'
        ],
        keyVulnerability: 'TSMC Arizona Fab 21 ramp will alleviate a fraction of long-term concentration by 2026.',
        confidenceScore: 85
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'High',
        summary: 'Evidence strongly supports holding an overweight allocation with disciplined rebalancing triggers. Multiple de-rating has sufficiently priced near-term decelerations. Monitor Thesis Breaker TB-2 (Gross Margins) and TB-3 (Custom Silicon Share) as primary exit gates.',
        coreArguments: [
          'Calculated PEG ratio of 0.94 provides compelling growth-adjusted margin of safety',
          'No competitor demonstrates equivalent full-stack hardware-software parity',
          'Maintain portfolio weight at or below 9.0% to guard against portfolio-level tech beta skew'
        ],
        keyVulnerability: 'Extreme correlation to broad NASDAQ-100 drawdowns during liquidity contractions.',
        confidenceScore: 89
      }
    ],
    financialQuarters: [
      { period: 'Q3 FY24', revenue: 18.12, grossMarginPct: 74.0, operatingIncome: 10.42, netIncome: 9.24, freeCashFlow: 7.04, capex: 1.12 },
      { period: 'Q4 FY24', revenue: 22.10, grossMarginPct: 76.0, operatingIncome: 13.62, netIncome: 12.29, freeCashFlow: 11.21, capex: 1.25 },
      { period: 'Q1 FY25', revenue: 26.04, grossMarginPct: 78.4, operatingIncome: 16.91, netIncome: 14.88, freeCashFlow: 14.94, capex: 1.38 },
      { period: 'Q2 FY25', revenue: 30.04, grossMarginPct: 75.1, operatingIncome: 18.64, netIncome: 16.60, freeCashFlow: 13.48, capex: 1.52 },
      { period: 'Q3 FY25 (E)', revenue: 32.50, grossMarginPct: 75.0, operatingIncome: 20.10, netIncome: 17.80, freeCashFlow: 15.20, capex: 1.65 }
    ],
    portfolioFit: {
      correlation: 0.78,
      sectorTechDelta: '+2.4%',
      riskContributionPct: 14.2,
      scenarioImpact: {
        rateHike100bps: '-4.8% estimated NAV impact',
        recessionMild: '-8.2% estimated NAV impact',
        techSelloff20Pct: '-14.6% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-NVDA-1',
        type: 'SEC 10-Q',
        title: 'Quarterly Report for the Period Ended July 28, 2024',
        sourceDoc: 'SEC Form 10-Q (Commission File No. 000-23985)',
        reportingDate: '2024-08-28',
        freshness: '18d ago',
        quote: 'Compute & Networking revenue was $26.3 billion, up 154% from a year ago, primarily driven by strong demand for our NVIDIA HGX platform based on Hopper architecture.',
        confidence: 99,
        url: 'https://www.sec.gov/edgar/searchedgar/companysearch',
        verificationHash: 'sha256:7f8a91b...c98d',
        extractedPillar: 'Growth & Datacenter Demand'
      },
      {
        id: 'EV-NVDA-2',
        type: 'Earnings Transcript',
        title: 'NVIDIA Q2 FY2025 Financial Results Conference Call',
        sourceDoc: 'Official Corporate IR Transcript',
        reportingDate: '2024-08-28',
        freshness: '18d ago',
        quote: 'Blackwell sample shipments are out to our partners and customers. We executed a change to the Blackwell GPU mask to improve production yield. Blackwell ramp is scheduled to begin in the fourth quarter and continue into fiscal 2026.',
        confidence: 96,
        verificationHash: 'sha256:3a1e4c2...09bc',
        extractedPillar: 'Growth & Datacenter Demand'
      },
      {
        id: 'EV-NVDA-3',
        type: 'SEC 10-K',
        title: 'Annual Report for Fiscal Year Ended January 28, 2024',
        sourceDoc: 'SEC Form 10-K (Item 1A Risk Factors)',
        reportingDate: '2024-02-21',
        freshness: '200d ago',
        quote: 'We rely on independent third parties, primarily TSMC, to manufacture our semiconductor wafers and perform assembly and test packaging services. Any disruption in TSMC operations would have a catastrophic adverse impact on our business.',
        confidence: 98,
        verificationHash: 'sha256:8b4e721...fa43',
        extractedPillar: 'Risk & Tail Exposures'
      },
      {
        id: 'EV-NVDA-4',
        type: 'Investor Deck',
        title: 'GTC Washington Keynote & Architectures Briefing',
        sourceDoc: 'NVIDIA Enterprise IR Presentation',
        reportingDate: '2024-07-15',
        freshness: '52d ago',
        quote: 'NVLink 5 provides 1.8TB/s bidirectional throughput per GPU, allowing 72 Blackwell GPUs to behave as a single unified superchip with coherent memory.',
        confidence: 94,
        verificationHash: 'sha256:1c9a0d8...66bb',
        extractedPillar: 'Quality & Moat Durability'
      }
    ]
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Infrastructure Software',
    price: 421.40,
    change: 2.15,
    changePercent: 0.51,
    volume: '21.4M',
    marketCap: '$3.13T',
    peRatio: 35.8,
    forwardPe: 30.2,
    psRatio: 12.8,
    evEbitda: 24.1,
    fcfYield: 2.4,
    dividendYield: 0.72,
    roic: 28.5,
    beta: 1.15,
    debtToEquity: 0.38,
    overallScore: 84,
    confidence: 96,
    dataCompleteness: 99,
    lastCalculated: '2024-09-06 14:28:00 UTC',
    dataFreshness: 'Refreshed 12m ago • SEC 10-K FY24',
    factorScores: {
      growth: 84,
      quality: 95,
      valuation: 62,
      risk: 86,
      momentum: 76,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 6, total: 6 },
    whyThisStock: 'Unrivaled enterprise commercial distribution with Azure cloud accelerating at 29% constant currency, coupled with early copilot enterprise seat monetization across Office 365.',
    aiInterpretation: 'Azure capacity constraints currently capping near-term GenAI revenue acceleration; capex ramp of $19B in the latest quarter signals confidence in enterprise demand pipeline.',
    keyConcern: 'Near-term operating margin compression from heavy AI datacenters and GPU infrastructure depreciation schedules.',
    thesisStatus: 'Healthy',
    thesisOverview: 'Microsoft is the primary commercial monetization gateway for enterprise AI adoption, insulated by deep Windows, M365, and Azure enterprise customer entrenchment.',
    thesisPillars: [
      {
        name: 'Growth & Azure Run-Rate',
        score: 84,
        status: 'Strong',
        fact: 'Azure and other cloud services revenue grew 29% in Q4 FY24 (8 percentage points from AI services).',
        calculation: 'Intelligent Cloud division annual run rate surpassed $114B.',
        aiAnalysis: 'Enterprise software seat upgrades to Microsoft 365 Copilot expected to contribute $4-6B incremental ARR by CY25.',
        evidenceRef: 'SEC 10-K FY24 Page 34'
      },
      {
        name: 'Balance Sheet & Cash Flow Quality',
        score: 95,
        status: 'Strong',
        fact: 'Generated $74.1B in operating cash flow and $19.2B net cash from operations after $19B capex.',
        calculation: 'AAA-equivalent balance sheet with $75.5B in cash and short-term investments.',
        aiAnalysis: 'Highest grade enterprise counterparty credit in global tech landscape.',
        evidenceRef: 'Consolidated Statement of Cash Flows FY24'
      },
      {
        name: 'Valuation & Forward Multiples',
        score: 62,
        status: 'Neutral',
        fact: 'Forward P/E of 30.2x against 5-year average of 29.5x.',
        calculation: 'Free cash flow yield currently depressed at 2.4% due to peak historical capex intensity.',
        aiAnalysis: 'Valuation reflects high certainty of cash flows but offers limited margin of safety if Azure growth drops below 25%.',
        evidenceRef: 'FactSet Multiples consensus'
      },
      {
        name: 'Regulatory & Antitrust Scrutiny',
        score: 86,
        status: 'Strong',
        fact: 'EU and FTC scrutiny on OpenAI partnership governance and Azure security posture.',
        calculation: 'Low beta of 1.15 reflects defensive utility-like characteristics in enterprise IT budgets.',
        aiAnalysis: 'Diversified commercial offerings shield against single-product regulatory action.',
        evidenceRef: 'FTC Inquiry disclosures 2024'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-MSFT-1',
        condition: 'Azure constant-currency revenue growth falls below 22% YoY for 2 consecutive quarters',
        threshold: '< 22% Azure growth',
        currentStatus: '29% YoY (Safe)',
        status: 'Safe',
        probabilityEstimate: '10% in 12m',
        impactSeverity: 'High'
      },
      {
        id: 'TB-MSFT-2',
        condition: 'Antitrust forced restructuring of exclusive OpenAI commercial partnership',
        threshold: 'Regulatory separation order',
        currentStatus: 'Non-controlling observer status (Safe)',
        status: 'Safe',
        probabilityEstimate: '15% in 24m',
        impactSeverity: 'Moderate'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Enterprise Software Strategist',
        conviction: 'High',
        summary: 'Copilot enterprise penetration is in its first inning. As millions of knowledge workers adopt AI assistance, M365 ARPU will rise 20-30% over the next 3 years.',
        coreArguments: ['Azure gaining market share against AWS', 'Unrivaled security suite integration', 'Generous capital returns via dividends and buybacks'],
        keyVulnerability: 'AI server capital expenditure slowing ROIC expansion.',
        confidenceScore: 91
      },
      {
        role: 'Bear Case',
        author: 'Technology Valuation Bear',
        conviction: 'Moderate',
        summary: 'Capex intensity is degrading free cash flow yields to sub-2.5%. If enterprise Copilot renewals show low active utilization, multiples will contract toward 24x.',
        coreArguments: ['Copilot token usage reports indicate mixed daily active engagement', 'Capex depreciation will weigh on operating margins', 'AWS and GCP pricing competition'],
        keyVulnerability: 'Underestimating enterprise stickiness of Office 365 ecosystem.',
        confidenceScore: 74
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'High',
        summary: 'Core institutional holding. High defensibility, balance sheet fortress, and steady cloud expansion justify current valuation multiples.',
        coreArguments: ['Essential enterprise IT utility', 'Predictable SaaS revenue model', 'Defensive beta of 1.15'],
        keyVulnerability: 'Capex payback lag duration.',
        confidenceScore: 90
      }
    ],
    financialQuarters: [
      { period: 'Q1 FY24', revenue: 56.52, grossMarginPct: 71.2, operatingIncome: 26.90, netIncome: 22.29, freeCashFlow: 20.70, capex: 9.92 },
      { period: 'Q2 FY24', revenue: 62.02, grossMarginPct: 68.4, operatingIncome: 27.03, netIncome: 21.87, freeCashFlow: 9.10, capex: 11.50 },
      { period: 'Q3 FY24', revenue: 61.86, grossMarginPct: 70.1, operatingIncome: 27.58, netIncome: 21.94, freeCashFlow: 20.96, capex: 14.00 },
      { period: 'Q4 FY24', revenue: 64.73, grossMarginPct: 69.8, operatingIncome: 27.92, netIncome: 22.04, freeCashFlow: 23.32, capex: 19.00 }
    ],
    portfolioFit: {
      correlation: 0.64,
      sectorTechDelta: '+1.8%',
      riskContributionPct: 9.8,
      scenarioImpact: {
        rateHike100bps: '-3.2% estimated NAV impact',
        recessionMild: '-4.1% estimated NAV impact',
        techSelloff20Pct: '-11.2% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-MSFT-1',
        type: 'SEC 10-K',
        title: 'Microsoft Corporation Annual Report FY24',
        sourceDoc: 'SEC Form 10-K filed July 30, 2024',
        reportingDate: '2024-07-30',
        freshness: '38d ago',
        quote: 'Cloud revenue was $137.4 billion, up 23% year-over-year, driven by continued customer demand across Microsoft Cloud solutions.',
        confidence: 99,
        verificationHash: 'sha256:4f8e...901a'
      }
    ]
  },
  {
    ticker: 'ASML',
    name: 'ASML Holding N.V.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductor Equipment',
    price: 812.50,
    change: -8.20,
    changePercent: -1.00,
    volume: '1.8M',
    marketCap: '$324B',
    peRatio: 42.1,
    forwardPe: 28.4,
    psRatio: 11.2,
    evEbitda: 29.6,
    fcfYield: 3.1,
    dividendYield: 0.88,
    roic: 48.2,
    beta: 1.34,
    debtToEquity: 0.28,
    overallScore: 82,
    confidence: 93,
    dataCompleteness: 97,
    lastCalculated: '2024-09-06 14:15:00 UTC',
    dataFreshness: 'Refreshed 25m ago • Q2 2024 Interim Report',
    factorScores: {
      growth: 81,
      quality: 98,
      valuation: 66,
      risk: 74,
      momentum: 72,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 6, total: 6 },
    whyThisStock: 'Absolute 100% global monopoly on Extreme Ultraviolet (EUV) photolithography, essential for sub-3nm chip fabrication worldwide.',
    aiInterpretation: 'Bookings recovery confirmed in high-NA EUV orders. China export ban risks partially priced in, but 2025 revenue target of €30B-€35B remains well supported by TSMC and Intel fab expansions.',
    keyConcern: 'Dutch and US trade restriction expansions targeting DUV servicing and legacy spare parts revenue.',
    thesisStatus: 'Healthy',
    thesisOverview: 'Sole supplier of EUV lithography systems globally. Extreme technological moat spanning optics (Zeiss), vacuum systems, and multi-decade patent protections.',
    thesisPillars: [
      {
        name: 'Monopoly Moat & Technology Barrier',
        score: 98,
        status: 'Strong',
        fact: 'ASML holds 100% market share in commercial EUV lithography machines globally.',
        calculation: 'High-NA EUV Twinscan EXE systems cost >$350M per unit with zero direct competitors.',
        aiAnalysis: 'Decades of co-engineering with Zeiss and Fraunhofer institute make competitive replication economically impossible within a 10-year window.',
        evidenceRef: 'Q2 2024 Financial Statements'
      },
      {
        name: 'Order Backlog Visibility',
        score: 81,
        status: 'Strong',
        fact: 'Total order backlog stands at €39.0B at the end of Q2 2024.',
        calculation: 'Backlog represents approximately 1.4 years of projected annual revenue.',
        aiAnalysis: 'Customer orders are non-cancellable without severe forfeiture penalties.',
        evidenceRef: 'Q2 2024 Investor Briefing'
      },
      {
        name: 'Geopolitical & China Headwind',
        score: 74,
        status: 'Neutral',
        fact: 'China represented 49% of Q2 system sales as customers front-loaded pre-restriction equipment.',
        calculation: 'China revenue share projected to normalize to ~20% of net sales in FY25.',
        aiAnalysis: 'Transition to Western fab capacity (TSMC Arizona, Intel Ohio, Samsung Texas) will absorb supply capacity.',
        evidenceRef: 'Dutch Government Export Gazette July 2024'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-ASML-1',
        condition: 'Total backlog drops below €25.0B due to semiconductor capex deferrals',
        threshold: '< €25.0B backlog',
        currentStatus: '€39.0B (Safe)',
        status: 'Safe',
        probabilityEstimate: '14% in 18m',
        impactSeverity: 'High'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Semiconductor Capital Goods Specialist',
        conviction: 'High',
        summary: 'No advanced semiconductor can be manufactured without ASML EUV. As chips migrate to 2nm and 1.4nm, High-NA EUV adoption will drive ASPs and gross margins to record levels.',
        coreArguments: ['Indispensable node in global technological advancement', 'High recurring revenue from service contracts', 'Pricing inelasticity'],
        keyVulnerability: 'Geopolitical export restrictions expanding to legacy lithography.',
        confidenceScore: 94
      },
      {
        role: 'Bear Case',
        author: 'Geopolitical Risk Analyst',
        conviction: 'Moderate',
        summary: 'China sales bubble will deflate sharply in 2025. Fab delays in US and Europe by Intel and TSMC could postpone system deliveries and install recognitions.',
        coreArguments: ['Front-loaded China revenue will drop >50% in 2025', 'Foundry customers delaying fab groundbreakings', 'FX headwind on EUR/USD strength'],
        keyVulnerability: 'Massive backlog buffers against delivery delays.',
        confidenceScore: 78
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'High',
        summary: 'Irreplaceable foundational asset. Accumulate on geopolitical dips; long-term structural compounding intact.',
        coreArguments: ['Complete technological lock', 'Unassailable IP moat', 'Robust balance sheet'],
        keyVulnerability: 'Export control sentiment volatility.',
        confidenceScore: 89
      }
    ],
    financialQuarters: [
      { period: 'Q3 23', revenue: 6.67, grossMarginPct: 51.9, operatingIncome: 2.18, netIncome: 1.89, freeCashFlow: 1.12, capex: 0.45 },
      { period: 'Q4 23', revenue: 7.24, grossMarginPct: 51.4, operatingIncome: 2.39, netIncome: 2.05, freeCashFlow: 2.45, capex: 0.52 },
      { period: 'Q1 24', revenue: 5.29, grossMarginPct: 51.0, operatingIncome: 1.39, netIncome: 1.22, freeCashFlow: 0.88, capex: 0.48 },
      { period: 'Q2 24', revenue: 6.24, grossMarginPct: 51.5, operatingIncome: 1.84, netIncome: 1.58, freeCashFlow: 1.42, capex: 0.50 }
    ],
    portfolioFit: {
      correlation: 0.72,
      sectorTechDelta: '+1.2%',
      riskContributionPct: 8.4,
      scenarioImpact: {
        rateHike100bps: '-3.9% estimated NAV impact',
        recessionMild: '-6.4% estimated NAV impact',
        techSelloff20Pct: '-13.2% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-ASML-1',
        type: 'SEC 10-Q',
        title: 'ASML 2024 Half-Year Report',
        sourceDoc: 'Published via Euronext & SEC Form 6-K',
        reportingDate: '2024-07-17',
        freshness: '51d ago',
        quote: 'Net bookings in Q2 were €5.6 billion, of which €2.5 billion is EUV, demonstrating strong forward customer commitment for our leading-edge tools.',
        confidence: 97,
        verificationHash: 'sha256:9a8b...12cd'
      }
    ]
  },
  {
    ticker: 'TSM',
    name: 'Taiwan Semiconductor Manufacturing Co.',
    exchange: 'NYSE',
    sector: 'Technology',
    industry: 'Foundry Semiconductor',
    price: 172.80,
    change: 3.80,
    changePercent: 2.25,
    volume: '15.6M',
    marketCap: '$896B',
    peRatio: 26.4,
    forwardPe: 20.8,
    psRatio: 10.4,
    evEbitda: 14.8,
    fcfYield: 3.8,
    dividendYield: 1.24,
    roic: 31.8,
    beta: 1.26,
    debtToEquity: 0.22,
    overallScore: 86,
    confidence: 95,
    dataCompleteness: 98,
    lastCalculated: '2024-09-06 14:10:00 UTC',
    dataFreshness: 'Refreshed 30m ago • Q2 2024 Earnings Release',
    factorScores: {
      growth: 88,
      quality: 94,
      valuation: 78,
      risk: 65,
      momentum: 85,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 6, total: 6 },
    whyThisStock: 'World premier semiconductor foundry commanding >60% total foundry share and >90% of advanced sub-5nm AI chip manufacturing.',
    aiInterpretation: 'Capacity utilization running near 100% for 3nm and 5nm nodes. Pricing power proven by 5-8% wafer price increases accepted by Apple and NVIDIA.',
    keyConcern: 'Geopolitical cross-strait risk and higher cost structure of overseas fab expansions (Kumamoto, Arizona, Dresden).',
    thesisStatus: 'Healthy',
    thesisOverview: 'Essential manufacturing backbone for global fabless innovators. Unmatched packaging yield and process execution.',
    thesisPillars: [
      {
        name: 'Advanced Node Dominance',
        score: 94,
        status: 'Strong',
        fact: '3nm revenue accounted for 15% of wafer revenue in Q2 2024, with 5nm accounting for 35%.',
        calculation: 'Advanced technologies (7nm and below) reached 67% of total wafer revenue.',
        aiAnalysis: 'N2 node mass production scheduled on track for 2025 with superior power-performance-area density.',
        evidenceRef: 'TSMC Q2 2024 Investor Conference'
      },
      {
        name: 'Valuation & Free Cash Flow Yield',
        score: 78,
        status: 'Strong',
        fact: 'Trades at 20.8x forward consensus earnings, a notable discount to US fabless peers.',
        calculation: 'Free cash flow yield of 3.8% backed by disciplined capex guidance of $30-32B.',
        aiAnalysis: 'Valuation reflects historical geopolitical discount despite monopolistic industry positioning.',
        evidenceRef: 'TSM Investor Relations consensus'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-TSM-1',
        condition: 'Cross-strait maritime blockade or military escalation',
        threshold: 'Disruption of Taiwanese airspace/straits',
        currentStatus: 'Normal maritime transit (Safe)',
        status: 'Safe',
        probabilityEstimate: '8% in 12m',
        impactSeverity: 'Severe'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Global Hardware Allocator',
        conviction: 'High',
        summary: 'TSMC is the ultimate tollbooth on the AI economy. It builds every single leading-edge AI chip for NVIDIA, AMD, Apple, Qualcomm, and Broadcom.',
        coreArguments: ['Priced at attractive 20.8x forward P/E', '3nm and 2nm multi-year customer commitments', 'CoWoS packaging capacity doubling'],
        keyVulnerability: 'Geopolitical headline risk triggering multiple compression.',
        confidenceScore: 92
      },
      {
        role: 'Risk Analyst',
        author: 'Geopolitical Defense Fellow',
        conviction: 'High',
        summary: 'Geopolitical discount will persist. Any escalation in the Taiwan Strait would instantaneously impact >60% of the company manufacturing assets.',
        coreArguments: ['Single-island geographic concentration', 'Water and electricity grid strain in Hsinchu and Tainan'],
        keyVulnerability: 'Global dependence provides strategic deterrence ("Silicon Shield").',
        confidenceScore: 88
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'High',
        summary: 'High-conviction value-growth holding. Position sized appropriately to account for tail geopolitical risk.',
        coreArguments: ['Exceptional capital efficiency', 'Superior yield margins', 'Irreplaceable customer relationships'],
        keyVulnerability: 'Geopolitical risk premium.',
        confidenceScore: 89
      }
    ],
    financialQuarters: [
      { period: 'Q3 23', revenue: 17.28, grossMarginPct: 54.3, operatingIncome: 7.21, netIncome: 6.69, freeCashFlow: 3.42, capex: 7.10 },
      { period: 'Q4 23', revenue: 19.62, grossMarginPct: 53.0, operatingIncome: 8.16, netIncome: 7.55, freeCashFlow: 4.88, capex: 5.24 },
      { period: 'Q1 24', revenue: 18.87, grossMarginPct: 53.1, operatingIncome: 7.93, netIncome: 6.98, freeCashFlow: 3.95, capex: 5.77 },
      { period: 'Q2 24', revenue: 20.82, grossMarginPct: 53.2, operatingIncome: 8.85, netIncome: 7.66, freeCashFlow: 5.12, capex: 6.36 }
    ],
    portfolioFit: {
      correlation: 0.70,
      sectorTechDelta: '+1.5%',
      riskContributionPct: 9.1,
      scenarioImpact: {
        rateHike100bps: '-3.4% estimated NAV impact',
        recessionMild: '-5.8% estimated NAV impact',
        techSelloff20Pct: '-12.8% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-TSM-1',
        type: 'SEC 10-Q',
        title: 'TSMC Q2 2024 Earnings Release & Filing',
        sourceDoc: 'SEC Form 6-K',
        reportingDate: '2024-07-18',
        freshness: '50d ago',
        quote: 'Revenue increased 32.8% YoY in USD terms, driven by strong smartphone and AI-related demand utilizing our industry-leading 3nm and 5nm technologies.',
        confidence: 98,
        verificationHash: 'sha256:7c6d...55aa'
      }
    ]
  },
  {
    ticker: 'AVGO',
    name: 'Broadcom Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductor / Infrastructure Software',
    price: 152.20,
    change: -1.80,
    changePercent: -1.17,
    volume: '11.2M',
    marketCap: '$708B',
    peRatio: 36.2,
    forwardPe: 24.5,
    psRatio: 14.1,
    evEbitda: 21.3,
    fcfYield: 3.6,
    dividendYield: 1.41,
    roic: 24.6,
    beta: 1.22,
    debtToEquity: 1.42,
    overallScore: 79,
    confidence: 91,
    dataCompleteness: 95,
    lastCalculated: '2024-09-06 14:00:00 UTC',
    dataFreshness: 'Refreshed 45m ago • Q3 FY24 Release',
    factorScores: {
      growth: 82,
      quality: 89,
      valuation: 68,
      risk: 71,
      momentum: 74,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 5, total: 6 },
    whyThisStock: 'Premier custom AI accelerator (ASIC) engineering partner for Google and Meta, alongside mission-critical datacenter networking silicon (Tomahawk/Jericho) and VMware recurring cash flows.',
    aiInterpretation: 'AI semiconductor revenue expected to exceed $12B in FY24. VMware integration ahead of cost-synergy schedule, though high debt load post-acquisition requires disciplined FCF deleveraging.',
    keyConcern: 'Elevated total debt of $71B following VMware transaction and enterprise pushback on aggressive VMware licensing model transitions.',
    thesisStatus: 'Healthy',
    thesisOverview: 'Dominant franchise in Ethernet networking and custom AI silicon co-design, augmented by mission-critical mainframe and virtualization enterprise software.',
    thesisPillars: [
      {
        name: 'Custom AI ASIC & Networking',
        score: 89,
        status: 'Strong',
        fact: 'Networking revenue reached $4.0B in Q3 FY24, up 43% YoY.',
        calculation: 'AI revenue projected to represent >25% of total corporate revenue in FY24.',
        aiAnalysis: 'Customer relationships with Google (TPU) and Meta (MTIA) provide defensible multi-year custom silicon volume.',
        evidenceRef: 'Q3 FY24 Earnings Conference Call'
      },
      {
        name: 'Debt Leverage & Integration',
        score: 64,
        status: 'Neutral',
        fact: 'Total debt stands at $71.6B following VMware acquisition closing.',
        calculation: 'Net Debt / EBITDA ratio is 2.9x, targeting reduction to <2.5x by FY25.',
        aiAnalysis: 'Free cash flow generation of >$4.8B per quarter provides robust debt service capability.',
        evidenceRef: 'SEC 10-Q Q3 FY24 filed Sept 5, 2024'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-AVGO-1',
        condition: 'Google or Meta insources 100% of custom ASIC physical design and packaging',
        threshold: 'Loss of tier-1 ASIC co-design contract',
        currentStatus: 'Google TPU v6 and Meta contracts active (Safe)',
        status: 'Safe',
        probabilityEstimate: '18% in 24m',
        impactSeverity: 'Severe'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Infrastructure Strategist',
        conviction: 'High',
        summary: 'Broadcom is the primary alternative to NVIDIA for hyperscalers building bespoke internal AI accelerators. Exceptional capital allocation discipline by CEO Hock Tan.',
        coreArguments: ['Custom AI market growing faster than general silicon', 'VMware ARR transition driving margin expansion', 'Consistent dividend growth'],
        keyVulnerability: 'High balance sheet leverage.',
        confidenceScore: 88
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'Moderate',
        summary: 'High-quality hybrid hardware-software play. Attractive dividend yield and custom ASIC upside justify a moderate allocation.',
        coreArguments: ['Dominant networking market share', 'FCF conversion >45%', 'Attractive forward valuation'],
        keyVulnerability: 'Customer concentration in custom silicon.',
        confidenceScore: 84
      }
    ],
    financialQuarters: [
      { period: 'Q4 23', revenue: 9.30, grossMarginPct: 69.1, operatingIncome: 5.34, netIncome: 3.52, freeCashFlow: 4.72, capex: 0.12 },
      { period: 'Q1 24', revenue: 11.96, grossMarginPct: 61.8, operatingIncome: 5.14, netIncome: 1.32, freeCashFlow: 4.69, capex: 0.13 },
      { period: 'Q2 24', revenue: 12.49, grossMarginPct: 62.4, operatingIncome: 5.63, netIncome: 2.12, freeCashFlow: 4.45, capex: 0.14 },
      { period: 'Q3 24', revenue: 13.07, grossMarginPct: 64.2, operatingIncome: 6.22, netIncome: 2.85, freeCashFlow: 4.96, capex: 0.15 }
    ],
    portfolioFit: {
      correlation: 0.68,
      sectorTechDelta: '+1.1%',
      riskContributionPct: 7.2,
      scenarioImpact: {
        rateHike100bps: '-3.1% estimated NAV impact',
        recessionMild: '-4.6% estimated NAV impact',
        techSelloff20Pct: '-11.8% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-AVGO-1',
        type: 'SEC 10-Q',
        title: 'Broadcom Inc. Q3 FY24 Form 10-Q',
        sourceDoc: 'SEC Form 10-Q',
        reportingDate: '2024-09-05',
        freshness: '1d ago',
        quote: 'Revenue increased 47% YoY to $13.07 billion. AI product revenue was $3.1 billion in the quarter, representing significant customer infrastructure expansion.',
        confidence: 99,
        verificationHash: 'sha256:5a4b...32df'
      }
    ]
  },
  {
    ticker: 'PLTR',
    name: 'Palantir Technologies Inc.',
    exchange: 'NYSE',
    sector: 'Technology',
    industry: 'Enterprise Software',
    price: 32.40,
    change: 1.15,
    changePercent: 3.68,
    volume: '64.2M',
    marketCap: '$72.4B',
    peRatio: 88.5,
    forwardPe: 68.2,
    psRatio: 28.5,
    evEbitda: 62.4,
    fcfYield: 1.4,
    dividendYield: 0.0,
    roic: 14.8,
    beta: 2.45,
    debtToEquity: 0.04,
    overallScore: 71,
    confidence: 86,
    dataCompleteness: 94,
    lastCalculated: '2024-09-06 13:45:00 UTC',
    dataFreshness: 'Refreshed 1h ago • Q2 2024 10-Q',
    factorScores: {
      growth: 86,
      quality: 80,
      valuation: 32,
      risk: 54,
      momentum: 94,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 4, total: 6 },
    whyThisStock: 'AIP (Artificial Intelligence Platform) bootcamps driving unprecedented US commercial customer growth (+83% YoY) with high government defense contract retention.',
    aiInterpretation: 'Commercial revenue acceleration is real and quantifiable. However, extreme valuation multiples (>68x forward EPS) require perfection in execution and leave zero room for error.',
    keyConcern: 'Extreme multiple vulnerability to macroeconomic tightening or decelerating bootcamp conversion rates.',
    thesisStatus: 'Watch',
    thesisOverview: 'Ontology-based enterprise operating system uniquely positioned to operationalize LLMs in regulated commercial and defense domains.',
    thesisPillars: [
      {
        name: 'AIP Commercial Growth',
        score: 86,
        status: 'Strong',
        fact: 'US commercial customer count grew 83% YoY to 295 customers.',
        calculation: 'US commercial revenue accelerated to 55% YoY growth in Q2 2024.',
        aiAnalysis: 'AIP bootcamps compress enterprise sales cycles from months to days.',
        evidenceRef: 'SEC 10-Q Q2 2024'
      },
      {
        name: 'Valuation & Multiple Stretch',
        score: 32,
        status: 'Vulnerable',
        fact: 'Trades at 28.5x trailing twelve-month revenue.',
        calculation: 'Implies market expectation of sustained >35% revenue CAGR over the next 5 years.',
        aiAnalysis: 'Valuation is stretched far above peer SaaS averages; high short-term drawdown sensitivity.',
        evidenceRef: 'Bloomberg Multiple screen'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-PLTR-1',
        condition: 'US Commercial revenue growth decelerates below 30% YoY',
        threshold: '< 30% US commercial growth',
        currentStatus: '55% YoY (Safe)',
        status: 'Safe',
        probabilityEstimate: '22% in 12m',
        impactSeverity: 'Severe'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'AI Software Analyst',
        conviction: 'Moderate',
        summary: 'Palantir has solved the "last mile" problem of generative AI in mission-critical enterprises. Ontology provides a moat that conventional vector databases cannot touch.',
        coreArguments: ['S&P 500 inclusion catalyst', 'Defense software spending acceleration', 'Zero net debt balance sheet'],
        keyVulnerability: 'Rich valuation multiple.',
        confidenceScore: 82
      },
      {
        role: 'Bear Case',
        author: 'Quantitative Valuation Bear',
        conviction: 'High',
        summary: 'Priced for impossible growth. At 28x sales, any moderation in government contract awards or bootcamp churn will trigger a 30-40% multiple derating.',
        coreArguments: ['Extreme beta of 2.45', 'Government contract lumpy lumpiness', 'Insider stock options dilution history'],
        keyVulnerability: 'Underestimating velocity of commercial adoption.',
        confidenceScore: 89
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'Speculative',
        summary: 'Tactical momentum watch. Maintain small position size; do not add at current valuation stretch without a pullback.',
        coreArguments: ['Exceptional product velocity', 'High beta volatility', 'Valuation score of 32'],
        keyVulnerability: 'Drawdown risk.',
        confidenceScore: 76
      }
    ],
    financialQuarters: [
      { period: 'Q3 23', revenue: 0.558, grossMarginPct: 80.5, operatingIncome: 0.040, netIncome: 0.072, freeCashFlow: 0.141, capex: 0.003 },
      { period: 'Q4 23', revenue: 0.608, grossMarginPct: 82.1, operatingIncome: 0.066, netIncome: 0.093, freeCashFlow: 0.305, capex: 0.004 },
      { period: 'Q1 24', revenue: 0.634, grossMarginPct: 81.3, operatingIncome: 0.081, netIncome: 0.106, freeCashFlow: 0.149, capex: 0.005 },
      { period: 'Q2 24', revenue: 0.678, grossMarginPct: 81.8, operatingIncome: 0.105, netIncome: 0.134, freeCashFlow: 0.141, capex: 0.006 }
    ],
    portfolioFit: {
      correlation: 0.82,
      sectorTechDelta: '+0.5%',
      riskContributionPct: 5.6,
      scenarioImpact: {
        rateHike100bps: '-6.5% estimated NAV impact',
        recessionMild: '-11.2% estimated NAV impact',
        techSelloff20Pct: '-22.4% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-PLTR-1',
        type: 'SEC 10-Q',
        title: 'Palantir Technologies Form 10-Q Q2 2024',
        sourceDoc: 'SEC Form 10-Q',
        reportingDate: '2024-08-05',
        freshness: '32d ago',
        quote: 'GAAP operating income reached $105 million, representing a 15% margin, continuing our streak of GAAP profitability.',
        confidence: 97,
        verificationHash: 'sha256:6e7f...8899'
      }
    ]
  },
  {
    ticker: 'AMZN',
    name: 'Amazon.com, Inc.',
    exchange: 'NASDAQ',
    sector: 'Consumer Discretionary',
    industry: 'Internet Retail & Cloud',
    price: 177.50,
    change: 1.45,
    changePercent: 0.82,
    volume: '34.8M',
    marketCap: '$1.85T',
    peRatio: 41.2,
    forwardPe: 31.8,
    psRatio: 3.1,
    evEbitda: 17.5,
    fcfYield: 4.2,
    dividendYield: 0.0,
    roic: 16.4,
    beta: 1.28,
    debtToEquity: 0.58,
    overallScore: 81,
    confidence: 94,
    dataCompleteness: 98,
    lastCalculated: '2024-09-06 13:30:00 UTC',
    dataFreshness: 'Refreshed 1h ago • SEC 10-Q Q2 2024',
    factorScores: {
      growth: 82,
      quality: 88,
      valuation: 75,
      risk: 76,
      momentum: 72,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 5, total: 6 },
    whyThisStock: 'AWS re-acceleration to 19% growth, paired with massive retail fulfillment regionalization margin efficiencies and digital advertising high-margin revenue compounding.',
    aiInterpretation: 'Operating income margins expanding at historical highs due to logistics network restructuring. Capex elevated to ~$60B for AI data centers and custom chips (Trainium/Inferentia).',
    keyConcern: 'Consumer discretionary spending fatigue in lower-income demographics and heavy international cloud competition.',
    thesisStatus: 'Healthy',
    thesisOverview: 'Tri-engine compounder: AWS cloud computing, North American retail logistics dominance, and high-margin advertising services.',
    thesisPillars: [
      {
        name: 'AWS Acceleration & AI Integration',
        score: 82,
        status: 'Strong',
        fact: 'AWS segment sales increased 19% YoY to $26.3B with a $105B annual run rate.',
        calculation: 'AWS operating margin expanded to 35.5%, up 1,120 basis points YoY.',
        aiAnalysis: 'Bedrock platform adoption accelerating enterprise multi-model deployment.',
        evidenceRef: 'SEC 10-Q Q2 2024'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-AMZN-1',
        condition: 'AWS quarterly operating margin drops below 28%',
        threshold: '< 28% AWS margin',
        currentStatus: '35.5% (Safe)',
        status: 'Safe',
        probabilityEstimate: '11% in 12m',
        impactSeverity: 'High'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'E-Commerce & Cloud Allocator',
        conviction: 'High',
        summary: 'Free cash flow inflecting upwards to >$50B run rate. The advertising business is pure profit margin that the market still undervalues.',
        coreArguments: ['Retail regionalization cutting cost-to-serve', 'AWS re-accelerating', 'Advertising revenues >$50B run rate'],
        keyVulnerability: 'Macro retail slowdown.',
        confidenceScore: 90
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'High',
        summary: 'Compelling risk-adjusted core allocation. Retail margin expansion and AWS cash generation provide valuation support.',
        coreArguments: ['Expanding FCF yield', 'Cloud dominance', 'High operational leverage'],
        keyVulnerability: 'Capital intensity expansion.',
        confidenceScore: 87
      }
    ],
    financialQuarters: [
      { period: 'Q3 23', revenue: 143.08, grossMarginPct: 47.6, operatingIncome: 11.19, netIncome: 9.88, freeCashFlow: 8.64, capex: 12.48 },
      { period: 'Q4 23', revenue: 169.96, grossMarginPct: 45.4, operatingIncome: 13.21, netIncome: 10.62, freeCashFlow: 14.88, capex: 14.12 },
      { period: 'Q1 24', revenue: 143.31, grossMarginPct: 49.3, operatingIncome: 15.31, netIncome: 10.43, freeCashFlow: 13.20, capex: 13.92 },
      { period: 'Q2 24', revenue: 147.98, grossMarginPct: 49.8, operatingIncome: 14.67, netIncome: 13.48, freeCashFlow: 15.12, capex: 16.42 }
    ],
    portfolioFit: {
      correlation: 0.65,
      sectorTechDelta: '+0.8%',
      riskContributionPct: 6.8,
      scenarioImpact: {
        rateHike100bps: '-3.0% estimated NAV impact',
        recessionMild: '-5.2% estimated NAV impact',
        techSelloff20Pct: '-10.8% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-AMZN-1',
        type: 'SEC 10-Q',
        title: 'Amazon.com Inc. Q2 2024 Form 10-Q',
        sourceDoc: 'SEC Form 10-Q',
        reportingDate: '2024-08-02',
        freshness: '35d ago',
        quote: 'Trailing twelve month free cash flow increased to $53.0 billion, compared with $7.9 billion for the twelve months ended June 30, 2023.',
        confidence: 99,
        verificationHash: 'sha256:1a2b...99ee'
      }
    ]
  },
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    price: 220.80,
    change: 0.90,
    changePercent: 0.41,
    volume: '45.1M',
    marketCap: '$3.37T',
    peRatio: 33.4,
    forwardPe: 29.5,
    psRatio: 8.8,
    evEbitda: 24.8,
    fcfYield: 3.2,
    dividendYield: 0.45,
    roic: 56.4,
    beta: 1.04,
    debtToEquity: 1.48,
    overallScore: 80,
    confidence: 97,
    dataCompleteness: 99,
    lastCalculated: '2024-09-06 13:15:00 UTC',
    dataFreshness: 'Refreshed 1h ago • Q3 FY24 10-Q',
    factorScores: {
      growth: 72,
      quality: 98,
      valuation: 64,
      risk: 88,
      momentum: 74,
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10,
    },
    rulesPassed: { passed: 5, total: 6 },
    whyThisStock: '2.2 billion active device installed base driving high-margin Services revenue ($24.2B quarterly, +14% YoY) with impending Apple Intelligence upgrade cycle.',
    aiInterpretation: 'Hardware replacement cycle expected to accelerate with iPhone 16 on-device intelligence features, though China market share pressures from Huawei remain an active headwind.',
    keyConcern: 'China smartphone market share contraction and ongoing DOJ antitrust lawsuit challenging App Store fee structures.',
    thesisStatus: 'Healthy',
    thesisOverview: 'World premier consumer brand ecosystem with unmatched pricing power, astronomical share repurchase consistency, and expanding services moat.',
    thesisPillars: [
      {
        name: 'Services Moat & Installed Base',
        score: 98,
        status: 'Strong',
        fact: 'Active installed base reached an all-time high across all products and geographic segments.',
        calculation: 'Services gross margin expanded to 74.0%, generating $17.9B in quarterly gross profit.',
        aiAnalysis: 'Recurring subscriptions now exceed 1 billion active accounts.',
        evidenceRef: 'SEC 10-Q Q3 FY24'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-AAPL-1',
        condition: 'DOJ antitrust ruling forcing mandatory third-party side-loading in the US without commission fees',
        threshold: 'Loss of App Store 30% fee jurisdiction',
        currentStatus: 'Litigation pending (Watch)',
        status: 'Warning',
        probabilityEstimate: '28% in 24m',
        impactSeverity: 'Moderate'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Consumer Tech Allocator',
        conviction: 'High',
        summary: 'Apple Intelligence will ignite the largest iPhone upgrade cycle since the 5G iPhone 12. Unmatched consumer privacy reputation makes Apple the trusted on-device AI broker.',
        coreArguments: ['Privacy-first AI positioning', 'Services expansion to >$100B ARR', '$110B authorized share buybacks'],
        keyVulnerability: 'Long hardware refresh cycles.',
        confidenceScore: 92
      },
      {
        role: 'Final Assessment',
        author: 'Investment Committee Consensus',
        conviction: 'High',
        summary: 'Anchor defensive compounder. Low beta, unmatched free cash flow return to shareholders, and ecosystem lock.',
        coreArguments: ['Fortress balance sheet', 'Capital return king', 'Installed base stability'],
        keyVulnerability: 'Hardware growth maturity.',
        confidenceScore: 88
      }
    ],
    financialQuarters: [
      { period: 'Q4 23', revenue: 89.50, grossMarginPct: 45.2, operatingIncome: 26.97, netIncome: 22.96, freeCashFlow: 19.50, capex: 2.45 },
      { period: 'Q1 24', revenue: 119.58, grossMarginPct: 45.9, operatingIncome: 40.37, netIncome: 33.92, freeCashFlow: 37.50, capex: 2.30 },
      { period: 'Q2 24', revenue: 90.75, grossMarginPct: 46.6, operatingIncome: 27.90, netIncome: 23.64, freeCashFlow: 22.70, capex: 2.10 },
      { period: 'Q3 24', revenue: 85.78, grossMarginPct: 46.3, operatingIncome: 25.35, netIncome: 21.45, freeCashFlow: 28.90, capex: 2.15 }
    ],
    portfolioFit: {
      correlation: 0.58,
      sectorTechDelta: '+1.6%',
      riskContributionPct: 8.8,
      scenarioImpact: {
        rateHike100bps: '-2.4% estimated NAV impact',
        recessionMild: '-3.8% estimated NAV impact',
        techSelloff20Pct: '-9.5% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-AAPL-1',
        type: 'SEC 10-Q',
        title: 'Apple Inc. Q3 FY24 Form 10-Q',
        sourceDoc: 'SEC Form 10-Q',
        reportingDate: '2024-08-02',
        freshness: '35d ago',
        quote: 'Services revenue was $24.2 billion, up 14% from the prior year quarter, establishing an all-time record.',
        confidence: 99,
        verificationHash: 'sha256:3d4e...7788'
      }
    ]
  },
  {
    ticker: 'LLY',
    name: 'Eli Lilly and Company',
    exchange: 'NYSE',
    sector: 'Healthcare',
    industry: 'Pharmaceuticals',
    price: 948.50,
    change: 8.20,
    changePercent: 0.87,
    volume: '2.8M',
    marketCap: '$901B',
    peRatio: 68.4,
    forwardPe: 41.2,
    psRatio: 22.1,
    evEbitda: 34.2,
    fcfYield: 1.8,
    dividendYield: 0.55,
    roic: 28.4,
    beta: 0.62,
    debtToEquity: 1.42,
    overallScore: 84,
    confidence: 92,
    dataCompleteness: 96,
    lastCalculated: '2024-09-06 14:30:00 UTC',
    dataFreshness: 'Refreshed 10m ago • SEC 10-Q Q2 2024',
    factorScores: {
      growth: 92,
      quality: 88,
      valuation: 48,
      risk: 78,
      momentum: 86
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10
    },
    rulesPassed: { passed: 5, total: 6 },
    whyThisStock: 'Global market dominance in incretin therapies (Mounjaro and Zepbound) creating unprecedented multi-year revenue compounding and expanding operating leverage.',
    aiInterpretation: 'GLP-1 manufacturing capacity expansions are coming online ahead of schedule, enabling Lilly to satisfy unconstrained demand while expanding indications into sleep apnea and MASH.',
    keyConcern: 'Manufacturing capacity constraints and compounding pharmacy copycats creating near-term supply frictions.',
    thesisStatus: 'Healthy',
    thesisOverview: 'Eli Lilly is positioned to capture >45% of the projected $100B+ global obesity and metabolic disease market through dual GIP/GLP-1 receptor agonist superiority.',
    thesisPillars: [
      {
        name: 'Incretin Franchise Scalability',
        score: 94,
        status: 'Strong',
        fact: 'Mounjaro and Zepbound combined quarterly revenues surpassed $4.3B in Q2 2024, surging over 130% YoY.',
        calculation: 'Obesity and diabetes therapies now represent 48.6% of consolidated sales, driving a 400 bps gross margin expansion.',
        aiAnalysis: 'Multi-indication labeling expansion creates recurring prescription adherence with low discontinuation rates.',
        uncertainty: 'Payer reimbursement formulary restrictions in Medicare Part D could constrain velocity.',
        evidenceRef: 'SEC Form 10-Q Item 2 MD&A, Aug 8, 2024'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-LLY-1',
        condition: 'FDA boxed warning or phase 4 clinical evidence of severe off-target malignancies',
        threshold: 'Adverse boxed safety restriction',
        currentStatus: 'Safe (SURPASS-CVOT confirms net cardiovascular mortality reduction)',
        status: 'Safe',
        probabilityEstimate: '5% probability in 24m',
        impactSeverity: 'Severe'
      }
    ],
    aiCommittee: [
      {
        role: 'Bull Case',
        author: 'Pharmaceutical Franchise Analyst',
        conviction: 'High',
        summary: 'Tirzepatide is the fastest pharmaceutical ramp in modern history. New oral GLP-1 (orforglipron) will unlock needle-phobic patient cohorts and sustain double-digit CAGR.',
        coreArguments: ['Global obesity duopoly with Novo Nordisk', 'New injectable manufacturing facility in Concord, NC operational in Q4'],
        keyVulnerability: 'Potential price concessions required to win Medicaid / NHS tier-1 coverage.',
        confidenceScore: 92
      }
    ],
    financialQuarters: [
      { period: 'Q3 2023', revenue: 9.50, grossMarginPct: 80.4, operatingIncome: 2.80, netIncome: 2.45, freeCashFlow: 1.80, capex: 0.85 },
      { period: 'Q4 2023', revenue: 9.35, grossMarginPct: 81.2, operatingIncome: 2.75, netIncome: 2.19, freeCashFlow: 1.95, capex: 0.90 },
      { period: 'Q1 2024', revenue: 8.77, grossMarginPct: 80.9, operatingIncome: 2.60, netIncome: 2.24, freeCashFlow: 1.60, capex: 0.95 },
      { period: 'Q2 2024', revenue: 11.30, grossMarginPct: 82.3, operatingIncome: 3.72, netIncome: 2.97, freeCashFlow: 2.40, capex: 1.10 }
    ],
    portfolioFit: {
      correlation: 0.38,
      sectorTechDelta: '-3.1%',
      riskContributionPct: 7.8,
      scenarioImpact: {
        rateHike100bps: '+1.2% estimated NAV impact',
        recessionMild: '+3.4% estimated NAV impact',
        techSelloff20Pct: '+6.1% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-LLY-1',
        type: 'SEC 10-Q',
        title: 'Eli Lilly Q2 2024 Quarterly Report',
        sourceDoc: 'SEC Form 10-Q',
        reportingDate: '2024-08-08',
        freshness: '29d ago',
        quote: 'Revenue for the second quarter of 2024 was $11.30 billion, an increase of 36% compared with the second quarter of 2023, driven by volume increases from Mounjaro and Zepbound.',
        confidence: 99,
        verificationHash: 'sha256:7a9c...2211',
        extractedPillar: 'Incretin Franchise Scalability'
      }
    ]
  },
  {
    ticker: 'JPM',
    name: 'JPMorgan Chase & Co.',
    exchange: 'NYSE',
    sector: 'Financial Services',
    industry: 'Diversified Banking',
    price: 214.30,
    change: 1.45,
    changePercent: 0.68,
    volume: '8.4M',
    marketCap: '$612B',
    peRatio: 11.8,
    forwardPe: 11.2,
    psRatio: 3.4,
    evEbitda: 8.9,
    fcfYield: 8.2,
    dividendYield: 2.15,
    roic: 18.2,
    beta: 0.88,
    debtToEquity: 1.15,
    overallScore: 81,
    confidence: 95,
    dataCompleteness: 99,
    lastCalculated: '2024-09-06 14:30:00 UTC',
    dataFreshness: 'Refreshed 12m ago • SEC 10-Q Q2 2024',
    factorScores: {
      growth: 72,
      quality: 94,
      valuation: 84,
      risk: 82,
      momentum: 76
    },
    factorWeights: {
      growth: 30,
      quality: 25,
      valuation: 20,
      risk: 15,
      momentum: 10
    },
    rulesPassed: { passed: 6, total: 6 },
    whyThisStock: 'Fortress balance sheet, premier deposit franchise, and compounding net interest income dominance post-First Republic acquisition.',
    aiInterpretation: 'Resilient net interest income guidance despite impending Fed easing cycle; investment banking pipeline rebounds as debt capital markets re-open.',
    keyConcern: 'Macro credit normalization in commercial real estate and regulatory Basel III endgame capital surcharge uncertainty.',
    thesisStatus: 'Healthy',
    thesisOverview: 'JPMorgan Chase operates with an insurmountable scale advantage across consumer, commercial, and investment banking, producing industry-leading Return on Tangible Common Equity (ROTCE >20%).',
    thesisPillars: [
      {
        name: 'Fortress Deposit Franchise & ROTCE',
        score: 96,
        status: 'Strong',
        fact: 'Reported Q2 2024 net income of $18.1B (including First Republic gain) with ROTCE of 28%.',
        calculation: 'Net Interest Income guidance increased to $91B for FY2024, showing minimal deposit flight.',
        aiAnalysis: 'Scale in technology investments ($17B annual budget) creates operational efficiency moat inaccessible to regional competitors.',
        uncertainty: 'Yield curve shifts may impact asset liability management spreads during rapid rate cutting.',
        evidenceRef: 'SEC Form 10-Q Earnings Release, July 12, 2024'
      }
    ],
    thesisBreakers: [
      {
        id: 'TB-JPM-1',
        condition: 'Net charge-offs exceeding 150 bps annualized across combined card and wholesale portfolios',
        threshold: '> 150 bps Net Charge-Offs',
        currentStatus: '58 bps current annualized loss rate (Safe)',
        status: 'Safe',
        probabilityEstimate: '8% probability in 24m',
        impactSeverity: 'Moderate'
      }
    ],
    aiCommittee: [
      {
        role: 'Base Case',
        author: 'Banking & Financials Specialist',
        conviction: 'Moderate',
        summary: 'The undisputed gold standard of global banking. High capital returns (ROTCE >20%) and defensive liquidity anchor portfolio resilience during equity market drawdowns.',
        coreArguments: ['Leading US deposit market share (12.4%)', 'Investment banking fee recovery +46% YoY in Q2'],
        keyVulnerability: 'Peak net interest margins are behind us as deposit betas mature.',
        confidenceScore: 90
      }
    ],
    financialQuarters: [
      { period: 'Q3 2023', revenue: 39.87, grossMarginPct: 58.2, operatingIncome: 15.42, netIncome: 13.15, freeCashFlow: 8.20, capex: 1.40 },
      { period: 'Q4 2023', revenue: 38.57, grossMarginPct: 56.4, operatingIncome: 12.10, netIncome: 9.31, freeCashFlow: 6.80, capex: 1.55 },
      { period: 'Q1 2024', revenue: 41.93, grossMarginPct: 60.1, operatingIncome: 16.20, netIncome: 13.42, freeCashFlow: 9.10, capex: 1.50 },
      { period: 'Q2 2024', revenue: 50.99, grossMarginPct: 62.4, operatingIncome: 21.30, netIncome: 18.15, freeCashFlow: 12.40, capex: 1.60 }
    ],
    portfolioFit: {
      correlation: 0.42,
      sectorTechDelta: '-2.8%',
      riskContributionPct: 6.4,
      scenarioImpact: {
        rateHike100bps: '+2.8% estimated NAV impact',
        recessionMild: '-3.1% estimated NAV impact',
        techSelloff20Pct: '+4.2% estimated NAV impact'
      }
    },
    evidenceSources: [
      {
        id: 'EV-JPM-1',
        type: 'SEC 10-Q',
        title: 'JPMorgan Chase & Co. Q2 2024 Form 10-Q',
        sourceDoc: 'SEC Form 10-Q',
        reportingDate: '2024-08-06',
        freshness: '31d ago',
        quote: 'Net revenue on a managed basis was $51.0 billion, up 20% from the prior year quarter. ROTCE was 28% for the second quarter.',
        confidence: 99,
        verificationHash: 'sha256:4b8a...9911',
        extractedPillar: 'Fortress Deposit Franchise & ROTCE'
      }
    ]
  }
];

// Enrich US equities with canonical multi-market metadata
const canonicalMap = new Map(CANONICAL_SECURITIES.map(c => [c.symbol, c]));

const ENRICHED_US_STOCKS: Stock[] = US_STOCKS_BASE.map(s => {
  const canonical = canonicalMap.get(s.ticker);
  return {
    ...s,
    id: s.id || canonical?.id || `us-${s.ticker.toLowerCase()}`,
    symbol: s.symbol || canonical?.symbol || s.ticker,
    companyName: s.companyName || canonical?.companyName || s.name,
    market: s.market || canonical?.market || 'US',
    exchange: s.exchange || canonical?.exchange || 'NASDAQ',
    country: s.country || canonical?.country || 'US',
    currency: s.currency || canonical?.currency || 'USD',
    isin: s.isin !== undefined ? s.isin : (canonical?.isin || null),
    assetType: s.assetType || canonical?.assetType || 'EQUITY'
  };
});

// BSE variants of Indian equities for dual-exchange mapping
const BSE_INDIAN_STOCKS: Stock[] = INDIAN_STOCKS.map(s => ({
  ...s,
  id: `in-bse-${s.ticker.toLowerCase()}`,
  exchange: 'BSE'
}));

// Canonical universe containing US and Indian equities as first-class citizens
export const MOCK_STOCKS: Stock[] = [...ENRICHED_US_STOCKS, ...INDIAN_STOCKS, ...BSE_INDIAN_STOCKS];

export const CANONICAL_SECURITIES_MAP: Record<string, Stock> = MOCK_STOCKS.reduce((acc, stock) => {
  // Map by ticker (defaulting to primary exchange NSE for Indian equities)
  if (!acc[stock.ticker] || stock.exchange === 'NSE') {
    acc[stock.ticker] = stock;
  }
  // Also map by canonical security ID
  if (stock.id) {
    acc[stock.id] = stock;
  }
  return acc;
}, {} as Record<string, Stock>);

export const MOCK_PORTFOLIO: PortfolioData = derivePortfolio(
  DEFAULT_HOLDING_POSITIONS,
  CANONICAL_SECURITIES_MAP
);

export const MOCK_STRATEGIES: Strategy[] = [
  {
    id: 'strat-1',
    title: 'Quality Compounders with FCF Moat',
    prompt: 'Find large-cap companies with strong revenue growth (>15%), positive free cash flow margin (>20%), high ROIC (>20%), and strong relative strength momentum. Rebalance monthly.',
    description: 'Systematic screening strategy targeting market leaders with high economic return on invested capital, disciplined capital allocation, and strong organic cash generation.',
    status: 'Backtest Verified Strategy',
    targetUniverse: 'S&P 500 & NASDAQ 100',
    rebalanceFrequency: 'Monthly (1st Trading Day)',
    lastRun: '2024-09-01',
    quickMetrics: {
      cagr: '22.8%',
      sharpe: '1.42',
      maxDd: '-16.4%'
    },
    rules: [
      { category: 'Universe', description: 'Market Cap > $50B, Daily Volume > $50M', parameters: 'MCap >= $50B, Vol >= 50M' },
      { category: 'Entry Rule', description: 'ROIC >= 20.0%, 3Y Revenue CAGR >= 15.0%', parameters: 'ROIC >= 20%, RevCAGR >= 15%' },
      { category: 'Entry Rule', description: 'Free Cash Flow Margin >= 20.0%', parameters: 'FCF / Revenue >= 0.20' },
      { category: 'Entry Rule', description: 'Net Debt / EBITDA < 1.5x (excluding Financials)', parameters: 'NetDebt / EBITDA < 1.5' },
      { category: 'Position Sizing', description: 'Volatility-adjusted equal weight capped at 8% per name', parameters: 'Weight = min(0.08, inv_vol / sum_inv_vol)' },
      { category: 'Exit Rule', description: 'Trailing stop-loss of 12% from peak or thesis status marked Deteriorating', parameters: 'Drawdown > 12% or ThesisStatus == Deteriorating' },
      { category: 'Rebalancing', description: 'Monthly calendar rebalance with 5 bps slippage model', parameters: 'Monthly, slip=0.0005' }
    ],
    backtestResult: {
      totalReturn: 178.4,
      cagr: 22.8,
      sharpeRatio: 1.42,
      sortinoRatio: 1.88,
      maxDrawdown: -16.4,
      annualizedVol: 17.2,
      winRate: 64.5,
      tradesCount: 142,
      benchmarkTotalReturn: 94.2,
      equityCurve: [
        { date: '2019-01', strategy: 100000, benchmark: 100000, drawdown: 0 },
        { date: '2019-06', strategy: 114200, benchmark: 109800, drawdown: -2.1 },
        { date: '2019-12', strategy: 131500, benchmark: 122400, drawdown: -1.2 },
        { date: '2020-03', strategy: 118400, benchmark: 98500, drawdown: -12.4 },
        { date: '2020-06', strategy: 148200, benchmark: 118200, drawdown: 0 },
        { date: '2020-12', strategy: 178900, benchmark: 138400, drawdown: 0 },
        { date: '2021-06', strategy: 198400, benchmark: 154200, drawdown: -3.1 },
        { date: '2021-12', strategy: 224600, benchmark: 172800, drawdown: 0 },
        { date: '2022-06', strategy: 194200, benchmark: 139400, drawdown: -15.8 },
        { date: '2022-12', strategy: 189800, benchmark: 141200, drawdown: -16.4 },
        { date: '2023-06', strategy: 226400, benchmark: 164200, drawdown: 0 },
        { date: '2023-12', strategy: 248900, benchmark: 178400, drawdown: 0 },
        { date: '2024-06', strategy: 272400, benchmark: 191200, drawdown: -2.8 },
        { date: '2024-09', strategy: 278400, benchmark: 194200, drawdown: -1.4 }
      ],
      monthlyReturns: [
        { year: 2024, months: [1.8, 3.2, 2.1, -1.9, 4.4, 2.8, -0.8, 2.2, 1.4], ytd: 16.2 },
        { year: 2023, months: [4.2, -1.1, 3.8, 1.2, 5.4, 4.1, 2.8, -2.4, -3.1, -1.2, 7.8, 4.2], ytd: 28.6 },
        { year: 2022, months: [-4.2, -2.8, 1.4, -6.8, -1.2, -4.8, 6.2, -3.4, -6.1, 4.2, 3.8, -4.1], ytd: -17.4 }
      ],
      warnings: {
        overfittingRisk: 'Moderate: 5 quantitative filters applied. Tested across 2019-2024 macro cycles including low-rate, inflationary hike, and AI inflection regimes.',
        lookAheadBias: 'Verified: Point-in-time financial database used with mandatory 45-day lag post quarter-end for SEC filing availability.',
        survivorshipBias: 'Controlled: Historical index constituents included delisted, merged, and acquired equities.',
        transactionCostImpact: 'Modeled: 5 bps per trade slippage plus $0.005/share brokerage assumption subtracted at each rebalance cycle.'
      }
    }
  },
  {
    id: 'strat-2',
    title: 'Sovereign AI & Semiconductor Infrastructure',
    prompt: 'Identify semiconductor manufacturing and equipment leaders with proprietary IP, operating margins above 30%, and order backlogs exceeding 1x annual revenue.',
    description: 'Specialized thematic strategy focusing on hardware bottlenecks in the artificial intelligence supply chain (foundries, packaging, lithography, EDA software).',
    status: 'AI Generated Strategy',
    targetUniverse: 'Global Semiconductor & Hardware (US, EU, TW ADRs)',
    rebalanceFrequency: 'Quarterly',
    rules: [
      { category: 'Universe', description: 'Global Semiconductor producers with Market Cap > $20B', parameters: 'Sector == Semiconductor, MCap >= 20B' },
      { category: 'Entry Rule', description: 'Operating Margin >= 30.0%, R&D / Revenue >= 10.0%', parameters: 'OpMargin >= 0.30, RD_Rev >= 0.10' },
      { category: 'Entry Rule', description: 'EBITDA Interest Coverage >= 8.0x', parameters: 'EBITDA / Interest >= 8.0' },
      { category: 'Position Sizing', description: 'Market-cap tiered sizing (Tier 1: 10%, Tier 2: 5%)', parameters: 'Tiered weight' },
      { category: 'Exit Rule', description: 'Gross Margin reduction > 300 bps YoY in quarterly filing', parameters: 'GM_YoY < -0.03' }
    ]
  },
  {
    id: 'strat-3',
    title: 'Low Beta High ROIC Defensive Compounders',
    prompt: 'Screen for resilient companies with Beta < 0.9, ROIC > 18%, net debt to equity < 0.5, and 10+ consecutive years of dividend increases.',
    description: 'All-weather defensive strategy designed to protect capital during late-cycle volatility while participating in compounding free cash flows.',
    status: 'Backtest Verified Strategy',
    targetUniverse: 'S&P 500 Dividend Aristocrats',
    rebalanceFrequency: 'Semi-Annually',
    lastRun: '2024-08-15',
    quickMetrics: {
      cagr: '14.6%',
      sharpe: '1.28',
      maxDd: '-11.2%'
    },
    rules: [
      { category: 'Universe', description: 'S&P 500 non-speculative equities', parameters: 'SP500' },
      { category: 'Entry Rule', description: '5Y Beta < 0.90, ROIC >= 18.0%', parameters: 'Beta < 0.90, ROIC >= 18%' },
      { category: 'Entry Rule', description: 'Consecutive Dividend Growth >= 10 Years', parameters: 'DivGrowthYears >= 10' },
      { category: 'Position Sizing', description: 'Equal weight 4% across 25 holdings', parameters: 'Weight = 0.04' }
    ]
  }
];

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: 'alt-1',
    type: 'company',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    title: 'Blackwell Yield Mask Revision Confirmed',
    whatChanged: 'CFO Colette Kress confirmed mask change implementation at TSMC during Q2 earnings call, on schedule for Q4 FY25 volume ramp.',
    whyItMatters: 'Removes primary uncertainty around thermal packaging yield defects that caused speculative volatility in early August.',
    evidence: {
      source: 'Q2 FY25 Conference Call Transcript',
      filingDate: '2024-08-28',
      confidence: 96
    },
    timestamp: '2h ago',
    read: false,
    severity: 'info',
    provenanceType: 'FACT'
  },
  {
    id: 'alt-2',
    type: 'risk',
    ticker: 'PLTR',
    companyName: 'Palantir Technologies',
    title: 'Valuation Multiples Reach 95th Percentile',
    whatChanged: 'Forward Enterprise Value to Sales multiple touched 28.5x following retail momentum rally, triggering quantitative risk warning flag.',
    whyItMatters: 'Drawdown risk elevated: any slight miss in US Commercial customer additions during Q3 will provoke disproportionate derating.',
    evidence: {
      source: 'Calculated FactSet Multiples Consensus',
      filingDate: '2024-09-06',
      confidence: 98
    },
    timestamp: '4h ago',
    read: false,
    severity: 'warning',
    provenanceType: 'CALCULATION'
  },
  {
    id: 'alt-3',
    type: 'portfolio',
    title: 'Tech Concentration Beta Drift',
    whatChanged: 'Aggregate portfolio allocation to Technology sector expanded to 48.2% following recent semiconductor outperformance.',
    whyItMatters: 'Exceeds targeted maximum threshold of 45.0%. Daily portfolio volatility now 78% correlated to NASDAQ-100 index fluctuations.',
    evidence: {
      source: 'Portfolio Risk Decomposition Model',
      filingDate: '2024-09-06',
      confidence: 99
    },
    timestamp: '1d ago',
    read: true,
    severity: 'warning',
    provenanceType: 'CALCULATION'
  },
  {
    id: 'alt-4',
    type: 'thesis',
    ticker: 'ASML',
    companyName: 'ASML Holding N.V.',
    title: 'Dutch Government Expands Export Licensing Authority',
    whatChanged: 'Dutch trade ministry announced updated national export regulations taking over licensing jurisdiction for certain DUV immersion tools (Twinscan 1970/1980i).',
    whyItMatters: 'Direct impact on servicing existing Chinese customer tool installations; revenue guidance for FY25 China sales likely to reflect tightened spare parts authorizations.',
    evidence: {
      source: 'Dutch Ministry of Foreign Trade Gazette',
      filingDate: '2024-09-05',
      confidence: 94
    },
    timestamp: '1d ago',
    read: false,
    severity: 'warning',
    provenanceType: 'RISK'
  },
  {
    id: 'alt-5',
    type: 'earnings',
    ticker: 'AVGO',
    companyName: 'Broadcom Inc.',
    title: 'Q3 FY24 AI Semiconductor Revenue Reaches $3.1B',
    whatChanged: 'Quarterly AI silicon revenue expanded 43% sequentially to $3.1B, exceeding consensus estimates of $2.8B.',
    whyItMatters: 'Validates custom accelerator demand from Google and Meta; full-year AI revenue forecast revised upward to $12B.',
    evidence: {
      source: 'SEC Form 10-Q Item 2 MD&A',
      filingDate: '2024-09-05',
      confidence: 99
    },
    timestamp: '1d ago',
    read: true,
    severity: 'info',
    provenanceType: 'FACT'
  },
  {
    id: 'alt-6',
    type: 'thesis',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    title: 'Thesis Breaker TB-3 Sensitivity Increase',
    whatChanged: 'Meta announced deployment of next-gen MTIA custom silicon for ranking and recommendation workloads across Llama 3 training auxiliary clusters.',
    whyItMatters: 'Monitors custom silicon substitution rate. Current estimated share of custom chips in hyperscaler training stands at ~9%, below the 25% thesis-breaker threshold.',
    evidence: {
      source: 'Meta Engineering Disclosures & IR Note',
      filingDate: '2024-08-30',
      confidence: 88
    },
    timestamp: '6d ago',
    read: true,
    severity: 'info',
    provenanceType: 'AI ANALYSIS'
  }
];

export const MOCK_RESEARCH_QUERIES: ResearchQueryItem[] = [
  {
    id: 'rq-1',
    query: 'What are the primary risk factors regarding NVIDIA Blackwell architecture ramp yield and packaging bottlenecks?',
    date: '2024-09-05',
    ticker: 'NVDA',
    answerSummary: 'Evidence indicates NVIDIA executed a physical metal mask modification to resolve low yield issues on the large reticle-size Blackwell GPU die. While sampling has begun, volume shipments are dependent on TSMC CoWoS-L packaging capacity scaling, with production ramp expected in Q4 FY25.',
    groundedFacts: [
      { statement: 'Blackwell GPU utilizes a redesigned metal layer mask to eliminate thermal expansion mismatch between the two reticle-limited compute dies.', tag: 'FACT', sourceIndex: 0 },
      { statement: 'Gross margin for Q3 FY25 is projected at 75.0% (+/- 50 bps), incorporating initial lower-margin Blackwell ramp costs before normalizing.', tag: 'CALCULATION', sourceIndex: 1 },
      { statement: 'TSMC CoWoS-L capacity is the critical bottleneck, with industry estimates showing total capacity expanding from 35k wpm in late 2024 to 70k wpm by end of 2025.', tag: 'AI ANALYSIS', sourceIndex: 2 },
      { statement: 'Key risk: Any additional packaging delay could defer an estimated $3-5B in high-margin datacenter revenue from Q4 FY25 into Q1 FY26.', tag: 'RISK', sourceIndex: 3 },
      { statement: 'Uncertainty remains around enterprise customer thermal management readiness for 120kW liquid-cooled NVL72 rack architectures.', tag: 'UNCERTAINTY', sourceIndex: 2 }
    ],
    sources: [
      {
        id: 's-1',
        name: 'NVIDIA Q2 FY25 Form 10-Q',
        docType: 'SEC Filing',
        date: '2024-08-28',
        excerpt: 'We executed a change to the Blackwell GPU mask to improve production yield. Blackwell production ramp is scheduled to begin in the fourth quarter and continue into fiscal 2026.',
        confidence: 99
      },
      {
        id: 's-2',
        name: 'NVIDIA CFO Commentary & Financial Outlook',
        docType: 'Official IR Disclosure',
        date: '2024-08-28',
        excerpt: 'GAAP and non-GAAP gross margins are expected to be 74.4% and 75.0%, respectively, plus or minus 50 basis points. For the full year, gross margins are expected to be in the mid-70% range.',
        confidence: 98
      },
      {
        id: 's-3',
        name: 'Semiconductor Supply Chain Research (Morgan Stanley / TrendForce)',
        docType: 'Equity Research Report',
        date: '2024-08-30',
        excerpt: 'TSMC is aggressively expanding CoWoS-L allocation in Taichung Fab 15. The yield issue was related to bridge-die CTE (coefficient of thermal expansion) mismatch, now resolved by revised underfill chemistry.',
        confidence: 91
      },
      {
        id: 's-4',
        name: 'NVIDIA SEC Form 10-K Item 1A Risk Factors',
        docType: 'SEC Filing',
        date: '2024-02-21',
        excerpt: 'If we or our suppliers fail to deliver products in the required volumes, our business will be harmed. Advanced packaging processes are complex and yield fluctuations may impact our gross margins.',
        confidence: 97
      }
    ]
  },
  {
    id: 'rq-2',
    query: 'How sustainable is Big Tech Hyperscaler capital expenditure on AI compute over the next 24 months?',
    date: '2024-09-02',
    ticker: 'MSFT',
    answerSummary: 'Aggregate hyperscaler (Microsoft, Alphabet, Meta, Amazon) 2024 capex is budgeted to exceed $205B, representing an increase of >38% YoY. While balance sheets possess historic cash reserves, return on invested capital (ROIC) will face scrutiny by late 2025 unless generative AI software revenues accelerate.',
    groundedFacts: [
      { statement: 'Combined cash and marketable securities of MSFT, GOOGL, META, and AMZN exceed $310 billion as of Q2 2024.', tag: 'FACT', sourceIndex: 0 },
      { statement: 'Microsoft FY24 capital expenditure was $55.7 billion, with Q4 alone reaching $19.0 billion (including finance leases).', tag: 'CALCULATION', sourceIndex: 1 },
      { statement: 'Cloud revenue acceleration (Azure 29%, GCP 29%, AWS 19%) provides near-term cash flow justification for infrastructure commitments.', tag: 'FACT', sourceIndex: 0 },
      { statement: 'Capital intensity (Capex / Revenue) is at peak historical levels of 22-26% for Microsoft and Meta, reminiscent of telecom fiber buildouts in 1999-2000.', tag: 'AI ANALYSIS', sourceIndex: 2 },
      { statement: 'Primary risk is a "capex digestion pause" in late 2025 if enterprise copilot renewals fail to demonstrate measurable productivity lift.', tag: 'RISK', sourceIndex: 2 }
    ],
    sources: [
      {
        id: 's-21',
        name: 'Consolidated Hyperscaler SEC 10-Q Filings (MSFT, GOOGL, META, AMZN)',
        docType: 'SEC Filing',
        date: '2024-08-05',
        excerpt: 'Aggregate trailing 12-month capital expenditures across the top four US cloud providers reached $174.2B, accelerating towards a projected $205B+ calendar 2024 pace.',
        confidence: 99
      },
      {
        id: 's-22',
        name: 'Microsoft Corporation FY24 Form 10-K',
        docType: 'SEC Filing',
        date: '2024-07-30',
        excerpt: 'Additions to property and equipment were $44.5 billion in fiscal year 2024, compared to $28.1 billion in fiscal year 2023, primarily to support cloud and AI demand.',
        confidence: 99
      },
      {
        id: 's-23',
        name: 'Sequoia Capital / Goldman Sachs Research Dossier',
        docType: 'Institutional Macro Note',
        date: '2024-06-20',
        excerpt: 'The AI ecosystem must generate $600B in annual revenue to pay for the data center and compute hardware currently being commissioned. Currently, run-rate revenue is roughly $30-40B.',
        confidence: 89
      }
    ]
  }
];

export const MOCK_WATCHLIST: { ticker: string; thesisStatus: Stock['thesisStatus']; alertThreshold: string }[] = [
  { ticker: 'NVDA', thesisStatus: 'Healthy', alertThreshold: 'GM < 70% or Drawdown > 15%' },
  { ticker: 'MSFT', thesisStatus: 'Healthy', alertThreshold: 'Azure Growth < 22%' },
  { ticker: 'ASML', thesisStatus: 'Healthy', alertThreshold: 'Backlog < €28B' },
  { ticker: 'TSM', thesisStatus: 'Healthy', alertThreshold: 'Cross-Strait Escalation / Wafer Price Cut' },
  { ticker: 'AVGO', thesisStatus: 'Healthy', alertThreshold: 'Loss of Tier-1 ASIC Client' },
  { ticker: 'AMZN', thesisStatus: 'Healthy', alertThreshold: 'AWS Margin < 28%' },
  { ticker: 'AAPL', thesisStatus: 'Healthy', alertThreshold: 'DOJ Restructuring Order' },
  { ticker: 'PLTR', thesisStatus: 'Watch', alertThreshold: 'Commercial Growth < 30% or Multiple > 30x EV/S' },
];

export const MOCK_BACKTEST: BacktestResult = {
  id: 'bt-1',
  strategyId: 'strat-1',
  strategyTitle: 'Quality Compounders with FCF Moat',
  period: '2019-01-01 to 2024-09-01 (5.7 Years)',
  universe: 'S&P 500 & NASDAQ 100',
  sizing: 'Equal-Weight (5% Max Cap)',
  rebalanceFrequency: 'Monthly',
  totalReturn: 214.8,
  totalReturnPct: 214.8,
  cagr: 22.8,
  sharpeRatio: 1.42,
  sortinoRatio: 2.48,
  maxDrawdown: -16.4,
  annualizedVol: 18.4,
  winRate: 68.2,
  profitFactor: 2.34,
  totalTrades: 142,
  tradesCount: 142,
  benchmarkTotalReturn: 118.4,
  equityCurve: [
    { date: '2019-01', strategy: 100000, benchmark: 100000, drawdown: 0 },
    { date: '2019-06', strategy: 114200, benchmark: 108400, drawdown: -1.2 },
    { date: '2019-12', strategy: 131500, benchmark: 122600, drawdown: -0.5 },
    { date: '2020-03', strategy: 112000, benchmark: 98500, drawdown: -14.8 },
    { date: '2020-06', strategy: 142800, benchmark: 118200, drawdown: 0 },
    { date: '2020-12', strategy: 178400, benchmark: 142000, drawdown: 0 },
    { date: '2021-06', strategy: 204500, benchmark: 159800, drawdown: -2.1 },
    { date: '2021-12', strategy: 238900, benchmark: 174500, drawdown: 0 },
    { date: '2022-06', strategy: 202100, benchmark: 141200, drawdown: -15.4 },
    { date: '2022-10', strategy: 199700, benchmark: 134200, drawdown: -16.4 },
    { date: '2022-12', strategy: 208500, benchmark: 142800, drawdown: -12.7 },
    { date: '2023-06', strategy: 254200, benchmark: 165400, drawdown: 0 },
    { date: '2023-12', strategy: 284000, benchmark: 188600, drawdown: 0 },
    { date: '2024-06', strategy: 314800, benchmark: 218400, drawdown: 0 }
  ],
  tradeLog: [
    { id: 't-1', date: '2024-08-01', ticker: 'NVDA', action: 'BUY' as const, shares: 85, price: 109.21, returnPct: 17.8, rationale: 'ROIC 64% threshold maintained; FCF yield 2.8%' },
    { id: 't-2', date: '2024-08-01', ticker: 'TSM', action: 'BUY' as const, shares: 60, price: 162.40, returnPct: 5.6, rationale: 'Operating margin > 42% confirmed in Q2 10-Q filing' },
    { id: 't-3', date: '2024-07-01', ticker: 'MSFT', action: 'BUY' as const, shares: 45, price: 441.50, returnPct: 1.4, rationale: 'Azure growth 29% YoY rebalance entry' },
    { id: 't-4', date: '2024-06-03', ticker: 'INTC', action: 'SELL' as const, shares: 120, price: 30.12, returnPct: -22.4, rationale: 'Thesis Breaker: FCF margin collapsed to negative; dividend suspended' },
    { id: 't-5', date: '2024-05-02', ticker: 'ASML', action: 'BUY' as const, shares: 25, price: 890.10, returnPct: -4.2, rationale: 'High-NA EUV commercial shipment milestone passed' }
  ],
  warnings: {
    overfittingRisk: 'Low (6 factor rules with walk-forward validation)',
    lookAheadBias: 'Mitigated via strict point-in-time SEC acceptance timestamps',
    survivorshipBias: 'Delisted S&P constituents modeled at time of departure',
    transactionCostImpact: 'Modeled with 5 bps adverse selection slippage'
  }
};

export const INITIAL_APP_STATE: AppState = {
  securities: CANONICAL_SECURITIES_MAP,
  portfolio: MOCK_PORTFOLIO,
  watchlist: ['NVDA', 'TSM', 'MSFT', 'ASML', 'AMZN'],
  alerts: MOCK_ALERTS,
  strategies: MOCK_STRATEGIES,
  backtests: {
    'strat-1': MOCK_BACKTEST,
    'bt-1': MOCK_BACKTEST
  },
  researchQueries: MOCK_RESEARCH_QUERIES
};

// Aliases for convenient importing
export const mockStocks = MOCK_STOCKS;
export const mockPortfolio = MOCK_PORTFOLIO;
export const mockStrategies = MOCK_STRATEGIES;
export const mockBacktest = MOCK_BACKTEST;
export const mockAlerts = MOCK_ALERTS;
export const mockWatchlist = MOCK_WATCHLIST;
export const mockResearchQueries = MOCK_RESEARCH_QUERIES;

