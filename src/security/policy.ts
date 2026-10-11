import path from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { env } from '../config/env.js';

const BLOCKED = [
  /^\.env(?:\..*)?$/i, /(^|\/)\.env(?:\..*)?$/i, /(^|\/)(secrets?|credentials?|private)(\/|$)/i,
  /\.(?:pem|key|p12|pfx|crt|cer)$/i, /(^|\/)node_modules(\/|$)/, /(^|\/)\.git(\/|$)/, /(^|\/)\.omnix-agent-backups(\/|$)/
];
const WRITE_BLOCKED = [/package\.json$/i, /package-lock\.json$/i, /pnpm-lock\.yaml$/i, /yarn\.lock$/i, /(^|\/)\.npmrc$/i];

export function safePath(relative: string, write = false): string {
  const normalized = relative.replaceAll('\\', '/').replace(/^\/+/, '');
  if (normalized === '' || normalized === '.') return path.resolve(env.root);
  if (normalized.includes('..')) throw new Error('Invalid project path');
  if (BLOCKED.some(r => r.test(normalized))) throw new Error('Protected path');
  if (write && WRITE_BLOCKED.some(r => r.test(normalized))) throw new Error('Writes to package manifests, npm configuration and lockfiles are blocked');
  const rootPath = path.resolve(env.root);
  const absolute = path.resolve(rootPath, normalized);
  const rootBoundary = rootPath + path.sep;
  if (absolute !== rootPath && !absolute.startsWith(rootBoundary)) throw new Error('Path escapes OMNIX_ROOT');

  // Prevent a symlink inside the project from redirecting reads/writes outside OMNIX_ROOT.
  const realRoot = realpathSync(rootPath);
  let probe = absolute;
  while (!existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) throw new Error('Invalid project path');
    probe = parent;
  }
  const realProbe = realpathSync(probe);
  if (realProbe !== realRoot && !realProbe.startsWith(realRoot + path.sep)) throw new Error('Path resolves outside OMNIX_ROOT');
  if (existsSync(absolute)) {
    const realTarget = realpathSync(absolute);
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) throw new Error('Path resolves outside OMNIX_ROOT');
  }
  return absolute;
}

export function assertDeveloper(apiKey: string | undefined): void {
  if (!env.apiKey || !apiKey || apiKey !== env.apiKey) throw new Error('Developer authentication required');
}

export function assertBranchWritable(branch: string): void {
  if (branch === env.github.defaultBranch && !env.github.allowMainWrite) throw new Error('Direct writes to the default branch are disabled');
}
