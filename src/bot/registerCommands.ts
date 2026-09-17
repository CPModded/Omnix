/**
 * ====================================================================
 * SCRIPT DE DÉPLOIEMENT DES COMMANDES SLASH (DISCORD REST)
 * Synchronise et publie toutes les commandes slash sur Discord API.
 * ====================================================================
 */

import { REST, Routes } from 'discord.js';
import { CONFIG } from '../config';
import { client as botClient } from './client';
import { loadCommands } from './handlers/commandHandler';

async function deployCommands() {
  console.log('[Deploy] Lancement de la procédure de déploiement des commandes...');
  
  try {
    // Chargement préalable des commandes en mémoire
    await loadCommands(botClient);

    if (!CONFIG.DISCORD.BOT_TOKEN || !CONFIG.DISCORD.CLIENT_ID) {
      throw new Error("Variables d'environnement DISCORD_BOT_TOKEN ou DISCORD_CLIENT_ID manquantes.");
    }

    const commandsData = botClient.commands.map(cmd => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD.BOT_TOKEN);

    console.log(`[Deploy] Envoi de ${commandsData.length} commandes à l'API Discord...`);
    
    await rest.put(
      Routes.applicationCommands(CONFIG.DISCORD.CLIENT_ID),
      { body: commandsData }
    );

    console.log('[Deploy] ✅ Toutes les commandes slash ont été synchronisées de manière globale.');
    process.exit(0);

  } catch (error: any) {
    console.error('[Deploy Error] ❌ Échec de synchronisation des commandes :', error.message || error);
    process.exit(1);
  }
}

deployCommands();