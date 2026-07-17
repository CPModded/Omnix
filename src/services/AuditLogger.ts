// Si vous utilisez Mongoose :
import AuditLog from '../models/AuditLog';

// Si vous utilisez le driver natif MongoDB (décommentez ci-dessous et commentez l'import Mongoose) :
// import { db } from '../database'; // Importez votre instance de connexion MongoDB

interface LogOptions {
  actorId: string;
  actorTag?: string;
  ipAddress?: string;
  module: string;
  action: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  serverId?: string;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  details?: {
    before?: any;
    after?: any;
  };
}

export async function logAuditEvent(options: LogOptions) {
  try {
    const logData = {
      createdAt: new Date(),
      actorId: options.actorId,
      actorTag: options.actorTag || null,
      ipAddress: options.ipAddress || null,
      module: options.module,
      action: options.action,
      severity: options.severity || 'INFO',
      serverId: options.serverId || null,
      status: options.status,
      errorMessage: options.errorMessage || null,
      details: options.details || null
    };

    // VERSION MONGOOSE :
    const log = new AuditLog(logData);
    await log.save();
    return log;

    // VERSION DRIVER NATIF (décommentez si nécessaire) :
    // await db.collection('audit_logs').insertOne(logData);
    
  } catch (error) {
    console.error('[AuditLogger Error] Impossible de sauvegarder le log:', error);
  }
}