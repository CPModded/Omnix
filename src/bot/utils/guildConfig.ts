import GuildConfig, { defaultModules } from '../../models/GuildConfig';
import type { IGuildConfig } from '../../models/GuildConfig';
import { getGuildModules, saveGuildModules, mysqlEnabled } from '../../database/mysql';
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
function stableSerialize(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
const MODULE_KEY_ALIASES: Record<string, string> = {
  automod: 'autoMod',
  'anti-raid': 'antiRaid',
  'anti-spam': 'antiSpam',
  'anti-link': 'antiLink',
  'auto-role': 'autoRole',
  'reaction-roles': 'reactionRoles',
  'auto-reactions': 'autoReactions',
  'scheduled-messages': 'scheduledMessages',
  'custom-commands': 'customCommands',
};

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
export function normalizeModuleKeys(existing: unknown): Record<string, unknown> {
  const source = isObject(existing) ? { ...existing } : {};
  for (const [alias, canonical] of Object.entries(MODULE_KEY_ALIASES)) {
    if (!(alias in source)) continue;
    const aliasValue = source[alias];
    const canonicalValue = source[canonical];
    // Merge legacy aliases into the canonical key. If both exist, the
    // canonical value wins while missing nested fields are preserved.
    source[canonical] = isObject(aliasValue)
      ? deepMerge(aliasValue, canonicalValue)
      : (canonicalValue !== undefined ? canonicalValue : aliasValue);
    delete source[alias];
  }
  return source;
}

export function mergeModules(
  existing: unknown
): ModulesConfig {
  const defaults = createDefaultModules();
  const normalized = normalizeModuleKeys(existing);
  return deepMerge(
    defaults as Record<string, unknown>,
    normalized,
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
    // Continue through the canonical SQL seeding path below. Returning here
    // would leave first-time guilds without their durable MySQL module row.
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
  // Detect legacy aliases and malformed nested values too. Previously the
  // repair flag only checked missing module objects, so a server containing
  // both `auto-role` and the default `autoRole` could keep reading false even
  // after the alias had been normalized in memory.
  let changed = stableSerialize(repairedModules) !== stableSerialize(currentModules);
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

  // MySQL devient la source durable de l'état des modules.
  // MongoDB reste le fallback tant que la migration globale n'est pas terminée.
  try {
    const sqlModules = await getGuildModules(guildId);
    if (sqlModules && Object.keys(sqlModules).length) {
      const repairedSqlModules = mergeModules(sqlModules);
      // Persist newly introduced default fields to SQL, not just in this response.
      if (stableSerialize(repairedSqlModules) !== stableSerialize(sqlModules)) {
        const repaired = await saveGuildModules(guildId, repairedSqlModules);
        if (!repaired && mysqlEnabled) {
          console.error(`[GuildConfig] Impossible de persister la réparation SQL des modules pour ${guildId}.`);
        }
      }
      config.modules = repairedSqlModules as any;
    } else {
      const seeded = await saveGuildModules(guildId, mergeModules(config.modules));
      if (mysqlEnabled && !seeded) {
        console.warn(`[GuildConfig] MySQL indisponible ou écriture refusée pour ${guildId}; lecture de secours MongoDB.`);
      }
    }
  } catch (error: any) {
    console.warn('[GuildConfig] MySQL modules indisponible, fallback MongoDB:', error?.message || error);
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
  // Pendant la migration, MySQL est la source de vérité pour les modules.
  // On ne doit donc pas réécraser une valeur SQL avec une ancienne copie MongoDB.
  const sqlModules = await getGuildModules(guildId);
  const currentModules = mergeModules(sqlModules || current?.modules);
  const incomingModules = isObject(update.modules) ? normalizeModuleKeys(update.modules) : undefined;
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

  // MySQL is authoritative when configured. Do not acknowledge a write if SQL
  // failed: otherwise the next read would restore stale SQL values over MongoDB.
  if (mysqlEnabled) {
    const sqlSaved = await saveGuildModules(guildId, mergedModules);
    if (!sqlSaved) {
      throw new Error('[GuildConfig] Échec de sauvegarde MySQL des modules; modification non confirmée. Vérifie la connexion et le schéma MySQL.');
    }
  }

  await GuildConfig.updateOne(
    { guildId },
    {
      $set: { ...topLevel, modules: mergedModules },
      $setOnInsert: { guildId },
    },
    { upsert: true, runValidators: false, strict: true }
  );

  const saved = await GuildConfig.findOne({ guildId });
  if (!saved) throw new Error('[GuildConfig] Configuration non enregistrée dans MongoDB.');

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
  const config = await getGuildConfig(guildId);
  const existingModule = (config.modules as any)?.[moduleName];
  const moduleUpdate = {
    ...(existingModule && typeof existingModule === 'object' ? existingModule : {}),
    enabled: Boolean(enabled),
  };
  // Use the same SQL-first + Mongo mirror write path as the dashboard.
  return updateGuildConfig(guildId, { modules: { [moduleName]: moduleUpdate } });
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
  if (!modules[moduleName]) {
    modules[moduleName] = { enabled: false };
    await updateGuildConfig(guildId, { modules: { [moduleName]: modules[moduleName] } });
  }
  return modules[
    moduleName
  ] as ModuleConfig;
}
/* =========================================================
   DEFAULT EXPORT
========================================================= */
export default getGuildConfig;