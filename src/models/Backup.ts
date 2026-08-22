import mongoose, {
  Schema,
  type Document,
  type Model,
} from 'mongoose';

/* =========================================================
   TYPES
========================================================= */

export type BackupStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'deleted';

export type BackupType =
  | 'manual'
  | 'automatic'
  | 'scheduled';

/* =========================================================
   INTERFACE
========================================================= */

export interface IBackup
  extends Document {
  guildId: string;

  backupId: string;

  name: string;

  type: BackupType;

  status: BackupStatus;

  createdBy: string;

  description?: string | null;

  /*
   * Données sauvegardées.
   *
   * On utilise Mixed car la structure peut évoluer
   * avec les modules OMNIX sans nécessiter une migration
   * du schéma à chaque ajout de fonctionnalité.
   */
  data: Record<string, unknown>;

  /*
   * Taille approximative de la sauvegarde en octets.
   */
  size?: number;

  /*
   * Nombre d'éléments sauvegardés.
   */
  itemCount?: number;

  errorMessage?: string | null;

  createdAt: Date;

  updatedAt: Date;

  completedAt?: Date | null;

  expiresAt?: Date | null;
}

/* =========================================================
   SCHEMA
========================================================= */

const BackupSchema =
  new Schema<IBackup>(
    {
      /*
       * =====================================================
       * GUILD
       * =====================================================
       *
       * Une sauvegarde appartient TOUJOURS à un serveur.
       *
       * C'est essentiel pour empêcher une sauvegarde
       * d'un serveur A d'être récupérée depuis le serveur B.
       */
      guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Identifiant interne de la sauvegarde.
       *
       * Exemple :
       *
       * BCK-8F42A1
       */
      backupId: {
        type: String,
        required: true,
        trim: true,
      },

      /*
       * Nom lisible dans le Dashboard.
       */
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      /*
       * Origine de la sauvegarde.
       */
      type: {
        type: String,
        enum: [
          'manual',
          'automatic',
          'scheduled',
        ],
        default: 'manual',
        index: true,
      },

      /*
       * État de la sauvegarde.
       */
      status: {
        type: String,
        enum: [
          'pending',
          'completed',
          'failed',
          'deleted',
        ],
        default: 'pending',
        index: true,
      },

      /*
       * Discord ID de la personne ayant
       * créé la sauvegarde.
       */
      createdBy: {
        type: String,
        required: true,
        index: true,
        trim: true,
      },

      /*
       * Description facultative.
       */
      description: {
        type: String,
        default: null,
        trim: true,
        maxlength: 500,
      },

      /*
       * CONTENU DE LA SAUVEGARDE
       *
       * Mixed permet de sauvegarder différents modules :
       *
       * moderation
       * roles
       * channels
       * permissions
       * automod
       * tickets
       * welcome
       * etc.
       */
      data: {
        type: Schema.Types.Mixed,
        required: true,
        default: {},
      },

      /*
       * Taille de la sauvegarde.
       */
      size: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
       * Nombre d'éléments contenus.
       */
      itemCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
       * Message d'erreur si la sauvegarde échoue.
       */
      errorMessage: {
        type: String,
        default: null,
      },

      /*
       * Date de fin de création.
       */
      completedAt: {
        type: Date,
        default: null,
      },

      /*
       * Date d'expiration éventuelle.
       *
       * null = sauvegarde permanente.
       */
      expiresAt: {
        type: Date,
        default: null,
        index: true,
      },
    },
    {
      collection: 'backups',

      timestamps: true,

      versionKey: false,

      minimize: false,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * Un backupId doit être unique DANS un serveur.
 *
 * Serveur A :
 *   BCK-001
 *
 * Serveur B :
 *   BCK-001
 *
 * Autorisé.
 */
BackupSchema.index(
  {
    guildId: 1,
    backupId: 1,
  },
  {
    unique: true,
  },
);

/*
 * Liste des sauvegardes d'un serveur.
 */
BackupSchema.index({
  guildId: 1,
  createdAt: -1,
});

/*
 * Recherche par statut.
 */
BackupSchema.index({
  guildId: 1,
  status: 1,
  createdAt: -1,
});

/*
 * Recherche des sauvegardes automatiques.
 */
BackupSchema.index({
  guildId: 1,
  type: 1,
  createdAt: -1,
});

/*
 * Permet au système de nettoyage de retrouver
 * rapidement les sauvegardes expirées.
 */
BackupSchema.index({
  expiresAt: 1,
  status: 1,
});

/* =========================================================
   MODEL
========================================================= */

const Backup: Model<IBackup> =
  mongoose.models.Backup ??
  mongoose.model<IBackup>(
    'Backup',
    BackupSchema,
  );

/* =========================================================
   EXPORTS
========================================================= */

export { Backup };

export default Backup;