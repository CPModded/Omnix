-- OMNIX MySQL foundation for Eternodes.
-- Safe to run repeatedly. MongoDB remains untouched by this migration.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS omnix_documents (
  collection VARCHAR(190) NOT NULL,
  document_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, document_id)
) ENGINE=InnoDB;

CREATE INDEX idx_omnix_documents_collection ON omnix_documents (collection);

CREATE TABLE IF NOT EXISTS omnix_migration_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_database VARCHAR(255) NOT NULL,
  target_database VARCHAR(255) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'running',
  collections JSON NOT NULL,
  error TEXT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS omnix_guild_configs (
  guild_id VARCHAR(20) NOT NULL PRIMARY KEY,
  modules JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
