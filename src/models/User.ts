import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   OMNIX — USER MODEL
========================================================= */

export interface IUserGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
}

export interface IUser extends Document {
  /* -------------------------------------------------------
     DISCORD IDENTITY
  ------------------------------------------------------- */

  discordId: string;

  username: string;

  globalName?: string;

  avatar?: string | null;

  /* -------------------------------------------------------
     DISCORD OAUTH
     
     select: false
     → Ces données ne sont jamais récupérées
       par défaut dans les requêtes MongoDB.
  ------------------------------------------------------- */

  accessToken?: string;

  refreshToken?: string;

  tokenExpiresAt?: Date;

  /* -------------------------------------------------------
     USER GUILDS
  ------------------------------------------------------- */

  guilds: IUserGuild[];

  /* -------------------------------------------------------
     OMNIX PERMISSIONS
  ------------------------------------------------------- */

  isAdmin: boolean;

  isPremium: boolean;

  /* -------------------------------------------------------
     AUTH / ACTIVITY
  ------------------------------------------------------- */

  lastLogin?: Date;

  /* -------------------------------------------------------
     TIMESTAMPS
  ------------------------------------------------------- */

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   GUILD SUB-SCHEMA
========================================================= */

const UserGuildSchema =
  new Schema<IUserGuild>(
    {
      id: {
        type: String,
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      icon: {
        type: String,
        default: null,
      },

      owner: {
        type: Boolean,
        default: false,
      },

      permissions: {
        type: String,
        default: '0',
      },
    },
    {
      _id: false,
    },
  );

/* =========================================================
   USER SCHEMA
========================================================= */

const UserSchema =
  new Schema<IUser>(
    {
      /* ---------------------------------------------------
         DISCORD ID
      --------------------------------------------------- */

      discordId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      /* ---------------------------------------------------
         USERNAME
      --------------------------------------------------- */

      username: {
        type: String,
        required: true,
        trim: true,
      },

      /* ---------------------------------------------------
         GLOBAL NAME
      --------------------------------------------------- */

      globalName: {
        type: String,
        trim: true,
      },

      /* ---------------------------------------------------
         AVATAR
      --------------------------------------------------- */

      avatar: {
        type: String,
        default: null,
      },

      /* ---------------------------------------------------
         DISCORD ACCESS TOKEN
         
         IMPORTANT:
         select: false
         → Ne sera pas retourné avec User.find()
  --------------------------------------------------- */

      accessToken: {
        type: String,
        select: false,
      },

      /* ---------------------------------------------------
         DISCORD REFRESH TOKEN
      --------------------------------------------------- */

      refreshToken: {
        type: String,
        select: false,
      },

      /* ---------------------------------------------------
         TOKEN EXPIRATION
      --------------------------------------------------- */

      tokenExpiresAt: {
        type: Date,
      },

      /* ---------------------------------------------------
         DISCORD GUILDS
      --------------------------------------------------- */

      guilds: {
        type: [UserGuildSchema],
        default: [],
      },

      /* ---------------------------------------------------
         OMNIX ADMIN
         
         IMPORTANT:
         Le statut Owner n'est PAS stocké ici.
         
         Owner est déterminé dynamiquement avec
         CONFIG.OWNER_IDS.
      --------------------------------------------------- */

      isAdmin: {
        type: Boolean,
        default: false,
        index: true,
      },

      /* ---------------------------------------------------
         OMNIX PREMIUM
      --------------------------------------------------- */

      isPremium: {
        type: Boolean,
        default: false,
        index: true,
      },

      /* ---------------------------------------------------
         LAST LOGIN
      --------------------------------------------------- */

      lastLogin: {
        type: Date,
      },
    },

    {
      timestamps: true,
      strict: true,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

UserSchema.index({
  discordId: 1,
});

UserSchema.index({
  isAdmin: 1,
});

UserSchema.index({
  isPremium: 1,
});

/* =========================================================
   MODEL
========================================================= */

export const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>(
    'User',
    UserSchema,
  );

export default User;