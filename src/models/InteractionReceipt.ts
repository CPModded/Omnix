import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IInteractionReceipt extends Document {
  interactionId: string;
  kind: string;
  createdAt: Date;
  expiresAt: Date;
}

const InteractionReceiptSchema = new Schema<IInteractionReceipt>({
  interactionId: { type: String, required: true, unique: true, index: true },
  kind: { type: String, required: true, default: 'interaction' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
});
InteractionReceiptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const InteractionReceipt: Model<IInteractionReceipt> = mongoose.models.InteractionReceipt || mongoose.model<IInteractionReceipt>('InteractionReceipt', InteractionReceiptSchema);
export default InteractionReceipt;
