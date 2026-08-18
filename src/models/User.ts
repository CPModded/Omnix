import mongoose, { Schema, Document } from 'mongoose';

export interface ILicense {
  licenseKey: string;
  tier: string;
  status: string;
}

export interface IUser extends Document {
  discordId: string;
  username: string;
  avatar?: string;
  isAdmin: boolean;
  rewards: {
    points: number;
  };
  licenses: ILicense[];
  accessToken?: string; // 🟢 AJOUT CRUCIAL : Déclaration de type pour votre session Discord
  createdAt: Date;
}

const LicenseSchema = new Schema({
  licenseKey: { type: String, required: true },
  tier: { type: String, required: true, default: 'premium' },
  status: { type: String, required: true, default: 'active' }
});

const UserSchema = new Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  avatar: { type: String, default: null },
  isAdmin: { type: Boolean, default: false },
  rewards: {
    points: { type: Number, default: 0 }
  },
  licenses: [LicenseSchema],
  accessToken: { type: String, default: null }, // 🟢 AJOUT CRUCIAL : Autorise Mongoose à sauvegarder la clé d'accès Discord
  createdAt: { type: Date, default: Date.now }
});

// Export nommé conforme aux importations de vos routeurs d'administration ({ User })
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);