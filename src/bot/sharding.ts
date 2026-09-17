/**
 * ====================================================================
 * GESTIONNAIRE DE SHARDING D'OMNIX (HAUTE SCALABILITÉ)
 * Divise le processus du bot si le seuil de serveurs est dépassé.
 * ====================================================================
 */

import { ShardingManager } from 'discord.js';
import { CONFIG } from '../config';
import path from 'path';

if (!CONFIG.DISCORD.BOT_TOKEN) {
  console.error('[Sharding] Erreur : Token de bot manquant.');
  process.exit(1);
}

// Initialisation du Sharding Manager de Discord.js
const manager = new ShardingManager(path.join(__dirname, './index.js'), {
  token: CONFIG.DISCORD.BOT_TOKEN,
  totalShards: 'auto' // Discord calcule automatiquement le nombre de shards requis
});

manager.on('shardCreate', shard => {
  console.log(`[Sharding] Lancement réussi du Shard numéro : [${shard.id}]`);
});

// Lancement du partitionnement de secours
manager.spawn().catch(err => {
  console.error('[Sharding Error] Échec de l\'initialisation des Shards :', err);
});