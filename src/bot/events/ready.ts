import { Events, REST, Routes } from 'discord.js';
import { ExtendedClient } from '../client';
import { CONFIG } from '../../config';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: ExtendedClient) {
    console.log(`[Bot] Connecté en tant que ${client.user?.tag}`);

    const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD.BOT_TOKEN);
    const commandData = client.commands.map(cmd => cmd.data.toJSON());

    try {
      console.log(`[Bot] Envoi des commandes (/) à l'API de Discord...`);
      await rest.put(
        Routes.applicationCommands(CONFIG.DISCORD.CLIENT_ID),
        { body: commandData }
      );
      console.log(`[Bot] Commandes globales synchronisées avec succès.`);
    } catch (error) {
      console.error('[Bot] Erreur lors de l\'enregistrement des commandes :', error);
    }
  }
};