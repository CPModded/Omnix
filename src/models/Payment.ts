import mongoose, { Document, Model, Schema } from 'mongoose';

export type PaymentStatus = 'paid' | 'failed' | 'refunded' | 'pending';
export interface IPayment extends Document {
  userId: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  tier?: string;
  durationInDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPayment>({
  userId: { type: String, required: true, index: true },
  stripeSessionId: { type: String, sparse: true, unique: true },
  stripeEventId: { type: String, sparse: true, unique: true },
  amount: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'eur', lowercase: true },
  status: { type: String, enum: ['paid','failed','refunded','pending'], default: 'paid', index: true },
  tier: String,
  durationInDays: { type: Number, min: 0 },
}, { timestamps: true, versionKey: false });
schema.index({ createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });
export const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', schema);
export default Payment;
