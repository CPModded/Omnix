import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
  isBlacklisted: boolean; // Ajout : Bloquer l'accès à la plateforme
  rewards: {
    points: number;
    referralsCount: number;
    claimedBadges: string[];
  };
  licenses: Array<{
    licenseKey: string;
    tier: 'premium' | 'lifetime' | 'enterprise';
    status: 'active' | 'used' | 'expired';
    activatedGuildId: string | null;
    expiresAt: Date | null;
  }>;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  avatar: { type: String, default: null },
  isAdmin: { type: Boolean, default: false },
  isBlacklisted: { type: Boolean, default: false }, // Faux par défaut
  rewards: {
    points: { type: Number, default: 0 },
    referralsCount: { type: Number, default: 0 },
    claimedBadges: [{ type: String }]
  },
  licenses: [{
    licenseKey: { type: String, required: true },
    tier: { type: String, enum: ['premium', 'lifetime', 'enterprise'], required: true },
    status: { type: String, enum: ['active', 'used', 'expired'], default: 'active' },
    activatedGuildId: { type: String, default: null },
    expiresAt: { type: Date, default: null }
  }]
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);