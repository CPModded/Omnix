import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* =========================================================
   OMNIX — GUILD CONFIGURATION MODEL
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export type GuildPlan =
  | 'free'
  | 'premium'
  | 'lifetime'
  | 'enterprise';

export type LogLevel =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

/* =========================================================
   MODULE CONFIGURATION
========================================================= */

export interface ITicketsConfig {
  enabled: boolean;
  categoryId: string | null;
  supportRoleId: string | null;
  transcriptChannelId: string | null;
  logChannelId: string | null;
  maxOpenPerUser: number;
}

export interface IModerationConfig {
  enabled: boolean;
  logChannelId: string | null;
  muteRoleId: string | null;
  defaultReason: string;
  autoModeration: boolean;
  deleteCommandMessages: boolean;
}

export interface IGiveawaysConfig {
  enabled: boolean;
  logChannelId: string | null;
  defaultDuration: number;
}

export interface ISuggestionsConfig {
  enabled: boolean;
  channelId: string | null;
  staffChannelId: string | null;
  allowAnonymous: boolean;
}

export interface ILogsConfig {
  enabled: boolean;
  joins: boolean;
  leaves: boolean;
  moderation: boolean;
  tickets: boolean;
  premium: boolean;
  payments: boolean;
  security: boolean;
  errors: boolean;
  bot: boolean;
  voice: boolean;
  roles: boolean;

  channelIds: {
    joins: string | null;
    leaves: string | null;
    moderation: string | null;
    tickets: string | null;
    premium: string | null;
    payments: string | null;
    security: string | null;
    errors: string | null;
    bot: string | null;
    voice: string | null;
    roles: string | null;
  };
}

export interface IWelcomeConfig {
  enabled: boolean;
  channelId: string | null;
  message: string;
  embed: boolean;
}

export interface IGoodbyeConfig {
  enabled: boolean;
  channelId: string | null;
  message: string;
  embed: boolean;
}

export interface IAutoRoleConfig {
  enabled: boolean;
  roleId: string | null;
}

export interface IAntiRaidConfig {
  enabled: boolean;
  threshold: number;
  timeWindow: number;
  action: string;
}

export interface IAntiSpamConfig {
  enabled: boolean;
  maxMessages: number;
  timeWindow: number;
  muteDuration: number;
}

export interface IAntiLinkConfig {
  enabled: boolean;
  whitelist: string[];
  action: string;
}

export interface IAutoModConfig {
  enabled: boolean;
  badWords: string[];
  maxMentions: number;
  maxCapsPercentage: number;
  deleteMessages: boolean;
}

export interface ILevelsConfig {
  enabled: boolean;
  xpPerMessage: number;
  cooldown: number;
  levelUpChannelId: string | null;
  levelUpMessage: string;
}

export interface IEconomyConfig {
  enabled: boolean;
  currencyName: string;
  currencySymbol: string;
  startingBalance: number;
  dailyReward: number;
  weeklyReward: number;
  workMin: number;
  workMax: number;
  messageReward: number;
  messageCooldown: number;
}

export interface IAiConfig {
  enabled: boolean;
  channelId: string | null;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  maxHistoryMessages: number;
}

export interface ICountingConfig {
  enabled: boolean;
  channelId: string | null;
  currentCount: number;
  lastUserId: string | null;
}

export interface IAutoReactionsConfig {
  enabled: boolean;
  reactions: Array<{
    trigger: string;
    emoji: string;
  }>;
}

export interface IScheduledMessagesConfig {
  enabled: boolean;
  messages: Array<{
    id: string;
    channelId: string;
    content: string;
    cron: string;
    enabled: boolean;
  }>;
}

export interface IPollsConfig {
  enabled: boolean;
  channelId: string | null;
}

export interface IVerificationConfig {
  enabled: boolean;
  channelId: string | null;
  verifiedRoleId: string | null;
  logChannelId: string | null;
}

export interface IBackupsConfig {
  enabled: boolean;
  automatic: boolean;
  interval: number;
  retention: number;
}

export interface ICustomCommandsConfig {
  enabled: boolean;
  commands: Array<{
    name: string;
    response: string;
    enabled: boolean;
  }>;
}

export interface IStatisticsConfig {
  enabled: boolean;
  channelId: string | null;
  updateInterval: number;
}

export interface IPingConfig {
  enabled: boolean;
  channelId: string | null;
}

