import { Events, type Guild } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';
import { recordPlatformEvent } from '../../services/platformEvents';

export default {
  name: Events.GuildDelete,

  async execute(guild: Guild): Promise<void> {
    console.log(
      '[Bot Sync] 📤 OMNIX a quitté le serveur : ${guild.name} (${guild.id})'
    );

    try {
      const config = await GuildConfig.findOne({
        guildId: guild.id,
      });

      if (!config) {
        console.log(
          `[Bot Sync] ℹ️ Aucune configuration trouvée pour ${guild.id}.`
        );

        return;
      }

      /*
       * IMPORTANT :
       * On ne supprime PAS automatiquement la configuration.
       *
       * Cela permet de conserver :
       * - statistiques
       * - historique
       * - configuration
       * - données Premium
       * - informations du serveur
       *
       * Si tu veux plus tard un système de purge,
       * on pourra l'ajouter séparément.
       */

      await recordPlatformEvent('guild_removed', { guildId: guild.id, userId: guild.ownerId, metadata: { name: guild.name } });

      console.log(
        `[Bot Sync] 💾 Configuration conservée pour ${guild.name}.`
      );

    } catch (error) {
      console.error(
        `[Bot Sync Error] Impossible de traiter le départ de ${guild.name}:`,
        error
      );
    }
  },
};