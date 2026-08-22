import mongoose, {
  Schema,
  type Document,
  type Model,
} from 'mongoose';

/* =========================================================
   MESSAGE
========================================================= */

export type AiMessageRole =
  | 'user'
  | 'assistant'
  | 'system';

export interface IAiMessage {
  role: AiMessageRole;

  content: string;

  createdAt: Date;
}

/* =========================================================
   SESSION
========================================================= */

export interface IAiSession
  extends Document {
  userId: string;

  /*
   * Une session peut éventuellement être globale
   * lorsqu'elle n'est pas liée à un serveur.
   */
  guildId?: string | null;

  title?: string | null;

  messages: IAiMessage[];

  totalPromptTokens: number;

  totalCompletionTokens: number;

  totalTokens: number;

  totalRequests: number;

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
          'user',
          'assistant',
          'system',
        ],
        required: true,
      },

      content: {
        type: String,
        required: true,
        trim: false,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      /*
       * Les messages sont des sous-documents.
       *
       * On n'a pas besoin d'un ObjectId MongoDB
       * pour chaque message.
       */
      _id: false,
    },
  );

/* =========================================================
   SESSION SCHEMA
========================================================= */

const AiSessionSchema =
  new Schema<IAiSession>(
    {
      /*
       * Discord User ID
       */
      userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Discord Guild ID.
       *
       * null = session globale OMNIX.
       */
      guildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
      },

      /*
       * Nom de la conversation.
       */
      title: {
        type: String,
        default: null,
        trim: true,
        maxlength: 150,
      },

      /*
       * Historique de conversation.
       */
      messages: {
        type: [AiMessageSchema],
        default: [],
      },

      /*
       * Statistiques OpenRouter / IA.
       */
      totalPromptTokens: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalCompletionTokens: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalTokens: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalRequests: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      collection: 'ai_sessions',

      timestamps: true,

      versionKey: false,

      minimize: false,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * Recherche des sessions d'un utilisateur
 * sur un serveur.
 */
AiSessionSchema.index({
  userId: 1,
  guildId: 1,
  updatedAt: -1,
});

/*
 * Recherche rapide des sessions d'un serveur.
 */
AiSessionSchema.index({
  guildId: 1,
  updatedAt: -1,
});

/*
 * Recherche globale d'un utilisateur.
 */
AiSessionSchema.index({
  userId: 1,
  updatedAt: -1,
});

/* =========================================================
   MODEL
========================================================= */

const AiSession: Model<IAiSession> =
  mongoose.models.AiSession ??
  mongoose.model<IAiSession>(
    'AiSession',
    AiSessionSchema,
  );

/* =========================================================
   EXPORT
========================================================= */

export { AiSession };

export default AiSession;