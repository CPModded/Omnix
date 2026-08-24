import mongoose, {
  Schema,
  type Document,
  type Model,
} from 'mongoose';

/* =========================================================
   INTERFACE
========================================================= */

export interface IEconomy
  extends Document {
  guildId: string;
  userId: string;

  wallet: number;
  bank: number;

  lastWork: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   SCHEMA
========================================================= */

const EconomySchema =
  new Schema<IEconomy>(
    {
      /*
       * Discord Guild ID
       *
       * IMPORTANT :
       * toutes les données économiques sont isolées
       * par serveur.
       */
      guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

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
       * Argent disponible immédiatement.
       */
      wallet: {
        type: Number,
        default: 100,
        min: 0,
      },

      /*
       * Argent placé en banque.
       */
      bank: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
       * Dernière utilisation de /work.
       */
      lastWork: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,

      /*
       * Collection explicite afin de garder
       * une structure MongoDB stable.
       */
      collection: 'economy',
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * UN compte économique par utilisateur
 * et par serveur.
 *
 * Guild A + User X
 * Guild B + User X
 *
 * = deux comptes totalement indépendants.
 */
EconomySchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

/*
 * Optimise les recherches des membres
 * d'un serveur.
 */
EconomySchema.index({
  guildId: 1,
  wallet: -1,
});

/*
 * Optimise les recherches liées
 * aux cooldowns / /work.
 */
EconomySchema.index({
  guildId: 1,
  lastWork: 1,
});

/* =========================================================
   MODEL
========================================================= */

/*
 * Évite :
 *
 * OverwriteModelError:
 * Cannot overwrite `Economy` model once compiled.
 *
 * Important avec tsx / hot reload / Render.
 */
const Economy: Model<IEconomy> =
  mongoose.models.Economy ??
  mongoose.model<IEconomy>(
    'Economy',
    EconomySchema,
  );

/* =========================================================
   EXPORTS
========================================================= */

export { Economy };

export default Economy;