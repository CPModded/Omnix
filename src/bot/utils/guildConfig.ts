import GuildConfig from '../../models/GuildConfig.ts';
import type { IGuildConfig } from '../../models/GuildConfig.ts';
/* =========================================================
   CONSTANTES
========================================================= */
const DEFAULT_PREFIX = '!cm-';
const DEFAULT_LANGUAGE = 'fr';
const DEFAULT_AI_PROMPT =
  'Tu es OMNIX, un assistant intelligent pour un serveur Discord. Réponds clairement, utilement et en français.';
/* =========================================================
   TYPES
========================================================= */
type ModuleConfig = {
  enabled: boolean;
  [key: string]: unknown;
};
type ModulesConfig = Record<
  string,
  ModuleConfig
>;
/* =========================================================
   MODULES PAR DÉFAUT
========================================================= */
export function createDefaultModules(): ModulesConfig {
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
    honeypot: {
      enabled: false,
      channelId: undefined,
    },
  };
}
/* =========================================================
   UTILITAIRES
========================================================= */
/**
 * Vérifie qu'une valeur est un objet utilisable.
 */
function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}
/**
 * Deep merge sécurisé.
 *
 * Les valeurs existantes sont conservées.
 * Les nouvelles propriétés présentes dans les defaults
 * sont automatiquement ajoutées.
 */
function deepMerge(
  defaults: Record<string, unknown>,
  existing: unknown
): Record<string, unknown> {
  const source = isObject(existing)
    ? existing
    : {};
  const result: Record<
    string,
    unknown
  > = {
    ...defaults,
  };
  for (const key of Object.keys(defaults)) {
    const defaultValue =
      defaults[key];
    const existingValue =
      source[key];
    if (
      isObject(defaultValue)
    ) {
      result[key] =
        deepMerge(
          defaultValue,
          existingValue
        );
    } else if (
      existingValue !== undefined
    ) {
      result[key] =
        existingValue;
    }
  }
  /*
   * On conserve également les propriétés
   * personnalisées existantes.
   */
  for (const key of Object.keys(source)) {
    if (!(key in result)) {
      result[key] = source[key];
    }
  }
  return result;
}
/**
 * Répare complètement la partie modules.
 */
export function mergeModules(
  existing: unknown
): ModulesConfig {
  const defaults =
    createDefaultModules();
  return deepMerge(
    defaults as Record<
      string,
      unknown
    >,
    existing
  ) as ModulesConfig;
}
/* =========================================================
   GET / CREATE CONFIG
========================================================= */
export async function getGuildConfig(
  guildId: string
): Promise<IGuildConfig> {
  if (
    !guildId ||
    typeof guildId !== 'string'
  ) {
    throw new Error(
      '[GuildConfig] guildId invalide.'
    );
  }
  let config =
    await GuildConfig.findOne({
      guildId,
    });
  /* -------------------------------------------------------
     CRÉATION
  ------------------------------------------------------- */
  if (!config) {
    config =
      await GuildConfig.create({
        guildId,
        prefix:
          DEFAULT_PREFIX,
        language:
          DEFAULT_LANGUAGE,
        modules:
          createDefaultModules(),
      });
    console.log(
      `[GuildConfig] Configuration créée : ${guildId}`
    );
    return config;
  }
  /* -------------------------------------------------------
     RÉPARATION
  ------------------------------------------------------- */
  const currentModules =
    config.modules;
  const repairedModules =
    mergeModules(
      currentModules
    );
  let changed = false;
  /*
   * Si modules n'existe pas du tout.
   */
  if (
    !currentModules ||
    typeof currentModules !==
      'object'
  ) {
    changed = true;
  }
  /*
   * Vérification des modules
   * obligatoires.
   */
  const defaultModules =
    createDefaultModules();
  for (const moduleName of Object.keys(
    defaultModules
  )) {
    const existingModule =
      currentModules?.[
        moduleName as keyof typeof currentModules
      ];
    if (
      !existingModule ||
      typeof existingModule !==
        'object'
    ) {
      changed = true;
      break;
    }
  }
  /*
   * Vérification de valeurs importantes.
   */
  if (!config.prefix) {
    config.prefix =
      DEFAULT_PREFIX;
    changed = true;
  }
  if (!config.language) {
    config.language =
      DEFAULT_LANGUAGE;
    changed = true;
  }
  /*
   * Application de la configuration
   * réparée.
   */
  if (changed) {
    config.modules =
      repairedModules as any;
    await config.save();
    console.log(
      `[GuildConfig] Configuration réparée : ${guildId}`
    );
  }
  /*
   * Dernière sécurité :
   * on garantit que modules existe
   * toujours dans l'objet retourné.
   */
  if (!config.modules) {
    config.modules =
      createDefaultModules() as any;
  }
  return config;
}
/* =========================================================
   ALIAS COMPATIBILITÉ
========================================================= */
export const getConfig =
  getGuildConfig;