export interface IModulesConfig {
  moderation: IModerationConfig;
  tickets: ITicketsConfig;
  giveaways: IGiveawaysConfig;
  suggestions: ISuggestionsConfig;
  logs: ILogsConfig;
  welcome: IWelcomeConfig;
  goodbye: IGoodbyeConfig;
  autoRole: IAutoRoleConfig;
  antiRaid: IAntiRaidConfig;
  antiSpam: IAntiSpamConfig;
  antiLink: IAntiLinkConfig;
  autoMod: IAutoModConfig;
  levels: ILevelsConfig;
  economy: IEconomyConfig;
  ai: IAiConfig;
  counting: ICountingConfig;
  autoReactions: IAutoReactionsConfig;
  scheduledMessages: IScheduledMessagesConfig;
  polls: IPollsConfig;
  verification: IVerificationConfig;
  backups: IBackupsConfig;
  customCommands: ICustomCommandsConfig;
  statistics: IStatisticsConfig;
  ping: IPingConfig;
}

/* =========================================================
   GUILD CONFIG INTERFACE
========================================================= */

export interface IGuildConfig extends Document {
  guildId: string;

  name?: string | null;

  icon?: string | null;

  plan: GuildPlan;

  premium: boolean;

  premiumExpiresAt?: Date | null;

  ownerId?: string | null;

  modules: IModulesConfig;

  locale: string;

  prefix: string;

