import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';
/* =========================================================
   TYPES
========================================================= */
export interface IGuildConfig extends Document {
  guildId: string;
  prefix: string;
  language: string;
  modules: {
    moderation: {
      enabled: boolean;
    };
    tickets: {
      enabled: boolean;
      categoryId?: string;
      supportRoleId?: string;
    };
    giveaways: {
      enabled: boolean;
    };
    suggestions: {
      enabled: boolean;
    };
    logs: {
      enabled: boolean;
      channelId?: string;
    };
    welcome: {
      enabled: boolean;
      channelId?: string;
      message?: string;
    };
    goodbye: {
      enabled: boolean;
      channelId?: string;
      message?: string;
    };
    autoRole: {
      enabled: boolean;
      roleId?: string;
    };
    antiRaid: {
      enabled: boolean;
    };
    antiSpam: {
      enabled: boolean;
    };
    antiLink: {
      enabled: boolean;
    };
    autoMod: {
      enabled: boolean;
    };
    levels: {
      enabled: boolean;
    };
    economy: {
      enabled: boolean;
    };
    music: {
      enabled: boolean;
    };
    ai: {
      enabled: boolean;
      systemPrompt: string;
    };
    counting: {
      enabled: boolean;
      channelId?: string;
    };
    autoReactions: {
      enabled: boolean;
    };
    scheduledMessages: {
      enabled: boolean;
    };
    polls: {
      enabled: boolean;
    };
    verification: {
      enabled: boolean;
    };
    backups: {
      enabled: boolean;
    };
    customCommands: {
      enabled: boolean;
    };
    statistics: {
      enabled: boolean;
    };
    ping: {
      enabled: boolean;
    };
    honeypot: {
      enabled: boolean;
      channelId?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}
/* =========================================================
   HELPERS
========================================================= */
const enabledModule = (
  defaultEnabled = false,
) => ({
  enabled: {
    type: Boolean,
    default: defaultEnabled,
  },
});
/* =========================================================
   SCHEMA
========================================================= */
const GuildConfigSchema =
  new Schema<IGuildConfig>(
    {
      /* =====================================================
         GUILD
      ===================================================== */
      guildId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },
      /* =====================================================
         GENERAL
      ===================================================== */
      prefix: {
        type: String,
        default: '!cm-',
        trim: true,
      },
      language: {
        type: String,
        default: 'fr',
        trim: true,
      },
      /* =====================================================
         MODULES
      ===================================================== */
      modules: {
        /* ---------------------------------------------------
           MODERATION
        --------------------------------------------------- */
        moderation: enabledModule(true),
        /* ---------------------------------------------------
           TICKETS
        --------------------------------------------------- */
        tickets: {
          enabled: {
            type: Boolean,
            default: false,
          },
          categoryId: {
            type: String,
          },
          supportRoleId: {
            type: String,
          },
        },
        /* ---------------------------------------------------
           GIVEAWAYS
        --------------------------------------------------- */
        giveaways: enabledModule(),
        /* ---------------------------------------------------
           SUGGESTIONS
        --------------------------------------------------- */
        suggestions: enabledModule(),
        /* ---------------------------------------------------
           LOGS
        --------------------------------------------------- */
        logs: {
          enabled: {
            type: Boolean,
            default: false,
          },
          channelId: {
            type: String,
          },
        },
        /* ---------------------------------------------------
           WELCOME
        --------------------------------------------------- */
        welcome: {
          enabled: {
            type: Boolean,
            default: false,
          },
          channelId: {
            type: String,
          },
          message: {
            type: String,
          },
        },
        /* ---------------------------------------------------
           GOODBYE
        --------------------------------------------------- */
        goodbye: {
          enabled: {
            type: Boolean,
            default: false,
          },
          channelId: {
            type: String,
          },
          message: {
            type: String,
          },
        },
        /* ---------------------------------------------------
           AUTO ROLE
        --------------------------------------------------- */
        autoRole: {
          enabled: {
            type: Boolean,
            default: false,
          },
          roleId: {
            type: String,
          },
        },
        /* ---------------------------------------------------
           SECURITY
        --------------------------------------------------- */
        antiRaid: enabledModule(),
        antiSpam: enabledModule(),
        antiLink: enabledModule(),
        autoMod: enabledModule(),
        /* ---------------------------------------------------
           LEVELS
        --------------------------------------------------- */
        levels: enabledModule(),
        /* ---------------------------------------------------
           ECONOMY
        --------------------------------------------------- */
        economy: enabledModule(),
        /* ---------------------------------------------------
           MUSIC
        --------------------------------------------------- */
        music: enabledModule(),
        /* ---------------------------------------------------
           AI
        --------------------------------------------------- */
        ai: {
          enabled: {
            type: Boolean,
            default: false,
          },
          systemPrompt: {
            type: String,
            default:
              'Tu es OMNIX, un assistant intelligent pour un serveur Discord. Réponds clairement, utilement et en français.',
          },
        },
        /* ---------------------------------------------------
           COUNTING
        --------------------------------------------------- */
        counting: {
          enabled: {
            type: Boolean,
            default: false,
          },
          channelId: {
            type: String,
          },
        },
        /* ---------------------------------------------------
           AUTO REACTIONS
        --------------------------------------------------- */
        autoReactions: enabledModule(),
        /* ---------------------------------------------------
           SCHEDULED MESSAGES
        --------------------------------------------------- */
        scheduledMessages: enabledModule(),
        /* ---------------------------------------------------
           POLLS
        --------------------------------------------------- */
        polls: enabledModule(),
        /* ---------------------------------------------------
           VERIFICATION
        --------------------------------------------------- */
        verification: enabledModule(),
        /* ---------------------------------------------------
           BACKUPS
        --------------------------------------------------- */
        backups: enabledModule(),
        /* ---------------------------------------------------
           CUSTOM COMMANDS
        --------------------------------------------------- */
        customCommands: enabledModule(),
        /* ---------------------------------------------------
           STATISTICS
        --------------------------------------------------- */
        statistics: enabledModule(),
        /* ---------------------------------------------------
           PING
        --------------------------------------------------- */
        ping: enabledModule(true),
        /* ---------------------------------------------------
           HONEYPOT
        --------------------------------------------------- */
        honeypot: {
          enabled: {
            type: Boolean,
            default: false,
          },
          channelId: {
            type: String,
          },
        },
      },
    },
    {
      timestamps: true,
      minimize: false,
      strict: true,
    },
  );
/* =========================================================
   MODEL
========================================================= */
/*
 * IMPORTANT :
 *
 * Ne PAS ajouter :
 *
 * GuildConfigSchema.index({ guildId: 1 })
 *
 * car guildId possède déjà index: true + unique: true.
 */
export const GuildConfig: Model<IGuildConfig> =
  mongoose.models.GuildConfig ||
  mongoose.model<IGuildConfig>(
    'GuildConfig',
    GuildConfigSchema,
  );
/* =========================================================
   EXPORT
========================================================= */
export default GuildConfig;