/* =========================================================
   UPDATE CONFIG
========================================================= */
export async function updateGuildConfig(
  guildId: string,
  update: Record<string, unknown>
): Promise<IGuildConfig> {
  if (
    !guildId ||
    typeof guildId !== 'string'
  ) {
    throw new Error(
      '[GuildConfig] guildId invalide.'
    );
  }
  const config =
    await getGuildConfig(
      guildId
    );
  /*
   * Gestion spéciale de modules.
   *
   * On ne remplace jamais complètement
   * les modules existants par un objet
   * partiel.
   */
  if (
    'modules' in update
  ) {
    config.modules =
      mergeModules(
        update.modules
      ) as any;
    const {
      modules: _ignored,
      ...otherUpdates
    } = update;
    Object.assign(
      config,
      otherUpdates
    );
  } else {
    Object.assign(
      config,
      update
    );
  }
  await config.save();
  return config;
}
/* =========================================================
   UPDATE MODULE
========================================================= */
export async function updateModule(
  guildId: string,
  moduleName: string,
  enabled: boolean
): Promise<IGuildConfig> {
  if (
    !guildId ||
    typeof guildId !== 'string'
  ) {
    throw new Error(
      '[GuildConfig] guildId invalide.'
    );
  }
  if (
    !moduleName ||
    typeof moduleName !==
      'string'
  ) {
    throw new Error(
      '[GuildConfig] moduleName invalide.'
    );
  }
  const config =
    await getGuildConfig(
      guildId
    );
  /*
   * Sécurité absolue :
   * modules doit toujours exister.
   */
  if (!config.modules) {
    config.modules =
      createDefaultModules() as any;
  }
  const modules =
    config.modules as any;
  /*
   * Si le module n'existe pas,
   * on le crée automatiquement.
   */
  if (
    !modules[moduleName] ||
    typeof modules[moduleName] !==
      'object'
  ) {
    modules[moduleName] = {
      enabled: false,
    };
  }
  modules[moduleName].enabled =
    Boolean(enabled);
  await config.save();
  return config;
}
/* =========================================================
   CHECK MODULE
========================================================= */
export async function isModuleEnabled(
  guildId: string,
  moduleName: string
): Promise<boolean> {
  if (
    !guildId ||
    !moduleName
  ) {
    return false;
  }
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
/* =========================================================
   GET MODULE
========================================================= */
export async function getModuleConfig(
  guildId: string,
  moduleName: string
): Promise<ModuleConfig> {
  const config =
    await getGuildConfig(
      guildId
    );
  const modules =
    config.modules as any;
  if (
    !modules[moduleName]
  ) {
    modules[moduleName] = {
      enabled: false,
    };
    await config.save();
  }
  return modules[
    moduleName
  ] as ModuleConfig;
}
/* =========================================================
   DEFAULT EXPORT
========================================================= */
export default getGuildConfig;