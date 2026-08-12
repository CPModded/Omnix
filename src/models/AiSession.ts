// src/models/AiSession.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAiSession extends Document {
  userId: string;
  guildId: string;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  updatedAt: Date;
}

const AiSessionSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
      content: { type: String, required: true }
    }
  ],
  updatedAt: { type: Date, default: Date.now, expires: 1800 } // TTL : s'efface automatiquement après 30 min d'inactivité
});

// Index composé unique : ISOLE strictement les conversations par UTILISATEUR et par SERVEUR
AiSessionSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export default mongoose.model<IAiSession>('AiSession', AiSessionSchema);