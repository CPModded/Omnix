import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   OMNIX — PROMO CODE MODEL
========================================================= */

export type PromoDiscountType =
  | 'percentage'
  | 'fixed';

export interface IPromoCode
  extends Document {
  /*
   * =======================================================
   * CODE
   * =======================================================
   *
   * Exemple :
   * CODESUMMER20
   */

  code: string;

  /*
   * =======================================================
   * DISCOUNT
   * =======================================================
   */

  discountType:
    | 'percentage'
    | 'fixed';

  /*
   * Percentage :
   * 20 = -20%
   *
   * Fixed :
   * 20 = -20€
   */

  discountValue: number;

  /*
   * =======================================================
   * USAGE LIMITS
   * =======================================================
   *
   * 0 = illimité
   */

  maxUses: number;

  usesCount: number;

  /*
   * =======================================================
   * EXPIRATION
   * =======================================================
   */

  expiresAt: Date;

  /*
   * =======================================================
   * STATUS
   * =======================================================
   */

  isActive: boolean;

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

const PromoCodeSchema =
  new Schema<IPromoCode>(
    {
      /*
       * ---------------------------------------------------
       * CODE
       * ---------------------------------------------------
       */

      code: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        trim: true,
        minlength: 3,
        maxlength: 64,
      },

      /*
       * ---------------------------------------------------
       * DISCOUNT TYPE
       * ---------------------------------------------------
       */

      discountType: {
        type: String,
        enum: [
          'percentage',
          'fixed',
        ],
        required: true,
      },

      /*
       * ---------------------------------------------------
       * DISCOUNT VALUE
       * ---------------------------------------------------
       */

      discountValue: {
        type: Number,
        required: true,
        min: 0,
      },

      /*
       * ---------------------------------------------------
       * MAX USES
       * ---------------------------------------------------
       *
       * 0 = unlimited
       */

      maxUses: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
       * ---------------------------------------------------
       * CURRENT USES
       * ---------------------------------------------------
       */

      usesCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
       * ---------------------------------------------------
       * EXPIRATION
       * ---------------------------------------------------
       */

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      /*
       * ---------------------------------------------------
       * ACTIVE
       * ---------------------------------------------------
       */

      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },
    },

    {
      timestamps: true,
    },
  );

/* =========================================================
   VALIDATION
========================================================= */

/*
 * Un pourcentage ne peut pas dépasser 100%.
 */

PromoCodeSchema.pre(
  'validate',
  function (next) {
    if (
      this.discountType ===
        'percentage' &&
      this.discountValue > 100
    ) {
      return next(
        new Error(
          'Une remise en pourcentage ne peut pas dépasser 100%.',
        ),
      );
    }

    /*
     * Le nombre d'utilisations ne peut pas
     * dépasser la limite configurée.
     *
     * 0 = illimité.
     */

    if (
      this.maxUses > 0 &&
      this.usesCount >
        this.maxUses
    ) {
      return next(
        new Error(
          'Le nombre d’utilisations dépasse la limite du code promotionnel.',
        ),
      );
    }

    return next();
  },
);

/* =========================================================
   INDEXES
========================================================= */

/*
 * Recherche rapide des codes actifs
 * arrivant à expiration.
 */

PromoCodeSchema.index({
  isActive: 1,
  expiresAt: 1,
});

/* =========================================================
   MODEL
========================================================= */

export const PromoCode:
  Model<IPromoCode> =
  mongoose.models.PromoCode ||
  mongoose.model<IPromoCode>(
    'PromoCode',
    PromoCodeSchema,
  );

export default PromoCode;