import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPartner extends Document {
  title: string;
  description: string;
  discordUrl: string;
  imageUrl: string;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerSchema = new Schema<IPartner>({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  discordUrl: { type: String, required: true, trim: true, maxlength: 500 },
  imageUrl: { type: String, required: true, trim: true, maxlength: 2000 },
  featured: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false });

PartnerSchema.index({ featured: -1, createdAt: -1 });

export const Partner: Model<IPartner> = mongoose.models.Partner || mongoose.model<IPartner>('Partner', PartnerSchema);
export default Partner;
