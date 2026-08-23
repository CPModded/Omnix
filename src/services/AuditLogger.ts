import AuditLog from '../models/AuditLog.ts';
export type AuditSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';
export type AuditStatus =
  | 'SUCCESS'
  | 'FAILURE';
export interface AuditLogOptions {
  actorId: string;
  actorTag?: string;
  ipAddress?: string;
  module: string;
  action: string;
  severity?: AuditSeverity;
  serverId?: string;
  status: AuditStatus;
  errorMessage?: string;
  details?: {
    before?: unknown;
    after?: unknown;
    [key: string]: unknown;
  };
}
/**
 * Enregistre une action dans l'Audit Center.
 *
 * Important :
 * Une erreur de logging ne doit jamais empêcher
 * l'exécution de l'action principale.
 */
export async function logAuditEvent(
  options: AuditLogOptions
) {
  try {
    const logData = {
      createdAt: new Date(),
      actorId: options.actorId,
      actorTag:
        options.actorTag ?? null,
      ipAddress:
        options.ipAddress ?? null,
      module:
        options.module,
      action:
        options.action,
      severity:
        options.severity ?? 'INFO',
      serverId:
        options.serverId ?? null,
      status:
        options.status,
      errorMessage:
        options.errorMessage ?? null,
      details:
        options.details ?? null,
    };
    const log =
      new AuditLog(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error(
      '[AuditLogger] Impossible de sauvegarder le log :',
      error
    );
    return null;
  }
}
export default logAuditEvent;