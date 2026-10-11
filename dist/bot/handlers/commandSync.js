"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCommands = syncCommands;
exports.autoCommandSync = autoCommandSync;
const discord_js_1 = require("discord.js");
const index_1 = require("../../config/index");
function getToken() {
    return (process.env.DISCORD_TOKEN ??
        index_1.CONFIG.DISCORD?.TOKEN);
}
function getClientId(client) {
    return (process.env.DISCORD_CLIENT_ID ??
        index_1.CONFIG.DISCORD?.CLIENT_ID ??
        client.user?.id);
}
function getCommandJSON(command) {
    try {
        /*
         * Format principal OMNIX :
         *
         * data: SlashCommandBuilder
         */
        if (command.data &&
            typeof command.data.toJSON === 'function') {
            return command.data.toJSON();
        }
        /*
         * Ancien format :
         *
         * command: {
         *   data: SlashCommandBuilder
         * }
         */
        if (command.command &&
            typeof command.command.toJSON === 'function') {
            return command.command.toJSON();
        }
        return null;
    }
    catch (error) {
        console.error('[CommandSync] Erreur conversion commande :', error);
        return null;
    }
}
async function syncCommands(client) {
    const token = getToken();
    const clientId = getClientId(client);
    if (!token) {
        throw new Error('[CommandSync] Aucun token Discord trouvé dans CONFIG.DISCORD.TOKEN ou DISCORD_TOKEN.');
    }
    if (!clientId) {
        throw new Error('[CommandSync] Aucun Client ID Discord trouvé.');
    }
    const commands = client.commands;
    if (!commands || commands.size === 0) {
        console.warn('[CommandSync] Aucune commande en mémoire.');
        return;
    }
    const commandData = [];
    for (const [name, command] of commands) {
        const json = getCommandJSON(command);
        if (!json) {
            console.warn(`[CommandSync] /${name} ignorée : data.toJSON() introuvable.`);
            continue;
        }
        commandData.push(json);
    }
    console.log('');
    console.log('════════════════════════════════════');
    console.log('       OMNIX COMMAND SYNCHRONIZER');
    console.log('════════════════════════════════════');
    console.log(`[CommandSync] Client ID : ${clientId}`);
    console.log(`[CommandSync] Commandes en mémoire : ${commands.size}`);
    console.log(`[CommandSync] Commandes valides : ${commandData.length}`);
    const rest = new discord_js_1.REST({
        version: '10',
    }).setToken(token);
    try {
        console.log('[CommandSync] Envoi des commandes à Discord...');
        /*
         * PUT = remplacement complet.
         *
         * Les anciennes commandes globales qui
         * ne sont plus présentes sont supprimées.
         */
        const result = await rest.put(discord_js_1.Routes.applicationCommands(clientId), {
            body: commandData,
        });
        const count = Array.isArray(result)
            ? result.length
            : commandData.length;
        console.log(`[CommandSync] ✓ ${count} commande(s) synchronisée(s) sur Discord.`);
        console.log('[CommandSync] ✓ Anciennes commandes remplacées.');
        console.log('════════════════════════════════════');
        console.log('');
    }
    catch (error) {
        console.error('[CommandSync] ✗ Erreur Discord pendant la synchronisation :', error);
        throw error;
    }
}
/*
 * Compatibilité avec d'éventuels anciens imports.
 */
async function autoCommandSync(client) {
    await syncCommands(client);
}
exports.default = syncCommands;
