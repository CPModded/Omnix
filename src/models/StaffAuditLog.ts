import mongoose, {
  Document,
  Model,
  Schema
} from "mongoose";
/* =========================================================
   TYPES
========================================================= */
export type StaffAuditAction =
  | "create"
  | "update"
  | "delete"
  | "enable"
  | "disable"
  | "login"
  | "logout"
  | "grant"
  | "revoke"
  | "refund"
  | "cancel"
  | "restore"
  | "backup"
  | "manual"
  | "system";
export type StaffAuditCategory =
  | "pricing"
  | "payment"
  | "subscription"
  | "user"
  | "guild"
  | "ai"
  | "system"
  | "authentication"
  | "configuration"
  | "staff";
export type StaffAuditStatus =
  | "success"
  | "failed"
  | "warning";
/* =========================================================
   INTERFACE
========================================================= */
export interface IStaffAuditLog extends Document {
  /* -------------------------------------------------------
     STAFF
  ------------------------------------------------------- */
  staffId: string;
  staffUsername?: string;
  staffTag?: string;
  /* -------------------------------------------------------
     ACTION
  ------------------------------------------------------- */
  action: StaffAuditAction;
  category: StaffAuditCategory;
  status: StaffAuditStatus;
  description: string;
  /* -------------------------------------------------------
     CIBLE
  ------------------------------------------------------- */
  targetType?: string;
  targetId?: string;
  targetName?: string;
  /* -------------------------------------------------------
     CONTEXTE DISCORD
  ------------------------------------------------------- */
  guildId?: string;
  guildName?: string;
  ownerId?: string;
  /* -------------------------------------------------------
     AVANT / APRÈS
  ------------------------------------------------------- */
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  /* -------------------------------------------------------
     REQUÊTE / CLIENT
  ------------------------------------------------------- */
  ipHash?: string;
  userAgent?: string;
  method?: string;
  route?: string;
  /* -------------------------------------------------------
     ERREUR
  ------------------------------------------------------- */
  error?: string;
  errorCode?: string;
  /* -------------------------------------------------------
     MÉTADONNÉES
  ------------------------------------------------------- */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
/* =========================================================
   SCHEMA
========================================================= */
const StaffAuditLogSchema =
  new Schema<IStaffAuditLog>(
    {
      /* -----------------------------------------------------
         STAFF
      ----------------------------------------------------- */
      staffId: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 100
      },
      staffUsername: {
        type: String,
        trim: true,
        maxlength: 200
      },
      staffTag: {
        type: String,
        trim: true,
        maxlength: 200
      },
      /* -----------------------------------------------------
         ACTION
      ----------------------------------------------------- */
      action: {
        type: String,
        enum: [
          "create",
          "update",
          "delete",
          "enable",
          "disable",
          "login",
          "logout",
          "grant",
          "revoke",
          "refund",
          "cancel",
          "restore",
          "backup",
          "manual",
          "system"
        ],
        required: true,
        index: true
      },
      category: {
        type: String,
        enum: [
          "pricing",
          "payment",
          "subscription",
          "user",
          "guild",
          "ai",
          "system",
          "authentication",
          "configuration",
          "staff"
        ],
        required: true,
        index: true
      },
      status: {
        type: String,
        enum: [
          "success",
          "failed",
          "warning"
        ],
        default: "success",
        index: true
      },
      description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
      },
      /* -----------------------------------------------------
         CIBLE
      ----------------------------------------------------- */
      targetType: {
        type: String,
        trim: true,
        maxlength: 100,
        index: true
      },
      targetId: {
        type: String,
        trim: true,
        maxlength: 255,
        index: true
      },
      targetName: {
        type: String,
        trim: true,
        maxlength: 500
      },
      /* -----------------------------------------------------
         GUILD
      ----------------------------------------------------- */
      guildId: {
        type: String,
        trim: true,
        maxlength: 100,
        index: true
      },
      guildName: {
        type: String,
        trim: true,
        maxlength: 200
      },
      ownerId: {
        type: String,
        trim: true,
        maxlength: 100,
        index: true
      },
      /* -----------------------------------------------------
         AVANT / APRÈS
      ----------------------------------------------------- */
      previousValue: {
        type: Schema.Types.Mixed,
        default: undefined
      },
      newValue: {
        type: Schema.Types.Mixed,
        default: undefined
      },
      /* -----------------------------------------------------
         CLIENT
      ----------------------------------------------------- */
      ipHash: {
        type: String,
        trim: true,
        maxlength: 255
      },
      userAgent: {
        type: String,
        maxlength: 1000
      },
      method: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 20
      },
      route: {
        type: String,
        trim: true,
        maxlength: 500
      },
      /* -----------------------------------------------------
         ERREUR
      ----------------------------------------------------- */
      error: {
        type: String,
        maxlength: 10000
      },
      errorCode: {
        type: String,
        maxlength: 255,
        index: true
      },
      /* -----------------------------------------------------
         METADATA
      ----------------------------------------------------- */
      metadata: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    {
      timestamps: true,
      versionKey: false
    }
  );
/* =========================================================
   INDEX
========================================================= */
/**
 * Journal Staff chronologique.
 */
StaffAuditLogSchema.index({
  createdAt: -1
});
/**
 * Historique d'un membre du Staff.
 */
StaffAuditLogSchema.index({
  staffId: 1,
  createdAt: -1
});
/**
 * Historique d'une cible.
 */
StaffAuditLogSchema.index({
  targetType: 1,
  targetId: 1,
  createdAt: -1
});
/**
 * Historique d'un serveur.
 */
StaffAuditLogSchema.index({
  guildId: 1,
  createdAt: -1
});
/**
 * Historique d'un owner.
 */
StaffAuditLogSchema.index({
  ownerId: 1,
  createdAt: -1
});
/**
 * Statistiques par catégorie.
 */
StaffAuditLogSchema.index({
  category: 1,
  status: 1,
  createdAt: -1
});
/* =========================================================
   MODEL
========================================================= */
const StaffAuditLog: Model<IStaffAuditLog> =
  mongoose.models.StaffAuditLog ||
  mongoose.model<IStaffAuditLog>(
    "StaffAuditLog",
    StaffAuditLogSchema
  );
export default StaffAuditLog;