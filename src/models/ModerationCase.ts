import mongoose, {
  Schema,
  Document,
  Model,
} from 'mongoose';

/* =========================================================
   INTERFACE
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

  duration?: number;

  expiresAt?: Date;

  metadata?: Record<string, unknown>;
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
      },

      caseId: {
        type: Number,
        required: true,
      },

      type: {
        type: String,
        required: true,
        index: true,
      },

      userId: {
        type: String,
        required: true,
        index: true,
      },

      moderatorId: {
        type: String,
        required: true,
        index: true,
      },

      reason: {
        type: String,
        default: 'Aucune raison fournie',
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },

      active: {
        type: Boolean,
        default: true,
      },

      duration: {
        type: Number,
        required: false,
      },

      expiresAt: {
        type: Date,
        required: false,
      },

      metadata: {
        type: Schema.Types.Mixed,
        required: false,
      },
    },
    {
      versionKey: false,
    }
  );

/* =========================================================
   INDEX
========================================================= */

ModerationCaseSchema.index({
  guildId: 1,
  caseId: 1,
});

ModerationCaseSchema.index({
  guildId: 1,
  userId: 1,
});

ModerationCaseSchema.index({
  guildId: 1,
  createdAt: -1,
});

/* =========================================================
   MODEL
========================================================= */

const ModerationCase: Model<IModerationCase> =
  mongoose.models.ModerationCase ??
  mongoose.model<IModerationCase>(
    'ModerationCase',
    ModerationCaseSchema
  );

/* =========================================================
   EXPORT
========================================================= */

export default ModerationCase;