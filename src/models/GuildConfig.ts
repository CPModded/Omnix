/**
 * ====================================================================
 * SCHÉMA DE CONFIGURATION DES SERVEURS (OMNIX CORE - TICKETS ULTRA PRO)
 * ====================================================================
 */

import { Schema, model, Document } from 'mongoose';

export interface ITicketCategory {
  id: string;             // Identifiant unique (ex: support_tech)
  name: string;           // Nom de l'affichage (ex: Support technique)
  emoji: string;          // Émoji d'affichage (ex: 🔧)
  type: 'category' | 'channel' | 'thread'; // Type d'ouverture du ticket
  targetId: string | null; // ID Discord du salon ou de la catégorie de destination
  welcomeMessage: string; // Message d'accueil personnalisé modifiable depuis le site
}

export interface IGuildConfig extends Document {
  guildId: string;
  premium: {
    isPremium: boolean;
    tier: 'free' | 'premium' | 'lifetime' | 'enterprise';
    expiresAt: Date | null;
  };
  antiRaid: {
    enabled: boolean;
    thresholdCount: number;
    thresholdSeconds: number;
  };
  antiSpam: {
    enabled: boolean;
    maxMessages: number;
    windowSeconds: number;
  };
  antiLink: {
    enabled: boolean;
    allowedDomains: string[];
  };
  autoMod: {
    enabled: boolean;
    blacklistedWords: string[];
  };
  levels: {
    enabled: boolean;
    xpPerMessage: number;
    rewardRoles: { level: number; roleId: string }[];
  };
  economy: {
    enabled: boolean;
    currencySymbol: string;
    workCooldownMinutes: number;
  };
  music: {
    enabled: boolean;
  };
  ai: {
    enabled: boolean;
    systemPrompt: string;
    contextLimit: number;
  };
  counting: {
    enabled: boolean;
    channelId: string | null;
    currentNumber: number;
  };
  autoReactions: {
    enabled: boolean;
    rules: { trigger: string; emojis: string[] }[];
  };
  scheduledMessages: {
    enabled: boolean;
    list: { message: string; cronPattern: string; channelId: string }[];
  };
  polls: {
    enabled: boolean;
  };
  verification: {
    enabled: boolean;
    roleId: string | null;
  };
  backups: {
    enabled: boolean;
  };
  customCommands: {
    enabled: boolean;
    list: { trigger: string; response: string }[];
  };
  statistics: {
    enabled: boolean;
  };
  ping: {
    enabled: boolean;
  };
  honeypot: {
    enabled: boolean;
    channelId: string | null;
  };
  tickets: {
    enabled: boolean;
    categories: ITicketCategory[];
  };
}

const TicketCategorySchema = new Schema<ITicketCategory>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  emoji: { type: String, default: '' },
  type: { type: String, enum: ['category', 'channel', 'thread'], default: 'channel' },
  targetId: { type: String, default: null },
  welcomeMessage: { type: String, default: 'Bienvenue dans votre ticket.' }
}, { _id: false });

const GuildConfigSchema = new Schema<IGuildConfig>({
  guildId: { type: String, required: true, unique: true, index: true },
  premium: {
    isPremium: { type: Boolean, default: false },
    tier: { type: String, enum: ['free', 'premium', 'lifetime', 'enterprise'], default: 'free' },
    expiresAt: { type: Date, default: null }
  },
  antiRaid: {
    enabled: { type: Boolean, default: false },
    thresholdCount: { type: Number, default: 5 },
    thresholdSeconds: { type: Number, default: 10 }
  },
  antiSpam: {
    enabled: { type: Boolean, default: false },
    maxMessages: { type: Number, default: 5 },
    windowSeconds: { type: Number, default: 5 }
  },
  antiLink: {
    enabled: { type: Boolean, default: false },
    allowedDomains: [{ type: String }]
  },
  autoMod: {
    enabled: { type: Boolean, default: false },
    blacklistedWords: [{ type: String }]
  },
  levels: {
    enabled: { type: Boolean, default: false },
    xpPerMessage: { type: Number, default: 15 },
    rewardRoles: [{
      level: { type: Number, required: true },
      roleId: { type: String, required: true }
    }]
  },
  economy: {
    enabled: { type: Boolean, default: false },
    currencySymbol: { type: String, default: '$' },
    workCooldownMinutes: { type: Number, default: 60 }
  },
  music: {
    enabled: { type: Boolean, default: false }
  },
  ai: {
    enabled: { type: Boolean, default: false },
    systemPrompt: { type: String, default: 'Tu es un assistant utile.' },
    contextLimit: { type: Number, default: 10 }
  },
  counting: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    currentNumber: { type: Number, default: 0 }
  },
  autoReactions: {
    enabled: { type: Boolean, default: false },
    rules: [{
      trigger: { type: String, required: true },
      emojis: [{ type: String }]
    }]
  },
  scheduledMessages: {
    enabled: { type: Boolean, default: false },
    list: [{
      message: { type: String, required: true },
      cronPattern: { type: String, required: true },
      channelId: { type: String, required: true }
    }]
  },
  polls: {
    enabled: { type: Boolean, default: false }
  },
  verification: {
    enabled: { type: Boolean, default: false },
    roleId: { type: String, default: null }
  },
  backups: {
    enabled: { type: Boolean, default: false }
  },
  customCommands: {
    enabled: { type: Boolean, default: false },
    list: [{
      trigger: { type: String, required: true },
      response: { type: String, required: true }
    }]
  },
  statistics: {
    enabled: { type: Boolean, default: false }
  },
  ping: {
    enabled: { type: Boolean, default: true }
  },
  honeypot: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null }
  },
  tickets: {
    enabled: { type: Boolean, default: false },
    categories: [TicketCategorySchema]
  }
}, { timestamps: true });

export const GuildConfig = model<IGuildConfig>('GuildConfig', GuildConfigSchema);