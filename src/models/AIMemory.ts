import { Schema, model, Document } from 'mongoose';

export interface IAIMemory extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  updatedAt: Date;
}

const AIMemorySchema = new Schema<IAIMemory>({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Index composé pour optimiser la recherche de l'historique d'un salon ou utilisateur spécifique sur un serveur donné
AIMemorySchema.index({ guildId: 1, channelId: 1 });

export const AIMemory = model<IAIMemory>('AIMemory', AIMemorySchema);