"use strict";
/**
 * ====================================================================
 * SCRIPT DE DÉPLOIEMENT DES COMMANDES SLASH (DISCORD REST)
 * Synchronise et publie toutes les commandes slash sur Discord API.
 * ====================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const client_1 = require("./client");
const commandHandler_1 = require("./handlers/commandHandler");
async function deployCommands() {
    console.log('[Deploy] Lancement de la procédure de déploiement des commandes...');
    try {
        // Chargement préalable des commandes en mémoire
        await (0, commandHandler_1.loadCommands)(client_1.client);
        if (!config_1.CONFIG.DISCORD.TOKEN || !config_1.CONFIG.DISCORD.CLIENT_ID) {
            throw new Error("Variables d'environnement DISCORD_TOKEN ou DISCORD_CLIENT_ID manquantes.");
        }
        const commandsData = client_1.client.commands.map(cmd => cmd.data.toJSON());
        const rest = new discord_js_1.REST({ version: '10' }).setToken(config_1.CONFIG.DISCORD.TOKEN);
        console.log(`[Deploy] Envoi de ${commandsData.length} commandes à l'API Discord...`);
        await rest.put(discord_js_1.Routes.applicationCommands(config_1.CONFIG.DISCORD.CLIENT_ID), { body: commandsData });
        console.log('[Deploy] ✅ Toutes les commandes slash ont été synchronisées de manière globale.');
        process.exit(0);
    }
    catch (error) {
        console.error('[Deploy Error] ❌ Échec de synchronisation des commandes :', error.message || error);
        process.exit(1);
    }
}
deployCommands();
