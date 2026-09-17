import mongoose, {
  Schema,
  type Document,
  type Model,
} from 'mongoose';

/* =========================================================
   TYPES
========================================================= */

export interface IModerationCase
  extends Document {
  guildId: string;

  caseId: number;

  type: string;

  userId: string;

  moderatorId: string;

  reason: string;

  createdAt: Date;

  active: boolean;

  duration?: number | null;

  expiresAt?: Date | null;

  metadata?: Record<string, unknown> | null;
}

/* =========================================================
   SCHEMA
========================================================= */

const ModerationCaseSchema =
  new Schema<IModerationCase>(
    {
      guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      caseId: {
        type: Number,
        required: true,
        min: 1,
      },

      type: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      moderatorId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      reason: {
        type: String,
        default: 'Aucune raison fournie',
        trim: true,
      },

      createdAt: {
        type: Date,
        default: Date.now,
        index: true,
      },

      active: {
        type: Boolean,
        default: true,
        index: true,
      },

      duration: {
        type: Number,
        default: null,
        min: 0,
      },

      expiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: null,
      },
    },
    {
      collection: 'moderation_cases',

      /*
       * createdAt est géré explicitement
       * car le modèle possède déjà son propre champ.
       */
      timestamps: false,

      versionKey: false,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * CRITIQUE :
 *
 * Un caseId doit être unique PAR SERVEUR,
 * pas globalement.
 *
 * Exemple :
 *
 * Guild A → Case #1
 * Guild B → Case #1
 *
 * sont parfaitement valides.
 */
ModerationCaseSchema.index(
  {
    guildId: 1,
    caseId: 1,
  },
  {
    unique: true,
  },
);

/*
 * Recherche rapide des sanctions
 * d'un membre sur un serveur.
 */
ModerationCaseSchema.index({
  guildId: 1,
  userId: 1,
  createdAt: -1,
});

/*
 * Historique de modération d'un serveur.
 */
ModerationCaseSchema.index({
  guildId: 1,
  createdAt: -1,
});

/*
 * Recherche des sanctions actives
 * pouvant nécessiter une expiration automatique.
 */
ModerationCaseSchema.index({
  guildId: 1,
  active: 1,
  expiresAt: 1,
});

/* =========================================================
   MODEL
========================================================= */

const ModerationCase: Model<IModerationCase> =
  mongoose.models.ModerationCase ??
  mongoose.model<IModerationCase>(
    'ModerationCase',
    ModerationCaseSchema,
  );

/* =========================================================
   EXPORT
========================================================= */

export { ModerationCase };

export default ModerationCase;