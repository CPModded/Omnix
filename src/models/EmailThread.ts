import mongoose, { Document, Model, Schema } from 'mongoose';
export interface IEmailThread extends Document {
  subject: string;
  participants: string[];
  status: 'open'|'closed'|'spam';
  assignedTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<IEmailThread>({
  subject: { type: String, required: true, maxlength: 500 },
  participants: { type: [String], default: [] },
  status: { type: String, enum: ['open','closed','spam'], default: 'open', index: true },
  assignedTo: { type: String, default: null },
}, { timestamps: true, versionKey: false });
schema.index({ updatedAt: -1 });
export const EmailThread: Model<IEmailThread> = mongoose.models.EmailThread || mongoose.model<IEmailThread>('EmailThread', schema);
export default EmailThread;
