import mongoose, { Document, Model, Schema } from 'mongoose';
export interface IEmailAttachment { name: string; contentType?: string; size?: number; url?: string; }
export interface IEmailMessage extends Document {
  threadId: mongoose.Types.ObjectId;
  direction: 'inbound'|'outbound';
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html?: string;
  attachments: IEmailAttachment[];
  providerId?: string;
  createdAt: Date;
}
const attachment = new Schema<IEmailAttachment>({ name: String, contentType: String, size: Number, url: String }, { _id: false });
const schema = new Schema<IEmailMessage>({
  threadId: { type: Schema.Types.ObjectId, ref: 'EmailThread', required: true, index: true },
  direction: { type: String, enum: ['inbound','outbound'], required: true },
  from: { type: String, required: true },
  to: { type: [String], default: [] },
  cc: { type: [String], default: [] },
  subject: { type: String, required: true, maxlength: 500 },
  text: { type: String, default: '', maxlength: 200000 },
  html: { type: String, maxlength: 500000 },
  attachments: { type: [attachment], default: [] },
  providerId: { type: String, index: true, sparse: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
schema.index({ threadId: 1, createdAt: 1 });
export const EmailMessage: Model<IEmailMessage> = mongoose.models.EmailMessage || mongoose.model<IEmailMessage>('EmailMessage', schema);
export default EmailMessage;
