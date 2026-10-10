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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommands = getCommands;
exports.getCommand = getCommand;
exports.executeCommand = executeCommand;
exports.executeAutocomplete = executeAutocomplete;
exports.loadCommands = loadCommands;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const discord_js_1 = require("discord.js");
const GuildConfig_1 = __importDefault(require("../../models/GuildConfig"));
const config_1 = require("../../config");
const localization_1 = require("../../services/localization");
/* =========================================================
   COMMAND COLLECTION
========================================================= */
function getCommands(client) {
    const existing = client.commands;
    if (existing instanceof discord_js_1.Collection) {
        return existing;
    }
    const collection = new discord_js_1.Collection();
    client.commands =
        collection;
    return collection;
}
/* =========================================================
   COMMAND NAME
========================================================= */
function getCommandName(command) {
    const name = command.data?.name ??
        command.command?.name ??
        command.name;
    if (typeof name !== 'string') {
        return null;
    }
    const clean = name.trim();
    return clean.length > 0
        ? clean
        : null;
}
/* =========================================================
   NORMALIZE COMMAND
========================================================= */
function normalizeCommand(module) {
    /*
     * Formats supportés :
     *
     * export default command
     *
     * export const command = ...
     *
     * module directement
     */
    const candidates = [
        module?.default,
        module?.command,
        module,
    ];
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        if (typeof candidate.execute ===
            'function') {
            return candidate;
        }
    }
    return null;
}
/* =========================================================
   FIND COMMAND
========================================================= */
function getCommand(client, name) {
    const commands = getCommands(client);
    return commands.get(name);
}
/* =========================================================
   COMMAND CONTEXT
========================================================= */
/**
 * Commandes avancées incluses dans OMNIX Premium.
 * La vérification est faite côté bot sur la configuration MongoDB
 * du serveur : modifier le dashboard sans licence ne suffit donc pas.
 */
