import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ISequence extends Document {
  _id: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const SequenceSchema = new Schema<ISequence>({
  _id: { type: String, required: true },
  value: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });

export const Sequence: Model<ISequence> = mongoose.models.Sequence || mongoose.model<ISequence>('Sequence', SequenceSchema);
export default Sequence;
