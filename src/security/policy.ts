import path from 'node:path';
import { env } from '../config/env.js';

const BLOCKED = [
  /^\.env(?:\..*)?$/i, /(^|\/)\.env(?:\..*)?$/i, /(^|\/)(secrets?|credentials?|private)(\/|$)/i,
  /\.(?:pem|key|p12|pfx|crt|cer)$/i, /(^|\/)node_modules(\/|$)/, /(^|\/)\.git(\/|$)/
];
const WRITE_BLOCKED = [/package-lock\.json$/i, /pnpm-lock\.yaml$/i, /yarn\.lock$/i];

export function safePath(relative: string, write = false): string {
  const normalized = relative.replaceAll('\\', '/').replace(/^\/+/, '');
  if (normalized === '' || normalized === '.') return path.resolve(env.root);
  if (normalized.includes('..')) throw new Error('Invalid project path');
  if (BLOCKED.some(r => r.test(normalized))) throw new Error('Protected path');
  if (write && WRITE_BLOCKED.some(r => r.test(normalized))) throw new Error('Lockfile writes are blocked');
  const absolute = path.resolve(env.root, normalized);
  const root = path.resolve(env.root) + path.sep;
  if (absolute !== path.resolve(env.root) && !absolute.startsWith(root)) throw new Error('Path escapes OMNIX_ROOT');
  return absolute;
}

export function assertDeveloper(apiKey: string | undefined): void {
  if (!env.apiKey || !apiKey || apiKey !== env.apiKey) throw new Error('Developer authentication required');
}

export function assertBranchWritable(branch: string): void {
  if (branch === env.github.defaultBranch && !env.github.allowMainWrite) throw new Error('Direct writes to the default branch are disabled');
}
