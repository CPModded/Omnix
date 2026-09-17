import mongoose, { Document, Model, Schema } from 'mongoose';

export type GuildTicketStatus = 'open' | 'closed';

export interface IGuildTicket extends Document {
  guildId: string;
  ticketNumber: number;
  channelId: string;
  userId: string;
  username: string;
  subject: string;
  status: GuildTicketStatus;
  claimedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  closedBy?: string | null;
}

const GuildTicketSchema = new Schema<IGuildTicket>({
  guildId: { type: String, required: true, index: true },
  ticketNumber: { type: Number, required: true, min: 1 },
  channelId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true, maxlength: 100 },
  subject: { type: String, required: true, maxlength: 160 },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  claimedBy: { type: String, default: null },
  closedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
}, { timestamps: true, strict: true });

GuildTicketSchema.index({ guildId: 1, ticketNumber: 1 }, { unique: true });
GuildTicketSchema.index({ guildId: 1, userId: 1, status: 1 });
GuildTicketSchema.index({ guildId: 1, status: 1, updatedAt: -1 });

export const GuildTicket: Model<IGuildTicket> = mongoose.models.GuildTicket || mongoose.model<IGuildTicket>('GuildTicket', GuildTicketSchema);
export default GuildTicket;
