"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.mysqlEnabled = void 0;
exports.query = query;
exports.withTransaction = withTransaction;
exports.ensureGuildModulesSchema = ensureGuildModulesSchema;
exports.getGuildModules = getGuildModules;
exports.saveGuildModules = saveGuildModules;
exports.checkMySQL = checkMySQL;
const promise_1 = __importDefault(require("mysql2/promise"));
const mysql_url_js_1 = require("./mysql-url.js");
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
function parseEndpoint(raw) {
    if (!raw)
        return {};
    let value = raw.trim();
    if (!value)
        return {};
    value = value.replace(/^jdbc:/i, '');
    // Accept host:port, URL forms and JDBC URLs from hosting panels.
    try {
        const url = new URL(value.includes('://') ? value : `mysql://${value}`);
        const host = url.hostname;
        if (!host || (0, mysql_url_js_1.isMysqlPlaceholderHost)(host))
            return {};
        return { host, port: Number(url.port || 3306) };
    }
    catch {
        const match = value.match(/^([^:]+)(?::(\d+))?$/);
        return {
            host: match?.[1],
            port: Number(match?.[2] || 3306),
        };
    }
}
const endpoint = parseEndpoint(process.env.MYSQL_HOST || process.env.MYSQL_ENDPOINT || process.env.DB_HOST || process.env.ENDPOINT);
const explicitMysqlConfig = Boolean(endpoint.host);
exports.mysqlEnabled = explicitMysqlConfig || Boolean(connectionString);
function createMySQLPool() {
    if (explicitMysqlConfig) {
        return promise_1.default.createPool({
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
    if (!connectionString)
        return null;
    let url;
    try {
        url = new URL((0, mysql_url_js_1.normalizeMysqlConnectionString)(connectionString));
    }
    catch {
        console.warn('[MySQL] ⚠ URL de connexion invalide : vérifie DATABASE_URL/MYSQL_URL sans afficher le mot de passe.');
        return null;
    }
    if (!url.hostname || (0, mysql_url_js_1.isMysqlPlaceholderHost)(url.hostname)) {
        console.warn('[MySQL] ⚠ Hôte MySQL de modèle détecté (ex. HOST) : connexion désactivée. Renseigne MYSQL_HOST avec l’ENDPOINT réel d’Eternodes ou corrige DATABASE_URL/MYSQL_URL.');
        return null;
    }
    const database = url.pathname.replace(/^\//, '');
    return promise_1.default.createPool({
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
exports.pool = createMySQLPool();
// Initialisation non bloquante : le premier accès aux modules appellera aussi
// ensureGuildModulesSchema(), mais cette tentative permet de détecter tôt une
// mauvaise connexion MySQL dans les logs sans empêcher Omnix de démarrer.
if (exports.pool) {
    void exports.pool.query('SELECT 1').then(() => {
        console.log('[MySQL] ✓ Connexion disponible.');
    }).catch((error) => {
        console.warn('[MySQL] ⚠ Connexion indisponible au démarrage:', error?.message || error);
    });
}
async function query(sql, params = []) {
    if (!exports.pool)
        throw new Error('Configuration MySQL absente (MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE ou DATABASE_URL/MYSQL_URL).');
    const [rows] = await exports.pool.query(sql, params);
    return rows;
}
async function withTransaction(fn) {
    if (!exports.pool)
        throw new Error('Configuration MySQL absente (MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE ou DATABASE_URL/MYSQL_URL).');
    const connection = await exports.pool.getConnection();
    try {
        await connection.beginTransaction();
        const value = await fn(connection);
        await connection.commit();
        return value;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
let guildModulesSchemaReady = null;
/** Ensure the SQL table used for durable per-guild module state exists. */
async function ensureGuildModulesSchema() {
    if (!exports.pool)
        return;
    if (!guildModulesSchemaReady) {
        guildModulesSchemaReady = exports.pool.query(`
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
async function getGuildModules(guildId) {
    if (!exports.pool)
        return null;
    try {
        await ensureGuildModulesSchema();
        const rows = await query('SELECT modules FROM omnix_guild_configs WHERE guild_id = ? LIMIT 1', [guildId]);
        const value = rows[0]?.modules;
        if (!value)
            return null;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return null;
            }
        }
        return value;
    }
    catch (error) {
        console.warn('[MySQL] Lecture modules impossible:', error?.message || error);
        return null;
    }
}
async function saveGuildModules(guildId, modules) {
    if (!exports.pool)
        return false;
    if (!/^\d{17,20}$/.test(String(guildId)))
        return false;
    try {
        await ensureGuildModulesSchema();
        const serialized = JSON.stringify(modules ?? {});
        await query(`INSERT INTO omnix_guild_configs (guild_id, modules)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         modules = VALUES(modules),
         updated_at = CURRENT_TIMESTAMP`, [guildId, serialized]);
        // Vérification immédiate : on refuse de considérer l'écriture comme réussie
        // si MySQL ne restitue pas la donnée que nous venons d'enregistrer.
        const stored = await getGuildModules(guildId);
        return Boolean(stored && JSON.stringify(stored) === JSON.stringify(modules));
    }
    catch (error) {
        console.error('[MySQL] Écriture modules impossible:', error?.message || error);
        return false;
    }
}
async function checkMySQL() {
    if (!exports.pool)
        return { connected: false, error: 'DATABASE_URL/MYSQL_URL absent' };
    try {
        const rows = await query('SELECT VERSION() AS version');
        return { connected: true, version: rows[0]?.version };
    }
    catch (error) {
        return { connected: false, error: error?.message || String(error) };
    }
}
if (process.argv.includes('--status')) {
    checkMySQL().then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = result.connected ? 0 : 1;
    });
}
