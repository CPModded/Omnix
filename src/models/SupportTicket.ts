import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISupportMessage {
  authorId: string;
  authorName: string;
  authorRole: 'user' | 'support' | 'moderator' | 'admin' | 'super_admin' | 'owner';
  content: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  ticketNumber: number;
  userId: string;
  username: string;
  subject: string;
  status: 'open' | 'closed';
  messages: ISupportMessage[];
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  closedBy?: string | null;
}

const SupportMessageSchema = new Schema<ISupportMessage>({
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String, enum: ['user','support','moderator','admin','super_admin','owner'], required: true },
  content: { type: String, required: true, maxlength: 4000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const SupportTicketSchema = new Schema<ISupportTicket>({
  ticketNumber: { type: Number, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  subject: { type: String, required: true, maxlength: 160 },
  status: { type: String, enum: ['open','closed'], default: 'open', index: true },
  messages: { type: [SupportMessageSchema], default: [] },
  closedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
}, { timestamps: true, strict: true });

export const SupportTicket: Model<ISupportTicket> = mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
export default SupportTicket;
