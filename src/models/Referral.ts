import mongoose, { Document, Model, Schema } from 'mongoose';

export type ReferralStatus = 'pending' | 'validated' | 'rejected';

export interface IReferral extends Document {
  code: string;
  referrerId: string;
  referredId?: string | null;
  status: ReferralStatus;
  source?: string;
  rewardDays: number;
  rewardGranted: boolean;
  joinedAt?: Date | null;
  validatedAt?: Date | null;
  rewardedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>({
  code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
  referrerId: { type: String, required: true, index: true },
  referredId: { type: String, default: null, index: true, sparse: true },
  status: { type: String, enum: ['pending','validated','rejected'], default: 'pending', index: true },
  source: { type: String, default: 'web' },
  rewardDays: { type: Number, default: 7, min: 1, max: 365 },
  rewardGranted: { type: Boolean, default: false, index: true },
  joinedAt: { type: Date, default: null },
  validatedAt: { type: Date, default: null },
  rewardedAt: { type: Date, default: null },
}, { timestamps: true });

ReferralSchema.index({ referrerId: 1, referredId: 1 }, { unique: true, sparse: true });

const Referral: Model<IReferral> =
  (mongoose.models.Referral as Model<IReferral> | undefined) || mongoose.model<IReferral>('Referral', ReferralSchema);

export { Referral };
export default Referral;
