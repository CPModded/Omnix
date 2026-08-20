import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';
/* =========================================================
   TYPES
========================================================= */
export type AuditSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';
export type AuditStatus =
  | 'SUCCESS'
  | 'FAILURE';
export interface IAuditLog
  extends Document {
  createdAt: Date;
  actorId: string;
  actorTag?: string | null;
  ipAddress?: string | null;
  module: string;
  action: string;
  severity: AuditSeverity;
  serverId?: string | null;
  status: AuditStatus;
  errorMessage?: string | null;
  details?: {
    before?: unknown;
    after?: unknown;
    [key: string]: unknown;
  } | null;
}
/* =========================================================
   SCHEMA
========================================================= */
const AuditLogSchema =
  new Schema<IAuditLog>(
    {
      createdAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      actorId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },
      actorTag: {
        type: String,
        default: null,
        trim: true,
      },
      ipAddress: {
        type: String,
        default: null,
        trim: true,
      },
      module: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },
      action: {
        type: String,
        required: true,
        trim: true,
      },
      severity: {
        type: String,
        enum: [
          'INFO',
          'WARNING',
          'ERROR',
          'CRITICAL',
        ],
        default: 'INFO',
        index: true,
      },
      serverId: {
        type: String,
        default: null,
        index: true,
        trim: true,
      },
      status: {
        type: String,
        enum: [
          'SUCCESS',
          'FAILURE',
        ],
        required: true,
        index: true,
      },
      errorMessage: {
        type: String,
        default: null,
      },
      details: {
        type: Schema.Types.Mixed,
        default: null,
      },
    },
    {
      collection: 'audit_logs',
      versionKey: false,
      minimize: false,
    }
  );
/* =========================================================
   INDEXES
========================================================= */
/*
 * On utilise schema.index() ici pour les index composés.
 *
 * Les index simples sont déjà déclarés avec `index: true`
 * dans les champs ci-dessus.
 *
 * Cela évite les Duplicate schema index warnings.
 */
AuditLogSchema.index({
  createdAt: -1,
  severity: 1,
});
AuditLogSchema.index({
  actorId: 1,
  createdAt: -1,
});
AuditLogSchema.index({
  serverId: 1,
  createdAt: -1,
});
AuditLogSchema.index({
  module: 1,
  action: 1,
  createdAt: -1,
});
/* =========================================================
   MODEL
========================================================= */
const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ??
  mongoose.model<IAuditLog>(
    'AuditLog',
    AuditLogSchema
  );
export { AuditLog };
export default AuditLog;