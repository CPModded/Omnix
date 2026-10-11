import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITicketPanelLock extends Document {
  guildId: string;
  lockedUntil: Date;
  updatedAt: Date;
}

const TicketPanelLockSchema = new Schema<ITicketPanelLock>({
  guildId: { type: String, required: true, unique: true, index: true },
  lockedUntil: { type: Date, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const TicketPanelLock: Model<ITicketPanelLock> =
  mongoose.models.TicketPanelLock || mongoose.model<ITicketPanelLock>('TicketPanelLock', TicketPanelLockSchema);

export default TicketPanelLock;
