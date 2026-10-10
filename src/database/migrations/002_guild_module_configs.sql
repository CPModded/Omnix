-- OMNIX — Durable guild module state on MySQL/Eternodes.
-- MySQL stores the dashboard module configuration during the MongoDB migration.

CREATE TABLE IF NOT EXISTS omnix_guild_configs (
  guild_id VARCHAR(20) NOT NULL PRIMARY KEY,
  modules JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