  maintenance: boolean;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   DEFAULT MODULE CONFIGURATION
========================================================= */

export const defaultModules: IModulesConfig = {
  moderation: {
    enabled: true,
    logChannelId: null,
    muteRoleId: null,
    defaultReason: 'Aucune raison fournie',
    autoModeration: false,
    deleteCommandMessages: false,
  },

  tickets: {
    enabled: false,
    categoryId: null,
    supportRoleId: null,
    transcriptChannelId: null,
    logChannelId: null,
    maxOpenPerUser: 1,
  },

  giveaways: {
    enabled: false,
    logChannelId: null,
    defaultDuration: 86400000,
  },

  suggestions: {
    enabled: false,
    channelId: null,
    staffChannelId: null,
    allowAnonymous: false,
  },

  logs: {
    enabled: false,
    joins: true,
    leaves: true,
    moderation: true,
    tickets: true,
    premium: true,
    payments: true,
    security: true,
    errors: true,
    bot: true,
    voice: true,
    roles: true,

    channelIds: {
      joins: null,
      leaves: null,
      moderation: null,
      tickets: null,
      premium: null,
      payments: null,
      security: null,
      errors: null,
      bot: null,
      voice: null,
      roles: null,
    },
  },

  welcome: {
    enabled: false,
    channelId: null,
    message: 'Bienvenue {user} sur {server} !',
    embed: true,
  },

  goodbye: {
    enabled: false,
    channelId: null,
    message: '{user} a quitté le serveur.',
    embed: true,
  },

  autoRole: {
    enabled: false,
    roleId: null,
  },

  antiRaid: {
    enabled: false,
    threshold: 10,
    timeWindow: 10000,
    action: 'kick',
  },

  antiSpam: {
    enabled: false,
    maxMessages: 5,
    timeWindow: 5000,
    muteDuration: 60000,
  },

  antiLink: {
    enabled: false,
    whitelist: [],
    action: 'delete',
  },

  autoMod: {
    enabled: false,
    badWords: [],
    maxMentions: 5,
    maxCapsPercentage: 80,
    deleteMessages: true,
  },

  levels: {
    enabled: false,
    xpPerMessage: 5,
    cooldown: 60000,
    levelUpChannelId: null,
    levelUpMessage:
      '🎉 {user} vient de passer niveau {level} !',
  },

  economy: {
    enabled: false,
    currencyName: 'Coins',
    currencySymbol: '🪙',
    startingBalance: 100,
    dailyReward: 200,
    weeklyReward: 1000,
    workMin: 50,
    workMax: 250,
    messageReward: 5,
    messageCooldown: 60000,
  },

  ai: {
    enabled: false,
    channelId: null,
    model: 'openrouter',
    systemPrompt:
      'Tu es l’assistant IA du serveur Discord.',
    maxTokens: 2000,
    maxHistoryMessages: 20,
  },

  counting: {
    enabled: false,
    channelId: null,
    currentCount: 0,
    lastUserId: null,
  },

  autoReactions: {
    enabled: false,
    reactions: [],
  },

  scheduledMessages: {
    enabled: false,
    messages: [],
  },

  polls: {
    enabled: false,
    channelId: null,
  },

  verification: {
    enabled: false,
    channelId: null,
    verifiedRoleId: null,
    logChannelId: null,
  },

  backups: {
    enabled: false,
    automatic: false,
    interval: 86400000,
    retention: 10,
  },

  customCommands: {
    enabled: false,
    commands: [],
  },

  statistics: {
    enabled: false,
    channelId: null,
    updateInterval: 300000,
  },

  ping: {
    enabled: true,
    channelId: null,
  },
};

/* =========================================================
   TICKETS SUB-SCHEMA
========================================================= */

const TicketsSchema =
  new Schema<ITicketsConfig>(
    {
      enabled: {
        type: Boolean,
        default: false,
      },

      categoryId: {
        type: String,
        default: null,
      },

      supportRoleId: {
        type: String,
        default: null,
      },

      transcriptChannelId: {
        type: String,
        default: null,
      },

      logChannelId: {
        type: String,
        default: null,
      },

      maxOpenPerUser: {
        type: Number,
        default: 1,
        min: 1,
      },
    },
    {
      _id: false,
    },
  );

/* =========================================================
   MAIN SCHEMA
========================================================= */

const GuildConfigSchema =
  new Schema<IGuildConfig>(
    {
      /* ---------------------------------------------------
         GUILD
      --------------------------------------------------- */

      guildId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },

      name: {
        type: String,
        default: null,
      },

      icon: {
        type: String,
        default: null,
      },

      /* ---------------------------------------------------
         PLAN
      --------------------------------------------------- */

      plan: {
        type: String,
        enum: [
          'free',
          'premium',
          'lifetime',
          'enterprise',
        ],
        default: 'free',
        index: true,
      },

      premium: {
        type: Boolean,
        default: false,
        index: true,
      },

      premiumExpiresAt: {
        type: Date,
        default: null,
      },

      ownerId: {
        type: String,
        default: null,
      },

      /* ===================================================
         MODULES
      =================================================== */

      modules: {
        /* -------------------------------------------------
           MODERATION
        ------------------------------------------------- */

        moderation: {
          enabled: {
            type: Boolean,
            default: true,
          },

          logChannelId: {
            type: String,
            default: null,
          },

          muteRoleId: {
            type: String,
            default: null,
          },

          defaultReason: {
            type: String,
            default: 'Aucune raison fournie',
          },

          autoModeration: {
            type: Boolean,
            default: false,
          },

          deleteCommandMessages: {
            type: Boolean,
            default: false,
          },
        },

        /* -------------------------------------------------
           TICKETS
        ------------------------------------------------- */

        tickets: {
          type: TicketsSchema,
          default: () => ({}),
        },

        /* -------------------------------------------------
           GIVEAWAYS
        ------------------------------------------------- */

        giveaways: {
          enabled: {
            type: Boolean,
            default: false,
          },

          logChannelId: {
            type: String,
            default: null,
          },

          defaultDuration: {
            type: Number,
            default: 86400000,
          },
        },

        /* -------------------------------------------------
           SUGGESTIONS
        ------------------------------------------------- */

        suggestions: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          staffChannelId: {
            type: String,
            default: null,
          },

          allowAnonymous: {
            type: Boolean,
            default: false,
          },
        },

        /* -------------------------------------------------
           LOGS
        ------------------------------------------------- */

        logs: {
          enabled: {
            type: Boolean,
            default: false,
          },

          joins: {
            type: Boolean,
            default: true,
          },

          leaves: {
            type: Boolean,
            default: true,
          },

          moderation: {
            type: Boolean,
            default: true,
          },

          tickets: {
            type: Boolean,
            default: true,
          },

          premium: {
            type: Boolean,
            default: true,
          },

          payments: {
            type: Boolean,
            default: true,
          },

          security: {
            type: Boolean,
            default: true,
          },

          errors: {
            type: Boolean,
            default: true,
          },

          bot: {
            type: Boolean,
            default: true,
          },

          voice: {
            type: Boolean,
            default: true,
          },

          roles: {
            type: Boolean,
            default: true,
          },

          channelIds: {
            joins: {
              type: String,
              default: null,
            },

            leaves: {
              type: String,
              default: null,
            },

            moderation: {
              type: String,
              default: null,
            },

            tickets: {
              type: String,
              default: null,
            },

            premium: {
              type: String,
              default: null,
            },

            payments: {
              type: String,
              default: null,
            },

            security: {
              type: String,
              default: null,
            },

            errors: {
              type: String,
              default: null,
            },

            bot: {
              type: String,
              default: null,
            },

            voice: {
              type: String,
              default: null,
            },

            roles: {
              type: String,
              default: null,
            },
          },
        },

        /* -------------------------------------------------
           WELCOME
        ------------------------------------------------- */

        welcome: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          message: {
            type: String,
            default:
              'Bienvenue {user} sur {server} !',
          },

          embed: {
            type: Boolean,
            default: true,
          },
        },

