import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  createdAt: Date;
  actorId: string;
  actorTag?: string;
  ipAddress?: string;
  module: string;
  action: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  serverId?: string;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  details?: any; // Contient l'objet { before: {...}, after: {...} }
}

const AuditLogSchema: Schema = new Schema({
  createdAt: { type: Date, default: Date.now, index: true },
  actorId: { type: String, required: true, index: true },
  actorTag: { type: String },
  ipAddress: { type: String },
  module: { type: String, required: true, index: true },
  action: { type: String, required: true },
  severity: { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'], default: 'INFO' },
  serverId: { type: String, index: true },
  status: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
  errorMessage: { type: String },
  details: { type: Schema.Types.Mixed } // Stocke n'importe quel objet JSON de manière flexible
});

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);