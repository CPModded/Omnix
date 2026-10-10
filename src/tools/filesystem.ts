import fs from 'node:fs/promises';
import path from 'node:path';
import { safePath } from '../security/policy.js';
import { env } from '../config/env.js';

export async function listFiles(relative = '.', depth = 2): Promise<string[]> {
  const root = safePath(relative);
  const out: string[] = [];
  async function walk(dir: string, d: number) {
    if (d < 0) return;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = path.relative(env.root, path.join(dir, entry.name)).replaceAll('\\','/');
      try { safePath(rel); } catch { continue; }
      out.push(rel);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), d - 1);
    }
  }
  await walk(root, depth); return out;
}
export async function readFile(relative: string, maxBytes = 500_000): Promise<string> {
  const data = await fs.readFile(safePath(relative));
  if (data.byteLength > maxBytes) throw new Error('File exceeds read limit');
  return data.toString('utf8');
}
export async function writeFile(relative: string, content: string): Promise<void> {
  const target = safePath(relative, true);
  if (Buffer.byteLength(content, 'utf8') > 1_000_000) throw new Error('File exceeds write limit');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}
export async function deleteFile(relative: string): Promise<void> { await fs.rm(safePath(relative, true), { force: true }); }
