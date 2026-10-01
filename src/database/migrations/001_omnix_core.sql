-- OMNIX PostgreSQL foundation
-- Safe to run repeatedly. MongoDB remains untouched by this migration.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS omnix_documents (
  collection TEXT NOT NULL,
  document_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, document_id)
);

CREATE INDEX IF NOT EXISTS idx_omnix_documents_collection
  ON omnix_documents (collection);

CREATE INDEX IF NOT EXISTS idx_omnix_documents_data_gin
  ON omnix_documents USING GIN (data);

CREATE TABLE IF NOT EXISTS omnix_migration_runs (
  id BIGSERIAL PRIMARY KEY,
  source_database TEXT NOT NULL,
  target_database TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  collections JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT
);
