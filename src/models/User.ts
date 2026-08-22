import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export interface IUser extends Document {
  discordId: string;

  username: string;

  globalName?: string;

  avatar?: string;

  accessToken?: string;

  refreshToken?: string;

  tokenExpiresAt?: Date;

  /**
   * Administrateur de la plateforme OMNIX.
   *
   * IMPORTANT :
   * Ce champ ne donne pas automatiquement
   * les droits Owner.
   */
  isAdmin: boolean;

  /**
   * Licence Premium personnelle.
   */
  isPremium: boolean;

  /**
   * Serveurs Discord accessibles à l'utilisateur.
   */
  guilds: Array<{
    id: string;
    name: string;
    icon?: string | null;
    owner?: boolean;
    permissions?: string;
    features?: string[];
  }>;

  createdAt: Date;

  updatedAt: Date;
}

const UserSchema =
  new Schema<IUser>(
    {
      discordId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      username: {
        type: String,
        required: true,
      },

      globalName: {
        type: String,
      },

      avatar: {
        type: String,
      },

      accessToken: {
        type: String,
        select: false,
      },

      refreshToken: {
        type: String,
        select: false,
      },

      tokenExpiresAt: {
        type: Date,
      },

      /*
       * =====================================================
       * OMNIX PLATFORM PERMISSIONS
       * =====================================================
       */

      isAdmin: {
        type: Boolean,
        default: false,
        index: true,
      },

      isPremium: {
        type: Boolean,
        default: false,
        index: true,
      },

      /*
       * =====================================================
       * DISCORD GUILDS
       * =====================================================
       */

      guilds: [
        {
          id: {
            type: String,
          },

          name: {
            type: String,
          },

          icon: {
            type: String,
          },

          owner: {
            type: Boolean,
            default: false,
          },

          permissions: {
            type: String,
            default: '0',
          },

          features: {
            type: [String],
            default: [],
          },
        },
      ],
    },

    {
      timestamps: true,
    },
  );

export const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>(
    'User',
    UserSchema,
  );

export default User;