import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   TYPES
========================================================= */

export type AIServiceProvider =
  | 'openrouter'
  | 'openai'
  | 'google'
  | 'anthropic'
  | 'custom';

export type AIServiceStatus =
  | 'active'
  | 'inactive'
  | 'maintenance';

/* =========================================================
   INTERFACE
========================================================= */

export interface IAiService
  extends Document {
  name: string;

  provider: AIServiceProvider;

  model: string;

  status: AIServiceStatus;

  /**
   * Identifiant du serveur Discord.
   *
   * Null = service global OMNIX.
   */
  guildId?: string | null;

  /**
   * Identifiant utilisateur si le service
   * est spécifique à un utilisateur.
   */
  userId?: string | null;

  /**
   * Configuration publique/non sensible.
   */
  temperature: number;

  maxTokens: number;

  systemPrompt?: string | null;

  /**
   * Statistiques d'utilisation.
   */
  totalRequests: number;

  totalPromptTokens: number;

  totalCompletionTokens: number;

  totalTokens: number;

  lastUsedAt?: Date | null;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   SCHEMA
========================================================= */

const AiServiceSchema =
  new Schema<IAiService>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      provider: {
        type: String,
        enum: [
          'openrouter',
          'openai',
          'google',
          'anthropic',
          'custom',
        ],
        required: true,
        default: 'openrouter',
        index: true,
      },

      model: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      status: {
        type: String,
        enum: [
          'active',
          'inactive',
          'maintenance',
        ],
        default: 'active',
        index: true,
      },

      /*
       * Isolation serveur.
       */
      guildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
      },

      /*
       * Service éventuellement lié à un utilisateur.
       */
      userId: {
        type: String,
        default: null,
        index: true,
        trim: true,
      },

      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },

      maxTokens: {
        type: Number,
        default: 2000,
        min: 1,
      },

      systemPrompt: {
        type: String,
        default: null,
        maxlength: 12000,
      },

      /*
       * Statistiques.
       */
      totalRequests: {
        type: Number,
        default: 0,
        min: 0,
      },

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

      lastUsedAt: {
        type: Date,
        default: null,
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
 * Recherche des services actifs d'un serveur.
 */
AiServiceSchema.index({
  guildId: 1,
  status: 1,
});

/*
 * Recherche des services d'un utilisateur.
 */
AiServiceSchema.index({
  userId: 1,
  status: 1,
});

/*
 * Recherche globale par provider/modèle.
 */
AiServiceSchema.index({
  provider: 1,
  model: 1,
});

/* =========================================================
   MODEL
========================================================= */

const AiService: Model<IAiService> =
  mongoose.models.AiService ??
  mongoose.model<IAiService>(
    'AiService',
    AiServiceSchema,
  );

/* =========================================================
   EXPORT
========================================================= */

export {
  AiService,
};

export default AiService;