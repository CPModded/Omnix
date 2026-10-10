import { client } from '../bot/client';
import { auditCommands } from '../bot/handlers/commandAudit';

(async () => {
  const result = await auditCommands(client);
  process.exitCode = result.missing.length || result.undeployable.length || result.duplicates.length ? 1 : 0;
})().catch((error) => {
  console.error('[CommandAudit] Échec :', error);
  process.exitCode = 1;
});
