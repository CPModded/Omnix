import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { normalizeMysqlConnectionString } from './mysql-url.js';

/**
 * MySQL Eternodes is the durable SQL store used during the Omnix migration.
 * DATABASE_URL is kept as the primary variable so Render needs only one value.
 * MYSQL_URL is accepted as an explicit alternative.
 */
const connectionString = process.env.DATABASE_URL || process.env.MYSQL_URL;


/**
 * Eternodes exposes the SQL connection as separate fields (ENDPOINT,
 * USERNAME, PASSWORD) while older Omnix deployments use DATABASE_URL.
 * Explicit MYSQL_* fields take precedence so a stale DATABASE_URL cannot
 * silently force the bot to connect to a placeholder such as "HOST".
 */
function parseEndpoint(raw: string | undefined): { host?: string; port?: number } {
  if (!raw) return {};
  let value = raw.trim();
  if (!value) return {};
  value = value.replace(/^jdbc:/i, '');

  // Accept host:port, URL forms and JDBC URLs from hosting panels.
  try {
    const url = new URL(value.includes('://') ? value : `mysql://${value}`);
    const host = url.hostname;
    if (!host || /^(HOST|HOTE|EXAMPLE|YOUR_HOST)$/i.test(host)) return {};
    return { host, port: Number(url.port || 3306) };
  } catch {
    const match = value.match(/^([^:]+)(?::(\d+))?$/);
    return {
      host: match?.[1],
      port: Number(match?.[2] || 3306),
    };
  }
}

const endpoint = parseEndpoint(
  process.env.MYSQL_HOST || process.env.MYSQL_ENDPOINT || process.env.DB_HOST || process.env.ENDPOINT,
);
const explicitMysqlConfig = Boolean(endpoint.host);

export const mysqlEnabled = explicitMysqlConfig || Boolean(connectionString);

function createMySQLPool(): Pool | null {
  if (explicitMysqlConfig) {
    return mysql.createPool({
      host: endpoint.host,
      port: Number(process.env.MYSQL_PORT || endpoint.port || 3306),
      user: process.env.MYSQL_USER || process.env.DB_USER || process.env.USERNAME || '',
      password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || process.env.PASSWORD || '',
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.MYSQL_DB || '',
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_POOL_MAX || 10),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  if (!connectionString) return null;

  const normalizedConnectionString = normalizeMysqlConnectionString(connectionString);
  const url = new URL(normalizedConnectionString);
  const database = url.pathname.replace(/^\//, '');

  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: database ? decodeURIComponent(database) : undefined,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_MAX || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

export const pool: Pool | null = createMySQLPool();

// Initialisation non bloquante : le premier accès aux modules appellera aussi
// ensureGuildModulesSchema(), mais cette tentative permet de détecter tôt une
// mauvaise connexion MySQL dans les logs sans empêcher Omnix de démarrer.
if (pool) {
  void pool.query('SELECT 1').then(() => {
    console.log('[MySQL] ✓ Connexion disponible.');
  }).catch((error: any) => {
    console.warn('[MySQL] ⚠ Connexion indisponible au démarrage:', error?.message || error);
  });
}

export async function query<T extends RowDataPacket[] | any[] = any[]>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  if (!pool) throw new Error('Configuration MySQL absente (MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE ou DATABASE_URL/MYSQL_URL).');
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

export async function withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('Configuration MySQL absente (MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE ou DATABASE_URL/MYSQL_URL).');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const value = await fn(connection);
    await connection.commit();
    return value;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

let guildModulesSchemaReady: Promise<void> | null = null;

/** Ensure the SQL table used for durable per-guild module state exists. */
export async function ensureGuildModulesSchema(): Promise<void> {
  if (!pool) return;
  if (!guildModulesSchemaReady) {
    guildModulesSchemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS omnix_guild_configs (
        guild_id VARCHAR(20) NOT NULL PRIMARY KEY,
        modules JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `).then(() => undefined).catch((error) => {
      guildModulesSchemaReady = null;
      throw error;
    });
  }
  await guildModulesSchemaReady;
}

export async function getGuildModules(guildId: string): Promise<Record<string, any> | null> {
  if (!pool) return null;
  try {
    await ensureGuildModulesSchema();
    const rows = await query<any[]>(
      'SELECT modules FROM omnix_guild_configs WHERE guild_id = ? LIMIT 1',
      [guildId],
    );
    const value = rows[0]?.modules;
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value as Record<string, any>;
  } catch (error: any) {
    console.warn('[MySQL] Lecture modules impossible:', error?.message || error);
    return null;
  }
}

export async function saveGuildModules(guildId: string, modules: Record<string, any>): Promise<boolean> {
  if (!pool) return false;
  if (!/^\d{17,20}$/.test(String(guildId))) return false;
  try {
    await ensureGuildModulesSchema();
    const serialized = JSON.stringify(modules ?? {});
    await query(
      `INSERT INTO omnix_guild_configs (guild_id, modules)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         modules = VALUES(modules),
         updated_at = CURRENT_TIMESTAMP`,
      [guildId, serialized],
    );

    // Vérification immédiate : on refuse de considérer l'écriture comme réussie
    // si MySQL ne restitue pas la donnée que nous venons d'enregistrer.
    const stored = await getGuildModules(guildId);
    return Boolean(stored && JSON.stringify(stored) === JSON.stringify(modules));
  } catch (error: any) {
    console.error('[MySQL] Écriture modules impossible:', error?.message || error);
    return false;
  }
}

export async function checkMySQL(): Promise<{ connected: boolean; version?: string; error?: string }> {
  if (!pool) return { connected: false, error: 'DATABASE_URL/MYSQL_URL absent' };
  try {
    const rows = await query<any[]>('SELECT VERSION() AS version');
    return { connected: true, version: rows[0]?.version };
  } catch (error: any) {
    return { connected: false, error: error?.message || String(error) };
  }
}

if (process.argv.includes('--status')) {
  checkMySQL().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.connected ? 0 : 1;
  });
}
