import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IWelcomeDispatch extends Document {
  guildId: string;
  memberId: string;
  createdAt: Date;
  expiresAt: Date;
}

const WelcomeDispatchSchema = new Schema<IWelcomeDispatch>({
  guildId: { type: String, required: true, index: true },
  memberId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
});
WelcomeDispatchSchema.index({ guildId: 1, memberId: 1 }, { unique: true });
WelcomeDispatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WelcomeDispatch: Model<IWelcomeDispatch> = mongoose.models.WelcomeDispatch || mongoose.model<IWelcomeDispatch>('WelcomeDispatch', WelcomeDispatchSchema);
export default WelcomeDispatch;
