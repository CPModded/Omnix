import { Schema, model, Document } from 'mongoose';

export interface IGuildConfig extends Document {
  guildId: string;
  premium: {
    isPremium: boolean;
    tier: 'free' | 'premium' | 'lifetime' | 'enterprise';
    expiresAt: Date | null;
  };
  modules: {
    moderation: { enabled: boolean; logChannelId: string | null };
    tickets: { enabled: boolean; categoryId: string | null; counter: number };
    economy: { enabled: boolean; currencySymbol: string };
    ai: { enabled: boolean; systemPrompt: string; contextLimit: number };
  };
  customCommands: Array<{
    trigger: string;
    response: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const GuildConfigSchema = new Schema<IGuildConfig>({
  guildId: { type: String, required: true, unique: true, index: true },
  premium: {
    isPremium: { type: Boolean, default: false },
    tier: { type: String, enum: ['free', 'premium', 'lifetime', 'enterprise'], default: 'free' },
    expiresAt: { type: Date, default: null }
  },
  modules: {
    moderation: {
      enabled: { type: Boolean, default: false },
      logChannelId: { type: String, default: null }
    },
    tickets: {
      enabled: { type: Boolean, default: false },
      categoryId: { type: String, default: null },
      counter: { type: Number, default: 0 }
    },
    economy: {
      enabled: { type: Boolean, default: false },
      currencySymbol: { type: String, default: '$' }
    },
    ai: {
      enabled: { type: Boolean, default: false },
      systemPrompt: { type: String, default: "Tu es un assistant utile sur ce serveur Discord." },
      contextLimit: { type: Number, default: 10 }
    }
  },
  customCommands: [{
    trigger: { type: String, required: true },
    response: { type: String, required: true }
  }]
}, { timestamps: true });

export const GuildConfig = model<IGuildConfig>('GuildConfig', GuildConfigSchema);