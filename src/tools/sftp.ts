import path from 'node:path';
import { env } from '../config/env.js';

const MAX_READ_BYTES = 500_000;
const SECRET_NAME = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|id_rsa|id_ed25519|.*\.pem|.*\.key|secrets?\.(?:json|ya?ml)|credentials?(?:\..*)?)$/i;

export function normalizeRemotePath(input: string, root = env.sftp.root): string {
  const base = path.posix.resolve('/', String(root || '/home/container').replaceAll('\\', '/'));
  const requested = String(input || '.').replaceAll('\\', '/');
  if (requested.includes('\0')) throw new Error('Chemin SFTP invalide.');
  const target = path.posix.resolve(base, requested);
  if (target !== base && !target.startsWith(`${base}/`)) throw new Error('Chemin SFTP hors de SFTP_REMOTE_ROOT.');
  if (SECRET_NAME.test(target)) throw new Error('Accès refusé à un fichier potentiellement secret.');
  return target;
}

function config() {
  if (!env.sftp.enabled) throw new Error('Connecteur SFTP désactivé : configure les variables SFTP puis définis SFTP_ENABLED=true.');
  if (!env.sftp.host || !env.sftp.username || (!env.sftp.password && !env.sftp.privateKey)) {
    throw new Error('Configuration SFTP incomplète : renseigne SFTP_HOST, SFTP_USERNAME et SFTP_PASSWORD ou SFTP_PRIVATE_KEY.');
  }
  if (!Number.isInteger(env.sftp.port) || env.sftp.port < 1 || env.sftp.port > 65535) throw new Error('SFTP_PORT invalide.');
  return {
    host: env.sftp.host,
    port: env.sftp.port,
    username: env.sftp.username,
    ...(env.sftp.password ? { password: env.sftp.password } : {}),
    ...(env.sftp.privateKey ? { privateKey: env.sftp.privateKey.replaceAll('\\n', '\n') } : {}),
    readyTimeout: 15_000,
    retries: 1,
    retry_minTimeout: 1_000,
    retry_maxTimeout: 3_000,
  };
}

async function withSftp<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const Client = require('ssh2-sftp-client');
  const client = new Client('omnix-eternodes-sftp');
  try {
    await client.connect(config());
    return await callback(client);
  } catch (error: any) {
    const message = String(error?.message || 'erreur de connexion');
    if (/auth|permission denied/i.test(message)) throw new Error('SFTP_AUTH_REJECTED : authentification refusée. Vérifie l’identifiant et le mode d’authentification dans le panel Eternodes.');
    if (/timed? ?out|timeout/i.test(message)) throw new Error('SFTP_TIMEOUT : la connexion SFTP a dépassé le délai autorisé. Vérifie l’adresse, le port et l’accès réseau.');
    if (/ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(message)) throw new Error(`SFTP_NETWORK_ERROR : connexion impossible (${message.replace(/[^a-zA-Z0-9 .:_-]/g, '').slice(0, 180)}). Vérifie l’adresse et le port SFTP.`);
    throw new Error('SFTP_ERROR : opération refusée ou erreur du serveur SFTP (détail masqué).');
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function sftpStatus() {
  const configured = Boolean(env.sftp.host && env.sftp.username && (env.sftp.password || env.sftp.privateKey));
  return {
    enabled: env.sftp.enabled,
    configured,
    hostConfigured: Boolean(env.sftp.host),
    portConfigured: Number.isInteger(env.sftp.port) && env.sftp.port > 0 && env.sftp.port <= 65535,
    usernameConfigured: Boolean(env.sftp.username),
    authenticationConfigured: Boolean(env.sftp.password || env.sftp.privateKey),
    remoteRoot: env.sftp.root,
    message: !env.sftp.enabled ? 'Connecteur désactivé.' : configured ? 'Configuration présente ; la connectivité doit encore être testée.' : 'Variables SFTP incomplètes.',
  };
}

export async function testSftpConnection() {
  const root = normalizeRemotePath('.', env.sftp.root);
  const result = await withSftp(async client => {
    const entries = (await client.list(root)).filter((entry: any) => !SECRET_NAME.test(path.posix.join(root, String(entry.name))));
    return { entries: entries.length, sample: entries.slice(0, 30).map((entry: any) => ({ name: String(entry.name), type: entry.type === 'd' ? 'directory' : entry.type === '-' ? 'file' : 'other', size: Number(entry.size) || 0 })) };
  });
  return { ok: true, retrievedAt: new Date().toISOString(), root, ...result };
}

export async function listRemoteFiles(relative = '.', limit = 100) {
  const target = normalizeRemotePath(relative);
  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)));
  return withSftp(async client => {
    const entries = (await client.list(target)).filter((entry: any) => !SECRET_NAME.test(path.posix.join(target, String(entry.name))));
    return { path: target, count: Math.min(entries.length, safeLimit), truncated: entries.length > safeLimit, entries: entries.slice(0, safeLimit).map((entry: any) => ({ name: String(entry.name), type: entry.type === 'd' ? 'directory' : entry.type === '-' ? 'file' : 'other', size: Number(entry.size) || 0, modifiedAt: Number(entry.modifyTime) ? new Date(Number(entry.modifyTime)).toISOString() : null })) };
  });
}

export async function readRemoteFile(relative: string, maxBytes = MAX_READ_BYTES) {
  const target = normalizeRemotePath(relative);
  if (SECRET_NAME.test(target)) throw new Error('Accès refusé à un fichier potentiellement secret.');
  const limit = Math.max(1, Math.min(MAX_READ_BYTES, Math.floor(Number(maxBytes) || MAX_READ_BYTES)));
  return withSftp(async client => {
    const stat = await client.stat(target);
    if (!stat || stat.isDirectory === true || stat.type === 'd' || stat.isFile === false || (Number(stat.size) > limit)) throw new Error(`Lecture refusée : le chemin doit être un fichier de ${limit} octets maximum.`);
    const data = await client.get(target);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buffer.byteLength > limit) throw new Error(`Lecture refusée : fichier supérieur à ${limit} octets.`);
    const content = buffer.toString('utf8');
    return { path: target, bytes: buffer.byteLength, content: content.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[CLÉ PRIVÉE MASQUÉE]').replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]').replace(/((?:MAMMOUTH_API_KEY|OPENROUTER_API_KEY|DISCORD_TOKEN|DISCORD_BOT_TOKEN|BOT_TOKEN|PTERO_API_TOKEN|MCP_API_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY|JWT_SECRET|SMTP_PASSWORD|MYSQL_PASSWORD|MONGODB_URI|MONGO_URI|DATABASE_URL|MYSQL_URL|SFTP_PASSWORD|SFTP_PRIVATE_KEY)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]') };
  });
}
