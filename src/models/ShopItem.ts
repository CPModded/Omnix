/**
 * ====================================================================
 * OMNIX — SHOP ITEM MODEL
 *
 * Articles de boutique isolés par serveur.
 *
 * IMPORTANT :
 * Un item appartient toujours à UNE guild.
 * ====================================================================
 */

import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   TYPES
========================================================= */

export interface IShopItem
  extends Document {
  /*
   * =======================================================
   * GUILD
   * =======================================================
   */

  guildId: string;

  /*
   * =======================================================
   * ITEM ID
   * =======================================================
   *
   * Identifiant interne de l'article.
   *
   * Exemple :
   * SH-A3F1
   */

  itemId: string;

  /*
   * =======================================================
   * DISPLAY
   * =======================================================
   */

  name: string;

  description: string | null;

  /*
   * =======================================================
   * PRICE
   * =======================================================
   *
   * Prix en coins OMNIX.
   */

  price: number;

  /*
   * =======================================================
   * DISCORD ROLE
   * =======================================================
   *
   * null = aucun rôle associé.
   */

  roleId: string | null;

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

const ShopItemSchema =
  new Schema<IShopItem>(
    {
      /*
       * ---------------------------------------------------
       * GUILD ID
       * ---------------------------------------------------
       */

      guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * ---------------------------------------------------
       * ITEM ID
       * ---------------------------------------------------
       */

      itemId: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        minlength: 1,
        maxlength: 64,
        index: true,
      },

      /*
       * ---------------------------------------------------
       * NAME
       * ---------------------------------------------------
       */

      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
      },

      /*
       * ---------------------------------------------------
       * PRICE
       * ---------------------------------------------------
       *
       * 1 coin minimum.
       */

      price: {
        type: Number,
        required: true,
        min: 1,
        validate: {
          validator(value: number) {
            return Number.isFinite(
              value,
            );
          },
          message:
            'Le prix doit être un nombre valide.',
        },
      },

      /*
       * ---------------------------------------------------
       * ROLE
       * ---------------------------------------------------
       */

      roleId: {
        type: String,
        default: null,
        trim: true,
      },

      /*
       * ---------------------------------------------------
       * DESCRIPTION
       * ---------------------------------------------------
       */

      description: {
        type: String,
        default:
          'Aucune description fournie.',
        trim: true,
        maxlength: 1000,
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
 * Un item doit toujours appartenir à une guild.
 */

ShopItemSchema.pre(
  'validate',
  function (next) {
    if (
      !this.guildId ||
      !this.guildId.trim()
    ) {
      return next(
        new Error(
          'guildId est obligatoire pour un article de boutique.',
        ),
      );
    }

    if (
      !this.itemId ||
      !this.itemId.trim()
    ) {
      return next(
        new Error(
          'itemId est obligatoire.',
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
 * CRITIQUE :
 *
 * Un même itemId peut exister sur plusieurs serveurs.
 *
 * Exemple :
 *
 * Guild A → SH-A3F1
 * Guild B → SH-A3F1
 *
 * Mais deux fois SH-A3F1 dans Guild A = impossible.
 */

ShopItemSchema.index(
  {
    guildId: 1,
    itemId: 1,
  },
  {
    unique: true,
  },
);

/*
 * Optimise l'affichage de la boutique
 * d'un serveur.
 */

ShopItemSchema.index({
  guildId: 1,
  createdAt: -1,
});

/* =========================================================
   MODEL
========================================================= */

export const ShopItem:
  Model<IShopItem> =
  mongoose.models.ShopItem ||
  mongoose.model<IShopItem>(
    'ShopItem',
    ShopItemSchema,
  );

export default ShopItem;