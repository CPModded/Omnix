import mongoose, {
  Document,
  Model,
  Schema
} from "mongoose";
/* =========================================================
   TYPES
========================================================= */
export type AiLogSource =
  | "web"
  | "discord"
  | "api"
  | "system";
export type AiLogStatus =
  | "success"
  | "error"
  | "cancelled"
  | "blocked";
export interface IAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /**
   * Permet de conserver des informations complémentaires
   * sans casser le modèle si le format IA évolue.
   */
  metadata?: Record<string, unknown>;
}
export interface IAiLog extends Document {
  /* -------------------------------------------------------
     IDENTIFICATION
  ------------------------------------------------------- */
  sessionId: string;
  source: AiLogSource;
  /* -------------------------------------------------------
     UTILISATEUR
  ------------------------------------------------------- */
  userId?: string;
  username?: string;
  userTag?: string;
  /* -------------------------------------------------------
     SERVEUR DISCORD
  ------------------------------------------------------- */
  guildId?: string;
  guildName?: string;
  /* -------------------------------------------------------
     OWNER DU SERVEUR
  ------------------------------------------------------- */
  ownerId?: string;
  ownerUsername?: string;
  /* -------------------------------------------------------
     CONVERSATION
  ------------------------------------------------------- */
  messages: IAiMessage[];
  userMessage?: string;
  assistantMessage?: string;
  /* -------------------------------------------------------
     MODÈLE IA
  ------------------------------------------------------- */
  provider?: string;
  model?: string;
  /* -------------------------------------------------------
     TOKENS
  ------------------------------------------------------- */
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /* -------------------------------------------------------
     PERFORMANCE
  ------------------------------------------------------- */
  durationMs?: number;
  /* -------------------------------------------------------
     STATUT
  ------------------------------------------------------- */
  status: AiLogStatus;
  error?: string;
  errorCode?: string;
  /* -------------------------------------------------------
     IP / CLIENT
     
     Optionnels.
     On évite d'imposer ces données.
  ------------------------------------------------------- */
  ipHash?: string;
  userAgent?: string;
  /* -------------------------------------------------------
     MÉTADONNÉES
  ------------------------------------------------------- */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
/* =========================================================
   MESSAGE SCHEMA
========================================================= */
const AiMessageSchema =
  new Schema<IAiMessage>(
    {
      role: {
        type: String,
        enum: [
          "system",
          "user",
          "assistant",
          "tool"
        ],
        required: true
      },
      content: {
        type: String,
        required: true
      },
      metadata: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    {
      _id: false
    }
  );
/* =========================================================
   AI LOG SCHEMA
========================================================= */
const AiLogSchema =
  new Schema<IAiLog>(
    {
      /* -----------------------------------------------------
         IDENTIFICATION
      ----------------------------------------------------- */
      sessionId: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 255
      },
      source: {
        type: String,
        enum: [
          "web",
          "discord",
          "api",
          "system"
        ],
        required: true,
        index: true
      },
      /* -----------------------------------------------------
         UTILISATEUR
      ----------------------------------------------------- */
      userId: {
        type: String,
        index: true,
        trim: true,
        maxlength: 100
      },
      username: {
        type: String,
        trim: true,
        maxlength: 200
      },
      userTag: {
        type: String,
        trim: true,
        maxlength: 200
      },
      /* -----------------------------------------------------
         SERVEUR
      ----------------------------------------------------- */
      guildId: {
        type: String,
        index: true,
        trim: true,
        maxlength: 100
      },
      guildName: {
        type: String,
        trim: true,
        maxlength: 200
      },
      /* -----------------------------------------------------
         OWNER
      ----------------------------------------------------- */
      ownerId: {
        type: String,
        index: true,
        trim: true,
        maxlength: 100
      },
      ownerUsername: {
        type: String,
        trim: true,
        maxlength: 200
      },
      /* -----------------------------------------------------
         CONVERSATION
      ----------------------------------------------------- */
      messages: {
        type: [AiMessageSchema],
        default: []
      },
      userMessage: {
        type: String,
        maxlength: 100000
      },
      assistantMessage: {
        type: String,
        maxlength: 100000
      },
      /* -----------------------------------------------------
         MODÈLE
      ----------------------------------------------------- */
      provider: {
        type: String,
        trim: true,
        maxlength: 100
      },
      model: {
        type: String,
        trim: true,
        maxlength: 200,
        index: true
      },
      /* -----------------------------------------------------
         TOKENS
      ----------------------------------------------------- */
      promptTokens: {
        type: Number,
        default: 0,
        min: 0
      },
      completionTokens: {
        type: Number,
        default: 0,
        min: 0
      },
      totalTokens: {
        type: Number,
        default: 0,
        min: 0
      },
      /* -----------------------------------------------------
         PERFORMANCE
      ----------------------------------------------------- */
      durationMs: {
        type: Number,
        min: 0
      },
      /* -----------------------------------------------------
         STATUT
      ----------------------------------------------------- */
      status: {
        type: String,
        enum: [
          "success",
          "error",
          "cancelled",
          "blocked"
        ],
        default: "success",
        index: true
      },
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
   INDEX COMPOSITES
========================================================= */
/**
 * Recherche des conversations d'un serveur.
 */
AiLogSchema.index({
  guildId: 1,
  createdAt: -1
});
/**
 * Recherche de l'activité IA d'un owner.
 */
AiLogSchema.index({
  ownerId: 1,
  createdAt: -1
});
/**
 * Recherche de l'activité IA d'un utilisateur.
 */
AiLogSchema.index({
  userId: 1,
  createdAt: -1
});
/**
 * Recherche par session.
 */
AiLogSchema.index({
  sessionId: 1,
  createdAt: 1
});
/**
 * Statistiques IA par source.
 */
AiLogSchema.index({
  source: 1,
  status: 1,
  createdAt: -1
});
/**
 * Statistiques par modèle.
 */
AiLogSchema.index({
  model: 1,
  createdAt: -1
});
/* =========================================================
   MODEL
========================================================= */
const AiLog: Model<IAiLog> =
  mongoose.models.AiLog ||
  mongoose.model<IAiLog>(
    "AiLog",
    AiLogSchema
  );
export default AiLog;