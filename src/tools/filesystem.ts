import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { safePath } from '../security/policy.js';
import { env } from '../config/env.js';

const BACKUP_DIR = '.omnix-agent-backups';
const MAX_READ_BYTES = 500_000;
const MAX_WRITE_BYTES = 1_000_000;

async function backupExistingFile(target: string, relative: string): Promise<string | null> {
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Seuls les fichiers ordinaires peuvent être modifiés ou supprimés par l’agent.');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const relativeSafe = relative.replaceAll('\\', '/').replace(/^\/+/, '').split('/').map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_')).join('__');
    const backupRoot = path.join(path.resolve(env.root), BACKUP_DIR);
    await fs.mkdir(backupRoot, { recursive: true, mode: 0o700 });
    const backup = path.join(backupRoot, `${stamp}-${process.pid}-${Math.random().toString(36).slice(2, 8)}__${relativeSafe}`);
    await fs.copyFile(target, backup, constants.COPYFILE_EXCL);
    return path.relative(path.resolve(env.root), backup).replaceAll('\\', '/');
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function listFiles(relative = '.', depth = 2): Promise<string[]> {
  const root = safePath(relative);
  const out: string[] = [];
  const maxDepth = Math.max(0, Math.min(5, Number(depth) || 0));
  async function walk(dir: string, d: number) {
    if (d < 0) return;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === BACKUP_DIR) continue;
      const rel = path.relative(env.root, path.join(dir, entry.name)).replaceAll('\\', '/');
      try { safePath(rel); } catch { continue; }
      out.push(rel);
      if (entry.isDirectory() && !entry.isSymbolicLink()) await walk(path.join(dir, entry.name), d - 1);
    }
  }
  await walk(root, maxDepth);
  return out.slice(0, 5_000);
}

export async function readFile(relative: string, maxBytes = MAX_READ_BYTES): Promise<string> {
  const target = safePath(relative);
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Seuls les fichiers ordinaires peuvent être lus.');
  const data = await fs.readFile(target);
  if (data.byteLength > maxBytes) throw new Error('File exceeds read limit');
  return data.toString('utf8');
}

export async function writeFile(relative: string, content: string): Promise<{ bytes: number; backup: string | null }> {
  const target = safePath(relative, true);
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_WRITE_BYTES) throw new Error('File exceeds write limit');
  const backup = await backupExistingFile(target, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.omnix-tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return { bytes, backup };
}

export async function deleteFile(relative: string): Promise<{ backup: string }> {
  const target = safePath(relative, true);
  const backup = await backupExistingFile(target, relative);
  if (!backup) throw new Error('Fichier introuvable ; aucune suppression effectuée.');
  await fs.rm(target, { force: false });
  return { backup };
}

/** Reads recent .log files from the project's known log folders, never recursively scanning the whole project. */
export async function recentProjectLogs(maxLines = 150): Promise<{ source: string; retrievedAt: string; files: Array<{ path: string; lines: string[] }> }> {
  const limit = Math.max(20, Math.min(300, Math.floor(Number(maxLines) || 150)));
  const root = path.resolve(env.root);
  const candidates = [path.join(root, 'logs'), path.join(root, 'log')];
  const found: Array<{ path: string; lines: string[]; mtime: number }> = [];
  const redact = (line: string) => line
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/ig, '$1[MASQUÉ]')
    .replace(/((?:MAMMOUTH_API_KEY|DISCORD_TOKEN|BOT_TOKEN|PTERO_API_TOKEN|MCP_API_KEY|MYSQL_PASSWORD|SFTP_PASSWORD|SFTP_PRIVATE_KEY|MONGODB_URI)\s*[:=]\s*)[^\s,;"']+/ig, '$1[MASQUÉ]')
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[CLÉ API MASQUÉE]');
  for (const folder of candidates) {
    try {
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        if (!entry.isFile() || !/\.(?:log|out|err)$/i.test(entry.name)) continue;
        const full = path.join(folder, entry.name);
        const stat = await fs.stat(full);
        if (stat.size > 2_000_000) continue;
        const content = await fs.readFile(full, 'utf8');
        found.push({ path: path.relative(root, full).replaceAll('\\', '/'), lines: content.split(/\r?\n/).filter(Boolean).slice(-limit).map(redact), mtime: stat.mtimeMs });
      }
    } catch { /* log folder may not exist on this host */ }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return { source: 'fichiers de logs locaux du projet', retrievedAt: new Date().toISOString(), files: found.slice(0, 10).map(({ path: filePath, lines }) => ({ path: filePath, lines })) };
}
