import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPartner extends Document {
  title: string;
  description: string;
  discordUrl: string;
  imageUrl?: string;
  imageData?: string;
  featured: boolean;
  founderName?: string;
  founderDiscordId?: string;
  founderRole?: string;
  founderNote?: string;
  adEnabled: boolean;
  adTitle?: string;
  adText?: string;
  adImageUrl?: string;
  adImageData?: string;
  adUrl?: string;
  adButtonText?: string;
  adExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerSchema = new Schema<IPartner>({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  discordUrl: { type: String, required: true, trim: true, maxlength: 500 },
  // Legacy URL kept only for backward compatibility with old partner records.
  imageUrl: { type: String, default: '', trim: true, maxlength: 2000 },
  imageData: { type: String, default: '', trim: true, maxlength: 2000000 },
  featured: { type: Boolean, default: false, index: true },
  founderName: { type: String, default: '', trim: true, maxlength: 120 },
  founderDiscordId: { type: String, default: '', trim: true, maxlength: 30 },
  founderRole: { type: String, default: 'Founder', trim: true, maxlength: 120 },
  founderNote: { type: String, default: '', trim: true, maxlength: 500 },
  adEnabled: { type: Boolean, default: false, index: true },
  adTitle: { type: String, default: '', trim: true, maxlength: 160 },
  adText: { type: String, default: '', trim: true, maxlength: 1000 },
  // Legacy URL kept only for backward compatibility with old partner ads.
  adImageUrl: { type: String, default: '', trim: true, maxlength: 2000 },
  adImageData: { type: String, default: '', trim: true, maxlength: 2000000 },
  adUrl: { type: String, default: '', trim: true, maxlength: 2000 },
  adButtonText: { type: String, default: 'Découvrir', trim: true, maxlength: 80 },
  adExpiresAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

PartnerSchema.index({ featured: -1, createdAt: -1 });

export const Partner: Model<IPartner> = mongoose.models.Partner || mongoose.model<IPartner>('Partner', PartnerSchema);
export default Partner;
