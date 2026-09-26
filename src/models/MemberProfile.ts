import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IMemberProfile extends Document {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messages: number;
  lastXpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMemberProfile>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  xp: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 0, min: 0 },
  messages: { type: Number, default: 0, min: 0 },
  lastXpAt: { type: Date, default: null },
}, { timestamps: true, collection: 'member_profiles' });

schema.index({ guildId: 1, userId: 1 }, { unique: true });
schema.index({ guildId: 1, xp: -1 });

const MemberProfile: Model<IMemberProfile> = mongoose.models.MemberProfile ?? mongoose.model<IMemberProfile>('MemberProfile', schema);
export { MemberProfile };
export default MemberProfile;