        /* -------------------------------------------------
           GOODBYE
        ------------------------------------------------- */

        goodbye: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          message: {
            type: String,
            default:
              '{user} a quitté le serveur.',
          },

          embed: {
            type: Boolean,
            default: true,
          },
        },

        /* -------------------------------------------------
           AUTO ROLE
        ------------------------------------------------- */

        autoRole: {
          enabled: {
            type: Boolean,
            default: false,
          },

          roleId: {
            type: String,
            default: null,
          },
        },

        /* -------------------------------------------------
           ANTI RAID
        ------------------------------------------------- */

        antiRaid: {
          enabled: {
            type: Boolean,
            default: false,
          },

          threshold: {
            type: Number,
            default: 10,
          },

          timeWindow: {
            type: Number,
            default: 10000,
          },

          action: {
            type: String,
            default: 'kick',
          },
        },

        /* -------------------------------------------------
           ANTI SPAM
        ------------------------------------------------- */

        antiSpam: {
          enabled: {
            type: Boolean,
            default: false,
          },

          maxMessages: {
            type: Number,
            default: 5,
          },

          timeWindow: {
            type: Number,
            default: 5000,
          },

          muteDuration: {
            type: Number,
            default: 60000,
          },
        },

        /* -------------------------------------------------
           ANTI LINK
        ------------------------------------------------- */

        antiLink: {
          enabled: {
            type: Boolean,
            default: false,
          },

          whitelist: {
            type: [String],
            default: [],
          },

          action: {
            type: String,
            default: 'delete',
          },
        },

        /* -------------------------------------------------
           AUTOMOD
        ------------------------------------------------- */

        autoMod: {
          enabled: {
            type: Boolean,
            default: false,
          },

          badWords: {
            type: [String],
            default: [],
          },

          maxMentions: {
            type: Number,
            default: 5,
          },

          maxCapsPercentage: {
            type: Number,
            default: 80,
          },

          deleteMessages: {
            type: Boolean,
            default: true,
          },
        },

        /* -------------------------------------------------
           LEVELS
        ------------------------------------------------- */

        levels: {
          enabled: {
            type: Boolean,
            default: false,
          },

          xpPerMessage: {
            type: Number,
            default: 5,
          },

          cooldown: {
            type: Number,
            default: 60000,
          },

          levelUpChannelId: {
            type: String,
            default: null,
          },

          levelUpMessage: {
            type: String,
            default:
              '🎉 {user} vient de passer niveau {level} !',
          },
        },

        /* -------------------------------------------------
           ECONOMY
        ------------------------------------------------- */

        economy: {
          enabled: {
            type: Boolean,
            default: false,
          },

          currencyName: {
            type: String,
            default: 'Coins',
          },

          currencySymbol: {
            type: String,
            default: '🪙',
          },

          startingBalance: {
            type: Number,
            default: 100,
          },

          dailyReward: {
            type: Number,
            default: 200,
          },

          weeklyReward: {
            type: Number,
            default: 1000,
          },

          workMin: {
            type: Number,
            default: 50,
          },

          workMax: {
            type: Number,
            default: 250,
          },

          messageReward: {
            type: Number,
            default: 5,
          },

          messageCooldown: {
            type: Number,
            default: 60000,
          },
        },

        /* -------------------------------------------------
           AI
        ------------------------------------------------- */

        ai: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          model: {
            type: String,
            default: 'openrouter',
          },

          systemPrompt: {
            type: String,
            default:
              'Tu es l’assistant IA du serveur Discord.',
          },

          maxTokens: {
            type: Number,
            default: 2000,
          },

          maxHistoryMessages: {
            type: Number,
            default: 20,
          },
        },

        /* -------------------------------------------------
           COUNTING
        ------------------------------------------------- */

        counting: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          currentCount: {
            type: Number,
            default: 0,
          },

          lastUserId: {
            type: String,
            default: null,
          },
        },

        /* -------------------------------------------------
           AUTO REACTIONS
        ------------------------------------------------- */

        autoReactions: {
          enabled: {
            type: Boolean,
            default: false,
          },

          reactions: {
            type: [
              {
                trigger: {
                  type: String,
                  required: true,
                },

                emoji: {
                  type: String,
                  required: true,
                },
              },
            ],

            default: [],
          },
        },

        /* -------------------------------------------------
           SCHEDULED MESSAGES
        ------------------------------------------------- */

        scheduledMessages: {
          enabled: {
            type: Boolean,
            default: false,
          },

          messages: {
            type: [
              {
                id: {
                  type: String,
                  required: true,
                },

                channelId: {
                  type: String,
                  required: true,
                },

                content: {
                  type: String,
                  required: true,
                },

                cron: {
                  type: String,
                  required: true,
                },

                enabled: {
                  type: Boolean,
                  default: true,
                },
              },
            ],

            default: [],
          },
        },

        /* -------------------------------------------------
           POLLS
        ------------------------------------------------- */

        polls: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },
        },

        /* -------------------------------------------------
           VERIFICATION
        ------------------------------------------------- */

        verification: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          verifiedRoleId: {
            type: String,
            default: null,
          },

          logChannelId: {
            type: String,
            default: null,
          },
        },

        /* -------------------------------------------------
           BACKUPS
        ------------------------------------------------- */

        backups: {
          enabled: {
            type: Boolean,
            default: false,
          },

          automatic: {
            type: Boolean,
            default: false,
          },

          interval: {
            type: Number,
            default: 86400000,
          },

          retention: {
            type: Number,
            default: 10,
          },
        },

        /* -------------------------------------------------
           CUSTOM COMMANDS
        ------------------------------------------------- */

        customCommands: {
          enabled: {
            type: Boolean,
            default: false,
          },

          commands: {
            type: [
              {
                name: {
                  type: String,
                  required: true,
                },

                response: {
                  type: String,
                  required: true,
                },

                enabled: {
                  type: Boolean,
                  default: true,
                },
              },
            ],

            default: [],
          },
        },

        /* -------------------------------------------------
           STATISTICS
        ------------------------------------------------- */

        statistics: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: {
            type: String,
            default: null,
          },

          updateInterval: {
            type: Number,
            default: 300000,
          },
        },

        /* -------------------------------------------------
           PING
        ------------------------------------------------- */

        ping: {
          enabled: {
            type: Boolean,
            default: true,
          },

          channelId: {
            type: String,
            default: null,
          },
        },
      },

      /* ===================================================
         GLOBAL GUILD SETTINGS
         
         IMPORTANT :
         Ces propriétés sont volontairement HORS
         de `modules`.
      =================================================== */

      locale: {
        type: String,
        default: 'fr',
        trim: true,
      },

      prefix: {
        type: String,
        default: '!',
        trim: true,
        maxlength: 10,
      },

      maintenance: {
        type: Boolean,
        default: false,
      },
    },

    /* =====================================================
       SCHEMA OPTIONS
    ===================================================== */

    {
      timestamps: true,
      versionKey: false,
      minimize: false,
    },
  );

/* =========================================================
   INDEXES
========================================================= */

/*
 * `guildId` possède déjà `unique: true`.
 *
 * MongoDB/Mongoose crée donc déjà l'index unique.
 *
 * On NE rajoute volontairement PAS :
 *
 * GuildConfigSchema.index({ guildId: 1 });
 *
 * afin d'éviter les Duplicate schema index warnings.
 */

/* =========================================================
   MODEL
========================================================= */

export const GuildConfig: Model<IGuildConfig> =
  mongoose.models.GuildConfig ||
  mongoose.model<IGuildConfig>(
    'GuildConfig',
    GuildConfigSchema,
  );

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default GuildConfig;

/* =========================================================
   DEFAULT MODULE CONFIG EXPORT
========================================================= */
