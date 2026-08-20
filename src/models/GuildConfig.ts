import mongoose, { Schema, Document } from 'mongoose';

/* =========================================================
   TYPES
========================================================= */

export interface IModuleConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface IGuildModules {
  moderation: IModuleConfig;
  tickets: IModuleConfig;
  giveaways: IModuleConfig;
  suggestions: IModuleConfig;
  logs: IModuleConfig;
  welcome: IModuleConfig;
  goodbye: IModuleConfig;
  autoRole: IModuleConfig;
  antiRaid: IModuleConfig;
  antiSpam: IModuleConfig;
  antiLink: IModuleConfig;
  autoMod: IModuleConfig;
  levels: IModuleConfig;
  economy: IModuleConfig;
  music: IModuleConfig;
  ai: IModuleConfig;
  counting: IModuleConfig;
  autoReactions: IModuleConfig;
  scheduledMessages: IModuleConfig;
  polls: IModuleConfig;
  verification: IModuleConfig;
  backups: IModuleConfig;
  customCommands: IModuleConfig;
  statistics: IModuleConfig;
  ping: IModuleConfig;
  honeypot: IModuleConfig;

  [key: string]: IModuleConfig;
}

export interface IGuildPremium {
  isPremium: boolean;
  tier: string;
  expiresAt: Date | null;
}

export interface IGuildConfig extends Document {
  guildId: string;

  prefix: string;
  language: string;

  premium: IGuildPremium;

  modules: IGuildModules;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   DEFAULT MODULES
========================================================= */

const defaultModules: Record<string, any> = {
  moderation: {
    enabled: true,
  },

  tickets: {
    enabled: false,
    categoryId: null,
    supportRoleId: null,
  },

  giveaways: {
    enabled: false,
  },

  suggestions: {
    enabled: false,
  },

  logs: {
    enabled: false,
    channelId: null,
  },

  welcome: {
    enabled: false,
    channelId: null,
    message: null,
  },

  goodbye: {
    enabled: false,
    channelId: null,
    message: null,
  },

  autoRole: {
    enabled: false,
    roleId: null,
  },

  antiRaid: {
    enabled: false,
  },

  antiSpam: {
    enabled: false,
  },

  antiLink: {
    enabled: false,
  },

  autoMod: {
    enabled: false,
  },

  levels: {
    enabled: false,
  },

  economy: {
    enabled: false,
  },

  music: {
    enabled: false,
  },

  ai: {
    enabled: false,
    systemPrompt:
      'Tu es OMNIX, un assistant intelligent pour un serveur Discord. Réponds clairement, utilement et en français.',
  },

  counting: {
    enabled: false,
    channelId: null,
  },

  autoReactions: {
    enabled: false,
  },

  scheduledMessages: {
    enabled: false,
  },

  polls: {
    enabled: false,
  },

  verification: {
    enabled: false,
  },

  backups: {
    enabled: false,
  },

  customCommands: {
    enabled: false,
  },

  statistics: {
    enabled: false,
  },

  ping: {
    enabled: true,
  },

  honeypot: {
    enabled: false,
    channelId: null,
  },
};

/* =========================================================
   SCHEMA
========================================================= */

const GuildConfigSchema = new Schema<IGuildConfig>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    prefix: {
      type: String,
      default: '!cm-',
    },

    language: {
      type: String,
      default: 'fr',
    },

    premium: {
      isPremium: {
        type: Boolean,
        default: false,
      },

      tier: {
        type: String,
        default: 'free',
      },

      expiresAt: {
        type: Date,
        default: null,
      },
    },

    modules: {
      type: Schema.Types.Mixed,
      default: defaultModules,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

/* =========================================================
   MODEL
========================================================= */

/*
 * IMPORTANT :
 *
 * On exporte les DEUX formes :
 *
 * import GuildConfig from ...
 *
 * ET
 *
 * import { GuildConfig } from ...
 *
 * Cela évite les erreurs actuelles dans tes commandes/events.
 */

export const GuildConfig =
  mongoose.models.GuildConfig ||
  mongoose.model<IGuildConfig>(
    'GuildConfig',
    GuildConfigSchema
  );

export default GuildConfig;