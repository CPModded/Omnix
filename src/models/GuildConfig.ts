import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

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
  };

  createdAt: Date;
  updatedAt: Date;
}


const enabledModule = () => ({
  enabled: {
    type: Boolean,
    default: false,
  },
});


const GuildConfigSchema =
  new Schema<IGuildConfig>(
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

      modules: {
        moderation: enabledModule(),

        tickets: {
          enabled: {
            type: Boolean,
            default: false,
          },

          categoryId: String,

          supportRoleId: String,
        },

        giveaways: enabledModule(),

        suggestions: enabledModule(),

        logs: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: String,
        },

        welcome: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: String,

          message: String,
        },

        goodbye: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: String,

          message: String,
        },

        autoRole: {
          enabled: {
            type: Boolean,
            default: false,
          },

          roleId: String,
        },

        antiRaid: enabledModule(),

        antiSpam: enabledModule(),

        antiLink: enabledModule(),

        autoMod: enabledModule(),

        levels: enabledModule(),

        economy: enabledModule(),

        music: enabledModule(),

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

        counting: {
          enabled: {
            type: Boolean,
            default: false,
          },

          channelId: String,
        },

        autoReactions: enabledModule(),

        scheduledMessages: enabledModule(),

        polls: enabledModule(),

        verification: enabledModule(),

        backups: enabledModule(),

        customCommands: enabledModule(),

        statistics: enabledModule(),

        ping: {
          enabled: {
            type: Boolean,
            default: true,
          },
        },
      },
    },

    {
      timestamps: true,

      minimize: false,
    }
  );


export const GuildConfig: Model<IGuildConfig> =
  mongoose.models.GuildConfig ||
  mongoose.model<IGuildConfig>(
    'GuildConfig',
    GuildConfigSchema
  );


export default GuildConfig;