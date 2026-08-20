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

  guilds: Array<{
    id: string;
    name: string;
    icon?: string | null;
    owner?: boolean;
    permissions?: string;
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

      guilds: [
        {
          id: String,

          name: String,

          icon: String,

          owner: Boolean,

          permissions: String,
        },
      ],
    },

    {
      timestamps: true,
    }
  );


export const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>(
    'User',
    UserSchema
  );


export default User;