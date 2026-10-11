import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { deployRestart } from './eternodes.js';

export function verifyGithubSignature(raw: Buffer, signature: string | undefined): boolean {
  if (!env.webhookSecret || !signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', env.webhookSecret).update(raw).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}
export async function deployFromMain(ref: string) {
  const expected = `refs/heads/${env.github.defaultBranch}`;
  if (ref !== expected) throw new Error('Ignored non-default branch push');
  return deployRestart();
}
