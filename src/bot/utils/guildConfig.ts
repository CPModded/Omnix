import GuildConfig, { defaultModules } from '../../models/GuildConfig';
import type { IGuildConfig } from '../../models/GuildConfig';
/* =========================================================
   CONSTANTES
========================================================= */
const DEFAULT_PREFIX = '/';
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
  // Deep clone the canonical Mongoose-compatible defaults.
  // This prevents undefined values such as modules.logs.channelIds
  // from being written back to MongoDB.
  return JSON.parse(
    JSON.stringify(defaultModules),
  ) as ModulesConfig;
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
        locale:
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
  if (!config.locale) {
    config.locale =
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
  // Écriture centralisée et tolérante : le dashboard et le bot
  // synchronisent la même configuration MongoDB.
  const current = await GuildConfig.findOne({ guildId }).lean();
  const currentModules = mergeModules(current?.modules);
  const incomingModules = isObject(update.modules) ? update.modules : undefined;
  const mergedModules = incomingModules
    ? deepMerge(currentModules as Record<string, unknown>, incomingModules) as ModulesConfig
    : currentModules;

  const topLevel: Record<string, unknown> = { ...update };
  delete topLevel.modules;
  delete topLevel.premium;
  delete topLevel._id;
  delete topLevel.guildId;
  delete topLevel.createdAt;
  delete topLevel.updatedAt;

  await GuildConfig.updateOne(
    { guildId },
    {
      $set: { ...topLevel, modules: mergedModules },
      $setOnInsert: { guildId },
    },
    { upsert: true, runValidators: false, strict: true }
  );

  const saved = await GuildConfig.findOne({ guildId });
  if (!saved) throw new Error('[GuildConfig] Configuration non enregistrée.');
  return saved;
}
/* =========================================================
   ATOMIC TICKET COUNTER
========================================================= */
export async function nextGuildTicketNumber(guildId: string): Promise<number> {
  if (!/^\d{17,20}$/.test(guildId)) {
    throw new Error('[GuildConfig] guildId invalide.');
  }

  // Ensure the guild exists before incrementing the nested counter.
  await getGuildConfig(guildId);

  const updated = await GuildConfig.findOneAndUpdate(
    { guildId },
    { $inc: { 'modules.tickets.counter': 1 } },
    { new: true, runValidators: true },
  );

  const number = Number(updated?.modules?.tickets?.counter || 0);
  if (!updated || number < 1) {
    throw new Error('[GuildConfig] Impossible de générer le numéro du ticket.');
  }

  return number;
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