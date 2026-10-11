"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
exports.createDefaultModules = createDefaultModules;
exports.mergeModules = mergeModules;
exports.getGuildConfig = getGuildConfig;
exports.updateGuildConfig = updateGuildConfig;
exports.nextGuildTicketNumber = nextGuildTicketNumber;
exports.updateModule = updateModule;
exports.isModuleEnabled = isModuleEnabled;
exports.getModuleConfig = getModuleConfig;
const GuildConfig_1 = __importStar(require("../../models/GuildConfig"));
const mysql_1 = require("../../database/mysql");
/* =========================================================
   CONSTANTES
========================================================= */
const DEFAULT_PREFIX = '/';
const DEFAULT_LANGUAGE = 'fr';
const DEFAULT_AI_PROMPT = 'Tu es OMNIX, un assistant intelligent pour un serveur Discord. Réponds clairement, utilement et en français.';
/* =========================================================
   MODULES PAR DÉFAUT
========================================================= */
function createDefaultModules() {
    // Deep clone the canonical Mongoose-compatible defaults.
    // This prevents undefined values such as modules.logs.channelIds
    // from being written back to MongoDB.
    return JSON.parse(JSON.stringify(GuildConfig_1.defaultModules));
}
/* =========================================================
   UTILITAIRES
========================================================= */
/**
 * Vérifie qu'une valeur est un objet utilisable.
 */
function isObject(value) {
    return (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value));
}
/**
 * Deep merge sécurisé.
 *
 * Les valeurs existantes sont conservées.
 * Les nouvelles propriétés présentes dans les defaults
 * sont automatiquement ajoutées.
 */
