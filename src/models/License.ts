import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   OMNIX — LICENSE MODEL
========================================================= */

export type LicenseTier =
  | 'premium'
  | 'lifetime'
  | 'enterprise';

export type LicenseStatus =
  | 'active'
  | 'used'
  | 'suspended'
  | 'expired';

export interface ILicense extends Document {
  /*
   * =======================================================
   * IDENTIFICATION
   * =======================================================
   */

  key: string;

  /*
   * =======================================================
   * LICENSE TYPE
   * =======================================================
   */

  tier: LicenseTier;

  /*
   * =======================================================
   * STATUS
   * =======================================================
   */

  status: LicenseStatus;

  /*
   * =======================================================
   * OWNER / BUYER
   * =======================================================
   *
   * Discord ID de l'utilisateur ayant acheté
   * ou reçu la licence.
   */

  buyerId: string;

  /*
   * =======================================================
   * ACTIVATION
   * =======================================================
   *
   * Serveur sur lequel la licence est actuellement
   * activée.
   */

  activatedGuildId: string | null;

  activatedAt: Date | null;

  /*
   * =======================================================
   * EXPIRATION
   * =======================================================
   *
   * null = licence sans expiration
   */

  expiresAt: Date | null;

  /*
   * =======================================================
   * DURATION
   * =======================================================
   *
   * 0 = Lifetime / aucune expiration
   */

  durationInDays: number;

  /*
   * =======================================================
   * TIMESTAMPS
   * =======================================================
   */

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   SCHEMA
========================================================= */

const LicenseSchema =
  new Schema<ILicense>(
    {
      /*
       * ---------------------------------------------------
       * LICENSE KEY
       * ---------------------------------------------------
       */

      key: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        uppercase: true,
      },

      /*
       * ---------------------------------------------------
       * TIER
       * ---------------------------------------------------
       */

      tier: {
        type: String,
        enum: [
          'premium',
          'lifetime',
          'enterprise',
        ],
        required: true,
        index: true,
      },

      /*
       * ---------------------------------------------------
       * STATUS
       * ---------------------------------------------------
       */

      status: {
        type: String,
        enum: [
          'active',
          'used',
          'suspended',
          'expired',
        ],
        default: 'active',
        index: true,
      },

      /*
       * ---------------------------------------------------
       * BUYER
       * ---------------------------------------------------
       */

      buyerId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * ---------------------------------------------------
       * ACTIVATED GUILD
       * ---------------------------------------------------
       */

      activatedGuildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
      },

      /*
       * ---------------------------------------------------
       * ACTIVATED AT
       * ---------------------------------------------------
       */

      activatedAt: {
        type: Date,
        default: null,
      },

      /*
       * ---------------------------------------------------
       * EXPIRATION
       * ---------------------------------------------------
       */

      expiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      /*
       * ---------------------------------------------------
       * DURATION
       * ---------------------------------------------------
       *
       * 0 = Lifetime
       */

      durationInDays: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
    },

    {
      timestamps: true,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * Recherche rapide des licences d'un utilisateur.
 */

LicenseSchema.index({
  buyerId: 1,
  status: 1,
});

/*
 * Recherche rapide des licences d'un serveur.
 */

LicenseSchema.index({
  activatedGuildId: 1,
  status: 1,
});

/*
 * Recherche des licences arrivant à expiration.
 */

LicenseSchema.index({
  expiresAt: 1,
  status: 1,
});

/* =========================================================
   MODEL
========================================================= */

export const License: Model<ILicense> =
  mongoose.models.License ||
  mongoose.model<ILicense>(
    'License',
    LicenseSchema,
  );

export default License;