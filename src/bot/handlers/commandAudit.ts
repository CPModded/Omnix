import type { Client } from 'discord.js';
import { getCommands, loadCommands } from './commandHandler';

export interface CommandAuditResult {
  discovered: number;
  loaded: number;
  deployable: number;
  missing: string[];
  undeployable: string[];
  duplicates: string[];
}

export async function auditCommands(client: Client): Promise<CommandAuditResult> {
  await loadCommands(client);
  const commands = getCommands(client);
  const status = (client as any).omnixCommandLoadStatus || {};
  const missing = Array.isArray(status.missing) ? status.missing.map(String) : [];
  const names = new Map<string, string>();
  const duplicates: string[] = [];
  const undeployable: string[] = [];

  for (const [name, command] of commands) {
    const key = name.toLowerCase();
    if (names.has(key)) duplicates.push(name);
    names.set(key, name);
    if (!command?.data || typeof command.data.toJSON !== 'function') undeployable.push(name);
  }

  const result = {
    discovered: Number(status.discovered || 0),
    loaded: commands.size,
    deployable: commands.size - undeployable.length,
    missing,
    undeployable,
    duplicates,
  };

  console.log(`[CommandAudit] découvertes=${result.discovered} chargées=${result.loaded} déployables=${result.deployable}`);
  if (missing.length) console.warn(`[CommandAudit] non chargées: ${missing.join(', ')}`);
  if (undeployable.length) console.warn(`[CommandAudit] non déployables: ${undeployable.join(', ')}`);
  if (duplicates.length) console.warn(`[CommandAudit] doublons: ${duplicates.join(', ')}`);
  return result;
}
