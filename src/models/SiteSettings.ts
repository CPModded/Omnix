import mongoose, { Document, Model, Schema } from 'mongoose';

export type BotActivityType = 'Playing' | 'Watching' | 'Listening' | 'Competing';

export interface ISiteSettings extends Document {
  key: string;
  maintenance: boolean;
  maintenanceMessage: string;
  activityEnabled: boolean;
  activityType: BotActivityType;
  activityMessage: string;
  botStatus: 'online' | 'idle' | 'dnd' | 'invisible';
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISiteSettings>({
  key: { type: String, default: 'global', unique: true, index: true },
  maintenance: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'OMNIX est actuellement en maintenance. Merci de patienter.' },
  activityEnabled: { type: Boolean, default: true },
  activityType: { type: String, enum: ['Playing', 'Watching', 'Listening', 'Competing'], default: 'Playing' },
  activityMessage: { type: String, default: 'OMNIX • /help' },
  botStatus: { type: String, enum: ['online', 'idle', 'dnd', 'invisible'], default: 'online' },
  updatedBy: { type: String, default: null },
}, { timestamps: true, versionKey: false });

export const SiteSettings: Model<ISiteSettings> = mongoose.models.SiteSettings || mongoose.model<ISiteSettings>('SiteSettings', schema);
export default SiteSettings;
