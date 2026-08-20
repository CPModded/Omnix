import { Schema, model, Document } from 'mongoose';

export interface IPromoCode extends Document {
  code: string; // Ex: CODESUMMER20
  discountType: 'percentage' | 'fixed';
  discountValue: number; // Valeur brute (ex: 20 pour -20% ou -20€)
  maxUses: number;
  usesCount: number;
  expiresAt: Date;
  isActive: boolean;
}

const PromoCodeSchema = new Schema<IPromoCode>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true },
  maxUses: { type: Number, default: 0 }, // 0 signifie utilisation illimitée
  usesCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const PromoCode = model<IPromoCode>('PromoCode', PromoCodeSchema);