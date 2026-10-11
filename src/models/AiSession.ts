import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   TYPES
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

export interface IAiSession
  extends Document {
  userId: string;

  /**
   * Discord server.
   *
   * Optional pour conserver la compatibilité
   * avec les anciennes sessions globales.
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
        trim: true,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
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
       * Discord user.
       */
      userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Discord guild.
       *
       * Null = session globale.
       */
      guildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
      },

      /*
       * Titre facultatif.
       */
      title: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
      },

      /*
       * Historique de session.
       *
       * La mémoire conversationnelle Discord
       * détaillée est gérée par AIMemory.
       */
      messages: {
        type: [
          AiMessageSchema,
        ],

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
      timestamps: true,
      versionKey: false,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * Une session principale par utilisateur + serveur.
 *
 * ATTENTION :
 *
 * guildId peut être null.
 *
 * MongoDB considère les valeurs nulles comme identiques
 * pour un index unique.
 *
 * On utilise donc un index partiel afin de ne pas
 * bloquer plusieurs sessions globales éventuelles.
 */
AiSessionSchema.index(
  {
    userId: 1,
    guildId: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      guildId: {
        $type: 'string',
      },
    },
  },
);

/*
 * Recherche rapide des sessions d'un utilisateur.
 */
AiSessionSchema.index({
  userId: 1,
  updatedAt: -1,
});

/*
 * Recherche des sessions d'un serveur.
 */
AiSessionSchema.index({
  guildId: 1,
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

export default AiSession;