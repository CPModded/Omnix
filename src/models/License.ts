import { Schema, model, Document } from 'mongoose';

export interface ILicense extends Document {
  key: string; // Clé unique générée (ex: XXXX-XXXX-XXXX-XXXX)
  tier: 'premium' | 'lifetime' | 'enterprise';
  status: 'active' | 'used' | 'suspended' | 'expired';
  buyerId: string; // Discord ID de l'acheteur
  activatedGuildId: string | null; // ID du serveur où la licence est injectée
  activatedAt: Date | null;
  expiresAt: Date | null;
  durationInDays: number; // 0 pour Lifetime, sinon durée en jours (ex: 30)
  createdAt: Date;
}

const LicenseSchema = new Schema<ILicense>({
  key: { type: String, required: true, unique: true, index: true },
  tier: { type: String, enum: ['premium', 'lifetime', 'enterprise'], required: true },
  status: { type: String, enum: ['active', 'used', 'suspended', 'expired'], default: 'active' },
  buyerId: { type: String, required: true },
  activatedGuildId: { type: String, default: null },
  activatedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  durationInDays: { type: Number, required: true } // ex: 30, 365, ou 0 pour infini
}, { timestamps: true });

export const License = model<ILicense>('License', LicenseSchema);