function deepMerge(defaults, existing) {
    const source = isObject(existing)
        ? existing
        : {};
    const result = {
        ...defaults,
    };
    for (const key of Object.keys(defaults)) {
        const defaultValue = defaults[key];
        const existingValue = source[key];
        if (isObject(defaultValue)) {
            result[key] =
                deepMerge(defaultValue, existingValue);
        }
        else if (existingValue !== undefined) {
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
function mergeModules(existing) {
    const defaults = createDefaultModules();
    return deepMerge(defaults, existing);
}
/* =========================================================
   GET / CREATE CONFIG
========================================================= */
async function getGuildConfig(guildId) {
    if (!guildId ||
        typeof guildId !== 'string') {
        throw new Error('[GuildConfig] guildId invalide.');
    }
    let config = await GuildConfig_1.default.findOne({
        guildId,
    });
    /* -------------------------------------------------------
       CRÉATION
    ------------------------------------------------------- */
    if (!config) {
        config =
            await GuildConfig_1.default.create({
                guildId,
                prefix: DEFAULT_PREFIX,
                locale: DEFAULT_LANGUAGE,
                modules: createDefaultModules(),
            });
        console.log(`[GuildConfig] Configuration créée : ${guildId}`);
        return config;
    }
    /* -------------------------------------------------------
       RÉPARATION
    ------------------------------------------------------- */
    const currentModules = config.modules;
    const repairedModules = mergeModules(currentModules);
    let changed = false;
    /*
     * Si modules n'existe pas du tout.
     */
    if (!currentModules ||
        typeof currentModules !==
            'object') {
        changed = true;
    }
    /*
     * Vérification des modules
     * obligatoires.
     */
    const defaultModules = createDefaultModules();
    for (const moduleName of Object.keys(defaultModules)) {
        const existingModule = currentModules?.[moduleName];
        if (!existingModule ||
            typeof existingModule !==
                'object') {
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
            repairedModules;
        await config.save();
        console.log(`[GuildConfig] Configuration réparée : ${guildId}`);
    }
    /*
     * Dernière sécurité :
     * on garantit que modules existe
     * toujours dans l'objet retourné.
     */
    if (!config.modules) {
        config.modules =
            createDefaultModules();
    }
    // MySQL devient la source durable de l'état des modules.
    // MongoDB reste le fallback tant que la migration globale n'est pas terminée.
    try {
        const sqlModules = await (0, mysql_1.getGuildModules)(guildId);
        if (sqlModules && Object.keys(sqlModules).length) {
            config.modules = mergeModules(sqlModules);
        }
        else {
            await (0, mysql_1.saveGuildModules)(guildId, mergeModules(config.modules));
        }
    }
    catch (error) {
        console.warn('[GuildConfig] MySQL modules indisponible, fallback MongoDB:', error?.message || error);
    }
    return config;
}
/* =========================================================
   ALIAS COMPATIBILITÉ
========================================================= */
exports.getConfig = getGuildConfig;
/* =========================================================
   UPDATE CONFIG
========================================================= */
async function updateGuildConfig(guildId, update) {
    if (!guildId ||
        typeof guildId !== 'string') {
        throw new Error('[GuildConfig] guildId invalide.');
    }
    // Écriture centralisée et tolérante : le dashboard et le bot
    // synchronisent la même configuration MongoDB.
    const current = await GuildConfig_1.default.findOne({ guildId }).lean();
    // Pendant la migration, MySQL est la source de vérité pour les modules.
    // On ne doit donc pas réécraser une valeur SQL avec une ancienne copie MongoDB.
    const sqlModules = await (0, mysql_1.getGuildModules)(guildId);
    const currentModules = mergeModules(sqlModules || current?.modules);
    const incomingModules = isObject(update.modules) ? update.modules : undefined;
    const mergedModules = incomingModules
        ? deepMerge(currentModules, incomingModules)
        : currentModules;
    const topLevel = { ...update };
    delete topLevel.modules;
    delete topLevel.premium;
    delete topLevel._id;
    delete topLevel.guildId;
    delete topLevel.createdAt;
    delete topLevel.updatedAt;
    await GuildConfig_1.default.updateOne({ guildId }, {
        $set: { ...topLevel, modules: mergedModules },
        $setOnInsert: { guildId },
    }, { upsert: true, runValidators: false, strict: true });
    const saved = await GuildConfig_1.default.findOne({ guildId });
    if (!saved)
        throw new Error('[GuildConfig] Configuration non enregistrée.');
    // Double-écriture pendant la migration : MySQL conserve l'état des modules
    // et reste prioritaire sur une éventuelle copie MongoDB plus ancienne.
    await (0, mysql_1.saveGuildModules)(guildId, mergedModules);
    return saved;
}
/* =========================================================
   ATOMIC TICKET COUNTER
========================================================= */
async function nextGuildTicketNumber(guildId) {
    if (!/^\d{17,20}$/.test(guildId)) {
        throw new Error('[GuildConfig] guildId invalide.');
    }
    // Ensure the guild exists before incrementing the nested counter.
    await getGuildConfig(guildId);
    const updated = await GuildConfig_1.default.findOneAndUpdate({ guildId }, { $inc: { 'modules.tickets.counter': 1 } }, { new: true, runValidators: true });
    const number = Number(updated?.modules?.tickets?.counter || 0);
    if (!updated || number < 1) {
        throw new Error('[GuildConfig] Impossible de générer le numéro du ticket.');
    }
    return number;
}
/* =========================================================
   UPDATE MODULE
========================================================= */
async function updateModule(guildId, moduleName, enabled) {
    if (!guildId ||
        typeof guildId !== 'string') {
        throw new Error('[GuildConfig] guildId invalide.');
    }
    if (!moduleName ||
        typeof moduleName !==
            'string') {
        throw new Error('[GuildConfig] moduleName invalide.');
    }
    const config = await getGuildConfig(guildId);
    /*
     * Sécurité absolue :
     * modules doit toujours exister.
     */
    if (!config.modules) {
        config.modules =
            createDefaultModules();
    }
    const modules = config.modules;
    /*
     * Si le module n'existe pas,
     * on le crée automatiquement.
     */
    if (!modules[moduleName] ||
        typeof modules[moduleName] !==
            'object') {
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
async function isModuleEnabled(guildId, moduleName) {
    if (!guildId ||
        !moduleName) {
        return false;
    }
    const config = await getGuildConfig(guildId);
    return Boolean(config.modules?.[moduleName]?.enabled);
}
/* =========================================================
   GET MODULE
========================================================= */
async function getModuleConfig(guildId, moduleName) {
    const config = await getGuildConfig(guildId);
    const modules = config.modules;
    if (!modules[moduleName]) {
        modules[moduleName] = {
            enabled: false,
        };
        await config.save();
    }
    return modules[moduleName];
}
/* =========================================================
   DEFAULT EXPORT
========================================================= */
exports.default = getGuildConfig;
