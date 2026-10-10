"use strict";
/**
 * ====================================================================
 * GESTIONNAIRE DE SHARDING D'OMNIX (HAUTE SCALABILITÉ)
 * Divise le processus du bot si le seuil de serveurs est dépassé.
 * ====================================================================
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const path_1 = __importDefault(require("path"));
if (!config_1.CONFIG.DISCORD.TOKEN) {
    console.error('[Sharding] Erreur : Token de bot manquant.');
    process.exit(1);
}
// Initialisation du Sharding Manager de Discord.js
const manager = new discord_js_1.ShardingManager(path_1.default.join(__dirname, './index.js'), {
    token: config_1.CONFIG.DISCORD.TOKEN,
    totalShards: 'auto' // Discord calcule automatiquement le nombre de shards requis
});
manager.on('shardCreate', shard => {
    console.log(`[Sharding] Lancement réussi du Shard numéro : [${shard.id}]`);
});
// Lancement du partitionnement de secours
manager.spawn().catch(err => {
    console.error('[Sharding Error] Échec de l\'initialisation des Shards :', err);
});
