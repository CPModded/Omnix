import { Schema, model, Document } from 'mongoose';

export interface IAuditLog extends Document {
  guildId: string | null;     // null pour les actions d'administration globale
  userId: string;
  username: string;
  action: string;             // ex: 'connexion_dashboard', 'ajout_bot', 'achat_premium'
  category: 'user' | 'guild' | 'bot' | 'payment' | 'license' | 'marketplace' | 'security' | 'dashboard' | 'ai' | 'admin';
  details: string;            // Détails textuels ou JSON de modification
  ipAddress: string | null;
  status: 'success' | 'failure';
  level: 'info' | 'warning' | 'error' | 'critical';
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  guildId: { type: String, default: null, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  action: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  details: { type: String, default: '' },
  ipAddress: { type: String, default: null },
  status: { type: String, enum: ['success', 'failure'], default: 'success' },
  level: { type: String, enum: ['info', 'warning', 'error', 'critical'], default: 'info' }
}, { timestamps: true });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);