import { Schema, model, Document } from 'mongoose';

export interface IBackup extends Document {
  guildId: string;
  creatorId: string; // Discord ID de l'utilisateur qui a déclenché la sauvegarde
  backupData: string; // Configuration sérialisée en JSON String
  createdAt: Date;
}

const BackupSchema = new Schema<IBackup>({
  guildId: { type: String, required: true, index: true },
  creatorId: { type: String, required: true },
  backupData: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const Backup = model<IBackup>('Backup', BackupSchema);