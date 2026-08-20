import GuildConfig from '../../models/GuildConfig.ts';
import type { IGuildConfig } from '../../models/GuildConfig.ts';
const DEFAULT_AI_PROMPT =
  'Tu es OMNIX, un assistant intelligent pour un serveur Discord. Réponds clairement, utilement et en français.';
/**
 * =========================================================
 * MODULES PAR DÉFAUT
 * =========================================================
 */
function createDefaultModules() {
  return {
    moderation: {
      enabled: true,
    },
    tickets: {
      enabled: false,
      categoryId: undefined,
      supportRoleId: undefined,
    },
    giveaways: {
      enabled: false,
    },
    suggestions: {
      enabled: false,
    },
    logs: {
      enabled: false,
      channelId: undefined,
    },
    welcome: {
      enabled: false,
      channelId: undefined,
      message: undefined,
    },
    goodbye: {
      enabled: false,
      channelId: undefined,
      message: undefined,
    },
    autoRole: {
      enabled: false,
      roleId: undefined,
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
      systemPrompt: DEFAULT_AI_PROMPT,
    },
    counting: {
      enabled: false,
      channelId: undefined,
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
    /*
     * Honeypot n'était pas présent dans
     * ton ancien GuildConfig.
     */
    honeypot: {
      enabled: false,
      channelId: undefined,
    },
  };
}
/**
 * =========================================================
 * DEEP MERGE
 * =========================================================
 *
 * Permet de réparer automatiquement les anciennes
 * configurations MongoDB incomplètes.
 */
function mergeModules(
  existing: any
) {
  const defaults =
    createDefaultModules();
  const source =
    existing ?? {};
  const result: any = {
    ...defaults,
    ...source,
  };
  for (const key of Object.keys(
    defaults
  )) {
    if (
      defaults[key as keyof typeof defaults] &&
      typeof defaults[
        key as keyof typeof defaults
      ] === 'object'
    ) {
      result[key] = {
        ...defaults[
          key as keyof typeof defaults
        ],
        ...(source[key] ?? {}),
      };
    }
  }
  return result;
}
/**
 * =========================================================
 * GET / CREATE GUILD CONFIG
 * =========================================================
 */
export async function getGuildConfig(
  guildId: string
): Promise<IGuildConfig> {
  if (!guildId) {
    throw new Error(
      '[GuildConfig] guildId manquant.'
    );
  }
  let config =
    await GuildConfig.findOne({
      guildId,
    });
  /*
   * -------------------------------------------------------
   * CRÉATION
   * -------------------------------------------------------
   */
  if (!config) {
    config =
      await GuildConfig.create({
        guildId,
        prefix: '!cm-',
        language: 'fr',
        modules:
          createDefaultModules(),
      });
    console.log(
      `[GuildConfig] Configuration créée : ${guildId}`
    );
    return config;
  }
  /*
   * -------------------------------------------------------
   * RÉPARATION DES ANCIENNES CONFIGURATIONS
   * -------------------------------------------------------
   */
  const repairedModules =
    mergeModules(
      config.modules
    );
  let needsSave = false;
  if (!config.modules) {
    needsSave = true;
  }
  /*
   * Vérification de chaque module.
   */
  for (const key of Object.keys(
    createDefaultModules()
  )) {
    if (
      !(config.modules as any)?.[key]
    ) {
      needsSave = true;
      break;
    }
  }
  if (needsSave) {
    config.modules =
      repairedModules as any;
    await config.save();
    console.log(
      `[GuildConfig] Configuration réparée : ${guildId}`
    );
  }
  return config;
}
/**
 * Alias compatible avec les anciennes commandes.
 */
export const getConfig =
  getGuildConfig;
/**
 * =========================================================
 * UPDATE CONFIG
 * =========================================================
 */
export async function updateGuildConfig(
  guildId: string,
  update: Record<string, any>
): Promise<IGuildConfig> {
  if (!guildId) {
    throw new Error(
      '[GuildConfig] guildId manquant.'
    );
  }
  const config =
    await getGuildConfig(
      guildId
    );
  Object.assign(
    config,
    update
  );
  await config.save();
  return config;
}
/**
 * =========================================================
 * ENABLE / DISABLE MODULE
 * =========================================================
 */
export async function updateModule(
  guildId: string,
  moduleName: string,
  enabled: boolean
): Promise<IGuildConfig> {
  const config =
    await getGuildConfig(
      guildId
    );
  if (
    !(config.modules as any)[
      moduleName
    ]
  ) {
    (config.modules as any)[
      moduleName
    ] = {
      enabled: false,
    };
  }
  (config.modules as any)[
    moduleName
  ].enabled = enabled;
  await config.save();
  return config;
}
/**
 * =========================================================
 * CHECK MODULE
 * =========================================================
 */
export async function isModuleEnabled(
  guildId: string,
  moduleName: string
): Promise<boolean> {
  const config =
    await getGuildConfig(
      guildId
    );
  return Boolean(
    (config.modules as any)?.[
      moduleName
    ]?.enabled
  );
}
/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */
export default getGuildConfig;