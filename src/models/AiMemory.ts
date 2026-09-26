import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   TYPES
========================================================= */

export type AIMemoryRole =
  | 'user'
  | 'assistant'
  | 'system';

export interface IAIMemoryMessage {
  role: AIMemoryRole;
  content: string;
  timestamp: Date;
}

export interface IAIMemory
  extends Document {
  guildId: string;
  channelId: string;
  userId: string;

  messages: IAIMemoryMessage[];

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   MESSAGE SCHEMA
========================================================= */

const AIMemoryMessageSchema =
  new Schema<IAIMemoryMessage>(
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

      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    },
  );

/* =========================================================
   MEMORY SCHEMA
========================================================= */

const AIMemorySchema =
  new Schema<IAIMemory>(
    {
      /*
       * Discord server.
       *
       * Important:
       * La mémoire est isolée par serveur.
       */
      guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Discord channel.
       *
       * Permet d'avoir une mémoire différente
       * pour chaque salon.
       */
      channelId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Discord user.
       *
       * Permet de distinguer les utilisateurs
       * utilisant l'IA dans le même salon.
       */
      userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Historique IA.
       */
      messages: {
        type: [
          AIMemoryMessageSchema,
        ],

        default: [],
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
 * Une seule mémoire par :
 *
 * guild + channel + user
 *
 * Cela évite la création de plusieurs documents
 * contenant plusieurs historiques pour la même personne.
 */
AIMemorySchema.index(
  {
    guildId: 1,
    channelId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

/*
 * Recherche rapide de toutes les mémoires
 * d'un salon.
 */
AIMemorySchema.index({
  guildId: 1,
  channelId: 1,
  updatedAt: -1,
});

/*
 * Recherche rapide des mémoires d'un utilisateur
 * sur un serveur.
 */
AIMemorySchema.index({
  guildId: 1,
  userId: 1,
  updatedAt: -1,
});

/* =========================================================
   MODEL
========================================================= */

const AIMemory: Model<IAIMemory> =
  mongoose.models.AIMemory ??
  mongoose.model<IAIMemory>(
    'AIMemory',
    AIMemorySchema,
  );

/* =========================================================
   EXPORTS
========================================================= */

export {
  AIMemory,
};

export default AIMemory;