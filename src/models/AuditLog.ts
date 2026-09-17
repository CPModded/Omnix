import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   OMNIX — AUDIT LOG MODEL
========================================================= */

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

/* =========================================================
   DETAILS
========================================================= */

export interface IAuditLogDetails {
  before?: unknown;
  after?: unknown;

  [key: string]: unknown;
}

/* =========================================================
   DOCUMENT
========================================================= */

export interface IAuditLog
  extends Document {
  /*
   * =======================================================
   * TIMESTAMP
   * =======================================================
   *
   * Un AuditLog est immuable.
   * On ne génère donc volontairement PAS updatedAt.
   */

  createdAt: Date;

  /*
   * =======================================================
   * ACTOR
   * =======================================================
   */

  actorId: string;

  actorTag?: string | null;

  ipAddress?: string | null;

  /*
   * =======================================================
   * ACTION
   * =======================================================
   */

  module: string;

  action: string;

  /*
   * =======================================================
   * SEVERITY
   * =======================================================
   */

  severity: AuditSeverity;

  /*
   * =======================================================
   * SERVER
   * =======================================================
   *
   * null = action globale OMNIX.
   */

  serverId?: string | null;

  /*
   * =======================================================
   * RESULT
   * =======================================================
   */

  status: AuditStatus;

  /*
   * =======================================================
   * ERROR
   * =======================================================
   */

  errorMessage?: string | null;

  /*
   * =======================================================
   * DETAILS
   * =======================================================
   */

  details?: IAuditLogDetails | null;
}

/* =========================================================
   SCHEMA
========================================================= */

const AuditLogSchema =
  new Schema<IAuditLog>(
    {
      /*
       * ---------------------------------------------------
       * CREATED AT
       * ---------------------------------------------------
       */

      createdAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true,
        immutable: true,
      },

      /*
       * ---------------------------------------------------
       * ACTOR ID
       * ---------------------------------------------------
       */

      actorId: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 128,
      },

      /*
       * ---------------------------------------------------
       * ACTOR TAG
       * ---------------------------------------------------
       */

      actorTag: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
      },

      /*
       * ---------------------------------------------------
       * IP ADDRESS
       * ---------------------------------------------------
       *
       * La valeur peut être IPv4, IPv6 ou une valeur
       * fournie par le reverse proxy.
       *
       * La validation stricte est volontairement laissée
       * aux middleware/routes afin de ne pas casser
       * Render ou d'autres reverse proxies.
       */

      ipAddress: {
        type: String,
        default: null,
        trim: true,
        maxlength: 128,
      },

      /*
       * ---------------------------------------------------
       * MODULE
       * ---------------------------------------------------
       *
       * Exemples :
       *
       * AUTH
       * ADMIN
       * GUILD
       * PREMIUM
       * PAYMENTS
       * DISCORD
       * SECURITY
       */

      module: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 100,
      },

      /*
       * ---------------------------------------------------
       * ACTION
       * ---------------------------------------------------
       *
       * Exemples :
       *
       * LOGIN
       * LOGOUT
       * GUILD_UPDATE
       * LICENSE_ACTIVATE
       * PAYMENT_SUCCESS
       */

      action: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150,
      },

      /*
       * ---------------------------------------------------
       * SEVERITY
       * ---------------------------------------------------
       */

      severity: {
        type: String,
        enum: [
          'INFO',
          'WARNING',
          'ERROR',
          'CRITICAL',
        ],
        default: 'INFO',
        required: true,
        index: true,
      },

      /*
       * ---------------------------------------------------
       * SERVER ID
       * ---------------------------------------------------
       *
       * null = action globale.
       */

      serverId: {
        type: String,
        default: null,
        index: true,
        trim: true,
        maxlength: 64,
      },

      /*
       * ---------------------------------------------------
       * STATUS
       * ---------------------------------------------------
       */

      status: {
        type: String,
        enum: [
          'SUCCESS',
          'FAILURE',
        ],
        required: true,
        index: true,
      },

      /*
       * ---------------------------------------------------
       * ERROR MESSAGE
       * ---------------------------------------------------
       */

      errorMessage: {
        type: String,
        default: null,
        trim: true,
        maxlength: 2000,
      },

      /*
       * ---------------------------------------------------
       * DETAILS
       * ---------------------------------------------------
       *
       * Flexible volontairement :
       *
       * {
       *   before: {...},
       *   after: {...},
       *   guildName: "...",
       *   route: "...",
       *   reason: "..."
       * }
       */

      details: {
        type: Schema.Types.Mixed,
        default: null,
      },
    },

    {
      collection: 'audit_logs',

      /*
       * Les logs d'audit ne doivent pas recevoir
       * automatiquement __v.
       */

      versionKey: false,

      /*
       * On conserve les objets vides dans details.
       */

      minimize: false,

      /*
       * Pas de timestamps automatiques.
       *
       * createdAt est contrôlé explicitement.
       */

      timestamps: false,
    },
  );

/* =========================================================
   IMMUTABILITY
========================================================= */

/*
 * Un AuditLog ne doit pas être modifié après création.
 *
 * Cette règle est surtout à respecter dans les routes :
 *
 * AuditLog.create(...)
 *
 * plutôt que :
 *
 * AuditLog.findByIdAndUpdate(...)
 *
 * ou delete.
 *
 * Le schema marque déjà createdAt comme immutable.
 */

/* =========================================================
   INDEXES
========================================================= */

/*
 * ---------------------------------------------------------
 * DASHBOARD — LOGS RÉCENTS
 * ---------------------------------------------------------
 */

AuditLogSchema.index({
  createdAt: -1,
  severity: 1,
});

/*
 * ---------------------------------------------------------
 * AUDIT PAR UTILISATEUR
 * ---------------------------------------------------------
 */

AuditLogSchema.index({
  actorId: 1,
  createdAt: -1,
});

/*
 * ---------------------------------------------------------
 * AUDIT PAR SERVEUR
 * ---------------------------------------------------------
 */

AuditLogSchema.index({
  serverId: 1,
  createdAt: -1,
});

/*
 * ---------------------------------------------------------
 * RECHERCHE PAR MODULE / ACTION
 * ---------------------------------------------------------
 */

AuditLogSchema.index({
  module: 1,
  action: 1,
  createdAt: -1,
});

/*
 * ---------------------------------------------------------
 * FILTRE STATUS
 * ---------------------------------------------------------
 */

AuditLogSchema.index({
  status: 1,
  createdAt: -1,
});

/* =========================================================
   MODEL
========================================================= */

const AuditLog:
  Model<IAuditLog> =
  mongoose.models.AuditLog ??
  mongoose.model<IAuditLog>(
    'AuditLog',
    AuditLogSchema,
  );

/* =========================================================
   EXPORTS
========================================================= */

export {
  AuditLog,
};

export default AuditLog;