const PREMIUM_COMMANDS = new Set([
    'backup',
    'honeypot',
    'nuke',
    'massban',
    'build',
    'role-permissions',
    'channel-delete',
    'category-delete',
    'server-banner',
]);
async function requireGuildPremium(interaction) {
    if (!interaction.guildId)
        return true;
    try {
        const config = await GuildConfig_1.default.findOne({ guildId: interaction.guildId });
        if (!config) {
            await interaction.reply({ content: '❌ La configuration de ce serveur n’est pas encore disponible.', flags: 64 }).catch(() => null);
            return false;
        }
        const expiresAt = config.premium?.expiresAt;
        const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
        const active = Boolean(!expired && (config.premium?.isPremium || config.plan !== 'free'));
        // Synchronisation automatique d'une licence expirée avec le bot.
        if (expired) {
            config.premium.isPremium = false;
            config.premium.tier = 'free';
            config.premium.expiresAt = null;
            config.plan = 'free';
            config.premiumExpiresAt = null;
            await config.save();
        }
        if (active)
            return true;
        // Synchronisation de secours : un administrateur autorisé disposant
        // d'une licence Premium peut déverrouiller le serveur. Le propriétaire
        // reste également éligible. Cela aligne le bot sur le dashboard : aucun
        // quota de nombre de serveurs Premium n'est appliqué.
        const { User } = await Promise.resolve().then(() => __importStar(require('../../models/User')));
        const { License } = await Promise.resolve().then(() => __importStar(require('../../models/License')));
        const candidateIds = Array.from(new Set([
            String(interaction.user?.id || ''),
            String(interaction.guild.ownerId || ''),
        ].filter(Boolean)));
        const now = new Date();
        for (const candidateId of candidateIds) {
            const candidate = await User.findOne({ discordId: candidateId }).select('isPremium').lean();
            const candidateLicense = await License.findOne({
                buyerId: candidateId,
                status: { $in: ['active', 'used'] },
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: now } },
                ],
            }).sort({ createdAt: -1 }).lean();
            if (candidate?.isPremium || candidateLicense) {
                const tier = candidateLicense?.tier || config.premium?.tier || 'premium';
                const expires = candidateLicense?.expiresAt || config.premium?.expiresAt || null;
                config.plan = tier;
                config.premium.isPremium = true;
                config.premium.tier = tier;
                config.premium.expiresAt = expires;
                config.premiumExpiresAt = expires;
                await config.save();
                return true;
            }
        }
        const dashboardUrl = config_1.CONFIG.CLIENT_URL || config_1.CONFIG.DOMAIN || '';
        const suffix = dashboardUrl ? `\n\n🔗 ${dashboardUrl}/pricing` : '';
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `🔒 **Cette commande est réservée à OMNIX Premium.**\nActivez une licence Premium pour utiliser cette fonctionnalité.${suffix}`,
                flags: 64,
            });
        }
        return false;
    }
    catch (error) {
        console.error('[PremiumGuard] Erreur de vérification :', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Impossible de vérifier la licence Premium du serveur.', flags: 64 }).catch(() => null);
        }
        return false;
    }
}
function createCommandContext(interaction) {
    return {
        interaction,
        client: interaction.client,
        guild: interaction.guild,
        user: interaction.user,
        member: interaction.member,
        channel: interaction.channel,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        commandName: interaction.commandName,
        options: interaction.options,
    };
}
/* =========================================================
   DETECT CONTEXT FORMAT
========================================================= */
function expectsContextObject(execute) {
    const source = Function.prototype.toString.call(execute);
    /*
     * On reconnaît uniquement les formes :
     *
     * execute({ interaction })
     * execute({ interaction, ... })
     * async execute({ interaction })
     *
     * On ne considère PAS les fonctions anonymes
     * ou les paramètres génériques comme contexte.
     */
    return /execute\s*\(\s*\{\s*interaction\b/.test(source);
}
/* =========================================================
   EXECUTE COMMAND
========================================================= */
const localInteractionReceipts = new Set();
function recordCommandMetric(client, name, durationMs, failed) {
    const metrics = (client.omnixCommandMetrics ||= new Map());
    const current = metrics.get(name) || { uses: 0, failures: 0, totalMs: 0, lastMs: 0, lastUsedAt: null, lastErrorAt: null };
    current.uses += 1;
    current.failures += failed ? 1 : 0;
    current.totalMs += durationMs;
    current.lastMs = durationMs;
    current.lastUsedAt = new Date().toISOString();
    current.lastErrorAt = failed ? current.lastUsedAt : current.lastErrorAt;
    metrics.set(name, current);
}
async function executeCommand(interaction) {
    if (!interaction ||
        !interaction.commandName) {
        return;
    }
    // Première barrière locale : empêche une double exécution immédiate même
    // si MongoDB est momentanément indisponible. InteractionReceipt reste la
    // barrière distribuée entre plusieurs processus/instances.
    const interactionKey = String(interaction.id || '');
    if (interactionKey) {
        if (localInteractionReceipts.has(interactionKey)) {
            console.warn(`[CommandHandler] Interaction déjà en cours : ${interactionKey}`);
            return;
        }
        localInteractionReceipts.add(interactionKey);
        setTimeout(() => localInteractionReceipts.delete(interactionKey), 2 * 60 * 1000).unref?.();
    }
    const commandStartedAt = Date.now();
    const command = getCommand(interaction.client, interaction.commandName);
    /* -------------------------------------------------------
       COMMANDE INTROUVABLE
    ------------------------------------------------------- */
    if (!command) {
        console.warn(`[CommandHandler] Commande introuvable : /${interaction.commandName}`);
        if (!interaction.replied &&
            !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ Cette commande n’est pas disponible actuellement.',
                    flags: 64,
                });
            }
            catch (error) {
                console.error('[CommandHandler] Erreur réponse commande introuvable :', error);
            }
        }
        recordCommandMetric(interaction.client, interaction.commandName, Date.now() - commandStartedAt, true);
        return;
    }
    /* -------------------------------------------------------
       EXECUTE MANQUANT
    ------------------------------------------------------- */
    if (typeof command.execute !==
        'function') {
        console.error(`[CommandHandler] /${interaction.commandName} ne possède pas execute().`);
        if (!interaction.replied &&
            !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ Cette commande est mal configurée.',
                    flags: 64,
                });
            }
            catch {
                // Rien à faire.
            }
        }
        recordCommandMetric(interaction.client, interaction.commandName, Date.now() - commandStartedAt, true);
        return;
    }
    try {
        if (PREMIUM_COMMANDS.has(interaction.commandName)) {
            const allowed = await requireGuildPremium(interaction);
            if (!allowed)
                return;
        }
        const context = createCommandContext(interaction);
        /*
         * =======================================================
         * FORMAT 1
         *
         * execute({ interaction, ... })
         * =======================================================
         */
        if (expectsContextObject(command.execute)) {
            await command.execute(context);
            recordCommandMetric(interaction.client, interaction.commandName, Date.now() - commandStartedAt, false);
            return;
        }
        /*
         * =======================================================
         * FORMAT 2
         *
         * execute(interaction)
         * =======================================================
         */
        await command.execute(interaction);
        recordCommandMetric(interaction.client, interaction.commandName, Date.now() - commandStartedAt, false);
    }
    catch (error) {
        recordCommandMetric(interaction.client, interaction.commandName, Date.now() - commandStartedAt, true);
        console.error(`[Bot Error] Exception sur la commande ${interaction.commandName}:`, error);
        await safelyReplyError(interaction);
    }
}
/* =========================================================
   SAFE ERROR RESPONSE
========================================================= */
async function safelyReplyError(interaction) {
    const locale = await (0, localization_1.getInteractionLocale)(interaction).catch(() => 'fr');
    const message = `❌ ${locale === 'fr' ? 'Une erreur est survenue lors de l’exécution de cette commande.' : locale === 'en' ? 'Something went wrong while running this command.' : locale === 'de' ? 'Bei der Ausführung dieses Befehls ist ein Fehler aufgetreten.' : locale === 'es' ? 'Se produjo un error al ejecutar este comando.' : 'Une erreur est survenue lors de l’exécution de cette commande.'}`;
    try {
        if (interaction.replied ||
            interaction.deferred) {
            await interaction.editReply({
                content: message,
                embeds: [],
                components: [],
            });
            return;
        }
        await interaction.reply({
            content: message,
            flags: 64,
        });
    }
    catch (error) {
        // Discord peut rejeter une réponse d'erreur si l'interaction
        // est déjà expirée (10062) ou déjà acquittée (40060).
        // Dans ces deux cas, une seconde réponse ne ferait qu'ajouter
        // une erreur en cascade dans les logs.
        const code = Number(error?.code);
        if (code === 10062 || code === 40060) {
            return;
        }
        console.error('[CommandHandler] Impossible de répondre à l’erreur :', error);
    }
}
/* =========================================================
   AUTOCOMPLETE
========================================================= */
async function executeAutocomplete(interaction) {
    if (!interaction ||
        !interaction.commandName) {
        return;
    }
    const commandStartedAt = Date.now();
    const command = getCommand(interaction.client, interaction.commandName);
    if (!command) {
        try {
            await interaction.respond([]);
        }
        catch {
            // Interaction déjà terminée.
        }
        return;
    }
    try {
        if (typeof command.autocomplete ===
            'function') {
            await command.autocomplete(interaction);
            return;
        }
        /*
         * Pas d'autocomplete déclaré :
         * on répond simplement avec une liste vide.
         */
        await interaction.respond([]);
    }
    catch (error) {
        console.error(`[CommandHandler] Erreur autocomplete /${interaction.commandName}:`, error);
        try {
            if (!interaction.responded) {
                await interaction.respond([]);
            }
        }
        catch {
            // Interaction déjà terminée.
        }
    }
}
/* =========================================================
   RECURSIVE COMMAND SEARCH
========================================================= */
function getCommandFiles(directory) {
    const result = [];
    if (!node_fs_1.default.existsSync(directory)) {
        return result;
    }
    const entries = node_fs_1.default.readdirSync(directory, {
        withFileTypes: true,
    });
    for (const entry of entries) {
        const fullPath = node_path_1.default.join(directory, entry.name);
        if (entry.isDirectory()) {
            result.push(...getCommandFiles(fullPath));
            continue;
        }
        if (!entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.js') &&
            !entry.name.endsWith('.mjs')) {
            continue;
        }
        /*
         * Fichiers à ignorer.
         */
        if (entry.name.endsWith('.d') ||
            entry.name.endsWith('.test') ||
            entry.name.endsWith('.spec')) {
            continue;
        }
        result.push(fullPath);
    }
    return result;
}
async function loadModule(file) {
    // Production is compiled CommonJS: require() is deterministic and avoids
    // Node trying to interpret TypeScript as native ESM. Dev mode keeps import() fallback.
    if (file.endsWith('.js') || file.endsWith('.cjs'))
        return require(file);
    try {
        return require(file);
    }
    catch (error) {
        const url = (0, node_url_1.pathToFileURL)(file).href;
        return Promise.resolve(`${url}`).then(s => __importStar(require(s))).catch(() => { throw error; });
    }
}
/* =========================================================
   LOAD COMMANDS
========================================================= */
async function loadCommands(client, commandsPath) {
    const existingState = client;
    const requestedDirectory = commandsPath ?? (() => {
        const dist = node_path_1.default.join(process.cwd(), 'dist', 'bot', 'commands');
        return node_fs_1.default.existsSync(dist) ? dist : node_path_1.default.join(process.cwd(), 'src', 'bot', 'commands');
    })();
    const normalizedDirectory = node_path_1.default.resolve(requestedDirectory);
    if (existingState.__omnixCommandsLoaded && existingState.__omnixCommandsLoadedPath === normalizedDirectory) {
        const existing = getCommands(client);
        console.warn('[Commands] Commandes déjà chargées sur ce client — second chargement ignoré.');
        return existing;
    }
    const commands = new discord_js_1.Collection();
    const directory = requestedDirectory;
    console.log(`[Commands] Recherche des commandes dans : ${directory}`);
    /* -------------------------------------------------------
       DOSSIER ABSENT
    ------------------------------------------------------- */
    if (!node_fs_1.default.existsSync(directory)) {
        console.error(`[Commands] ❌ Dossier introuvable : ${directory}`);
        client.commands =
            commands;
        return commands;
    }
    /* -------------------------------------------------------
       FICHIERS
    ------------------------------------------------------- */
    const files = getCommandFiles(directory);
    console.log(`[Commands] ${files.length} fichier(s) trouvé(s).`);
    /* -------------------------------------------------------
       CHARGEMENT
    ------------------------------------------------------- */
    for (const file of files) {
        try {
            const url = (0, node_url_1.pathToFileURL)(file).href;
            const module = await loadModule(file);
            const command = normalizeCommand(module);
            /* ---------------------------------------------------
               EXPORT INVALID
            --------------------------------------------------- */
            if (!command) {
                console.warn(`[Commands] ${node_path_1.default.basename(file)} ignorée : export de commande introuvable.`);
                continue;
            }
            /* ---------------------------------------------------
               NOM
            --------------------------------------------------- */
            const name = getCommandName(command);
            if (!name) {
                console.warn(`[Commands] ${node_path_1.default.basename(file)} ignorée : nom introuvable.`);
                continue;
            }
            /* ---------------------------------------------------
               EXECUTE
            --------------------------------------------------- */
            if (typeof command.execute !==
                'function') {
                console.warn(`[Commands] /${name} ignorée : execute() introuvable.`);
                continue;
            }
            /* ---------------------------------------------------
               DOUBLON
            --------------------------------------------------- */
            const normalizedName = name.toLowerCase();
            if (Array.from(commands.keys()).some((loadedName) => loadedName.toLowerCase() === normalizedName)) {
                console.warn(`[Commands] ⚠️ Doublon détecté : /${name}`);
                console.warn(`[Commands] Fichier ignoré : ${file}`);
                continue;
            }
            /* ---------------------------------------------------
               ENREGISTREMENT MÉMOIRE
            --------------------------------------------------- */
            const relativeFile = node_path_1.default.relative(normalizedDirectory, file);
            const directoryCategory = node_path_1.default.dirname(relativeFile) !== '.'
                ? node_path_1.default.dirname(relativeFile).split(node_path_1.default.sep).filter(Boolean).join(' / ')
                : '';
            command._omnixFile = relativeFile;
            command._omnixCategory = directoryCategory;
            commands.set(name, command);
            console.log(`[Commands] ✓ /${name} chargée.`);
        }
        catch (error) {
            console.error(`[Commands] ❌ Erreur lors du chargement de ${file}:`, error);
        }
    }
    /* -------------------------------------------------------
       ATTACH CLIENT
    ------------------------------------------------------- */
    client.commands =
        commands;
    existingState.__omnixCommandsLoaded = true;
    existingState.__omnixCommandsLoadedPath = normalizedDirectory;
    const loadedNames = Array.from(commands.keys()).map(String).sort();
    const discoveredNames = files.map(file => {
        const base = node_path_1.default.basename(file, node_path_1.default.extname(file)).toLowerCase();
        return base === 'categorie-create' ? 'category-create' : base;
    }).sort();
    const duplicateOrAliasAwareMissing = discoveredNames.filter(name => !loadedNames.map(n => n.toLowerCase()).includes(name));
    console.log(`[Commands] ${commands.size}/${files.length} commande(s) chargée(s).`);
    if (duplicateOrAliasAwareMissing.length)
        console.warn(`[Commands] Fichiers découverts non chargés : ${duplicateOrAliasAwareMissing.join(', ')}`);
    client.omnixCommandLoadStatus = { loaded: commands.size, discovered: files.length, degraded: commands.size < files.length, loadedNames, discoveredNames, missing: duplicateOrAliasAwareMissing };
    if (commands.size < Math.max(1, Math.floor(files.length * 0.8)))
        console.error('[Commands] CRITICAL: moins de 80% des commandes ont été chargées. OMNIX sera marqué DEGRADED.');
    return commands;
}
/* =========================================================
   DEFAULT EXPORT
========================================================= */
exports.default = loadCommands;
