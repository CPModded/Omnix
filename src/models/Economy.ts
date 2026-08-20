import { Schema, model, Document } from 'mongoose';

export interface IEconomy extends Document {
  guildId: string;
  userId: string;
  wallet: number;
  bank: number;
  lastWork: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EconomySchema = new Schema<IEconomy>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  wallet: { type: Number, default: 100 }, // Solde de départ
  bank: { type: Number, default: 0 },
  lastWork: { type: Date, default: null }
}, { timestamps: true });

// Garantit un seul compte d'économie par utilisateur et par serveur
EconomySchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const Economy = model<IEconomy>('Economy', EconomySchema);