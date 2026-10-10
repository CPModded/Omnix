"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const SiteSettings_1 = __importDefault(require("../../models/SiteSettings"));
const discord_js_1 = require("discord.js");
const commandSync_1 = require("../handlers/commandSync");
exports.name = discord_js_1.Events.ClientReady;
exports.once = true;
async function execute(client) {
    console.log('');
    console.log('════════════════════════════════════');
    console.log('           OMNIX BOT READY');
    console.log('════════════════════════════════════');
    console.log(`[Discord] Connecté en tant que ${client.user?.tag ?? 'Inconnu'}`);
    console.log(`[Discord] ID : ${client.user?.id ?? 'Inconnu'}`);
    console.log(`[Discord] Serveurs : ${client.guilds.cache.size}`);
    console.log(`[Discord] Commandes chargées : ${client.commands?.size ?? 0}`);
    try {
        console.log('[CommandSync] Synchronisation Discord...');
        await (0, commandSync_1.syncCommands)(client);
        console.log('[CommandSync] ✓ Commandes synchronisées avec succès.');
    }
    catch (error) {
        console.error('[CommandSync] ✗ Échec de la synchronisation :', error);
    }
    try {
        const settings = await SiteSettings_1.default.findOne({ key: 'global' }).lean();
        if (settings && client.user) {
            const types = { Playing: 0, Listening: 2, Watching: 3, Competing: 5 };
            client.user.setPresence({
                status: settings.botStatus || 'online',
                activities: settings.activityEnabled && settings.activityMessage ? [{ name: settings.activityMessage, type: types[settings.activityType] ?? 0 }] : [],
            });
            console.log(`[Presence] ${settings.activityEnabled ? settings.activityType + ' ' + settings.activityMessage : 'activité désactivée'}`);
        }
    }
    catch (error) {
        console.error('[Presence] Impossible de charger la présence persistée :', error);
    }
    console.log('════════════════════════════════════');
    console.log('             OMNIX ONLINE');
    console.log('════════════════════════════════════');
    console.log('');
}
exports.default = {
    name: exports.name,
    once: exports.once,
    execute,
};
