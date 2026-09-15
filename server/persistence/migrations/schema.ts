/**
 * Phase 16: Versioned Database Schema Migrations
 * 
 * Rules:
 * - Forward only
 * - Deterministic & idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS)
 * - Explicit timestamp preservation
 * - Never drops tables or loses data
 */

export interface Migration {
  version: number;
  name: string;
  up: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_persistence_schema',
    up: [
      // 1. Schema Migrations tracker
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,

      // 2. Canonical Securities
      `CREATE TABLE IF NOT EXISTS canonical_securities (
        id TEXT PRIMARY KEY,
        ticker TEXT NOT NULL,
        company_name TEXT NOT NULL,
        market TEXT NOT NULL,
        exchange TEXT NOT NULL,
        country TEXT NOT NULL,
        currency TEXT NOT NULL,
        isin TEXT,
        sector TEXT,
        industry TEXT,
        aliases JSONB DEFAULT '[]'::jsonb,
        provider_symbol_mappings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_canonical_securities_ticker ON canonical_securities(ticker);`,

      // 3. Research Documents (Phase 14)
      `CREATE TABLE IF NOT EXISTS research_documents (
        document_id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        document_type TEXT NOT NULL,
        content_hash TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        author TEXT,
        published_at TIMESTAMPTZ,
        available_from TIMESTAMPTZ,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processing_status TEXT NOT NULL,
        security_associations JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        extraction_metadata JSONB DEFAULT '{}'::jsonb,
        page_row_provenance JSONB DEFAULT '[]'::jsonb,
        storage_reference TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_research_documents_hash ON research_documents(content_hash);`,

      // 4. Evidence Items (Phase 8A, immutable/versioned)
      `CREATE TABLE IF NOT EXISTS evidence_items (
        evidence_id TEXT PRIMARY KEY,
        security_id TEXT,
        source_type TEXT NOT NULL,
        provider TEXT NOT NULL,
        document_id TEXT,
        document_type TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        structured_value JSONB,
        unit TEXT,
        currency TEXT,
        published_at TIMESTAMPTZ,
        filing_date TIMESTAMPTZ,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        epistemic_status TEXT NOT NULL,
        is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
        source_reference JSONB,
        metadata JSONB DEFAULT '{}'::jsonb,
        conflict_info JSONB,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_evidence_items_sec_pub ON evidence_items(security_id, published_at);`,

      // 5. Research Notebooks (Phase 13)
      `CREATE TABLE IF NOT EXISTS research_notebooks (
        notebook_id TEXT PRIMARY KEY,
        security_id TEXT NOT NULL,
        query_context TEXT,
        source_registry JSONB DEFAULT '[]'::jsonb,
        evidence_references JSONB DEFAULT '[]'::jsonb,
        claims JSONB DEFAULT '[]'::jsonb,
        thesis JSONB,
        bull_case JSONB DEFAULT '[]'::jsonb,
        bear_case JSONB DEFAULT '[]'::jsonb,
        catalysts JSONB DEFAULT '[]'::jsonb,
        risks JSONB DEFAULT '[]'::jsonb,
        evidence_gaps JSONB DEFAULT '[]'::jsonb,
        contradictions JSONB DEFAULT '[]'::jsonb,
        invalidation_conditions JSONB DEFAULT '[]'::jsonb,
        quantitative_context JSONB,
        portfolio_context JSONB,
        snapshot_references JSONB DEFAULT '[]'::jsonb,
        framework_version TEXT NOT NULL DEFAULT '1.0.0',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_research_notebooks_sec ON research_notebooks(security_id);`,

      // 6. Research Snapshots (Phase 13/14, Immutable Chain)
      `CREATE TABLE IF NOT EXISTS research_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        notebook_id TEXT NOT NULL,
        security_id TEXT NOT NULL,
        as_of_date TEXT NOT NULL,
        previous_snapshot_id TEXT,
        framework_version TEXT NOT NULL DEFAULT '1.0.0',
        evidence_ids JSONB DEFAULT '[]'::jsonb,
        claim_ids JSONB DEFAULT '[]'::jsonb,
        thesis TEXT,
        bull_case JSONB DEFAULT '[]'::jsonb,
        bear_case JSONB DEFAULT '[]'::jsonb,
        catalysts JSONB DEFAULT '[]'::jsonb,
        risks JSONB DEFAULT '[]'::jsonb,
        what_changed JSONB,
        contradictions JSONB DEFAULT '[]'::jsonb,
        evidence_gaps JSONB DEFAULT '[]'::jsonb,
        invalidation_conditions JSONB DEFAULT '[]'::jsonb,
        quantitative_context JSONB,
        portfolio_context JSONB,
        source_coverage JSONB,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_research_snapshots_sec_date ON research_snapshots(security_id, as_of_date);`,

      // 7. Investment Decisions (Phase 15, Immutable Artifacts)
      `CREATE TABLE IF NOT EXISTS investment_decisions (
        decision_id TEXT PRIMARY KEY,
        security_id TEXT NOT NULL,
        as_of_date TEXT NOT NULL,
        composite_score DOUBLE PRECISION NOT NULL,
        overall_assessment TEXT NOT NULL,
        conviction TEXT NOT NULL,
        dimension_assessments JSONB NOT NULL,
        invalidation_conditions JSONB DEFAULT '[]'::jsonb,
        portfolio_context JSONB,
        quant_context JSONB,
        backtest_context JSONB,
        explanation JSONB,
        weights_config JSONB,
        score_inputs JSONB,
        data_quality JSONB,
        limitations JSONB,
        is_analytical_only BOOLEAN NOT NULL DEFAULT TRUE,
        execution_prohibited BOOLEAN NOT NULL DEFAULT TRUE,
        framework_version TEXT NOT NULL DEFAULT '1.0.0',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_investment_decisions_sec_date ON investment_decisions(security_id, as_of_date);`,

      // 8. Strategies (Phase 11)
      `CREATE TABLE IF NOT EXISTS strategies (
        strategy_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        rules JSONB DEFAULT '[]'::jsonb,
        indicators JSONB DEFAULT '[]'::jsonb,
        position_sizing JSONB DEFAULT '{}'::jsonb,
        risk_constraints JSONB DEFAULT '[]'::jsonb,
        portfolio_construction JSONB DEFAULT '{}'::jsonb,
        parameters JSONB DEFAULT '{}'::jsonb,
        version TEXT NOT NULL DEFAULT '1.0.0',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,

      // 9. Backtest Results (Phase 12A/12B, Immutable Historical Artifacts)
      `CREATE TABLE IF NOT EXISTS backtests (
        backtest_id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        strategy_version TEXT NOT NULL DEFAULT '1.0.0',
        configuration JSONB NOT NULL,
        metrics JSONB NOT NULL,
        equity_curve JSONB DEFAULT '[]'::jsonb,
        trades JSONB DEFAULT '[]'::jsonb,
        accounting JSONB,
        benchmark JSONB,
        status TEXT NOT NULL,
        data_fingerprint TEXT,
        is_analytical_only BOOLEAN NOT NULL DEFAULT TRUE,
        execution_prohibited BOOLEAN NOT NULL DEFAULT TRUE,
        framework_version TEXT NOT NULL DEFAULT '1.0.0',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS idx_backtests_strategy ON backtests(strategy_id);`,

      // 10. Watchlists (Phase 10)
      `CREATE TABLE IF NOT EXISTS watchlists (
        watchlist_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        security_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,

      // 11. Alerts (Phase 10)
      `CREATE TABLE IF NOT EXISTS alerts (
        alert_id TEXT PRIMARY KEY,
        security_id TEXT,
        ticker TEXT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,

      // 12. Portfolio Raw Positions (Phase 9)
      `CREATE TABLE IF NOT EXISTS portfolio_positions (
        portfolio_id TEXT NOT NULL DEFAULT 'default',
        ticker TEXT NOT NULL,
        shares DOUBLE PRECISION NOT NULL,
        avg_cost DOUBLE PRECISION NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (portfolio_id, ticker)
      );`,

      // 13. Research Queries (Phase 7A)
      `CREATE TABLE IF NOT EXISTS research_queries (
        query_id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        intent TEXT,
        security_context JSONB DEFAULT '[]'::jsonb,
        as_of_date TEXT,
        retrieval_metadata JSONB DEFAULT '{}'::jsonb,
        evidence_references JSONB DEFAULT '[]'::jsonb,
        generated_answer TEXT,
        framework_version TEXT NOT NULL DEFAULT '1.0.0',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`
    ]
  }
];
