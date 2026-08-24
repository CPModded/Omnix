import mongoose, { Document, Model, Schema } from 'mongoose';

export type PlatformEventType =
  | 'user_registered'
  | 'user_login'
  | 'guild_added'
  | 'guild_removed'
  | 'ai_request'
  | 'ai_error'
  | 'payment'
  | 'subscription';

export interface IPlatformEvent extends Document {
  type: PlatformEventType;
  userId?: string;
  guildId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const schema = new Schema<IPlatformEvent>({
  type: { type: String, enum: ['user_registered','user_login','guild_added','guild_removed','ai_request','ai_error','payment','subscription'], required: true, index: true },
  userId: { type: String, index: true },
  guildId: { type: String, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

schema.index({ type: 1, createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ guildId: 1, createdAt: -1 });

export const PlatformEvent: Model<IPlatformEvent> = mongoose.models.PlatformEvent || mongoose.model<IPlatformEvent>('PlatformEvent', schema);
export default PlatformEvent;
