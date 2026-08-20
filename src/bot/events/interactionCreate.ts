import { Events } from 'discord.js';

import {
  executeCommand,
  executeAutocomplete,
} from '../handlers/commandHandler.ts';

export default {
  name: Events.InteractionCreate,

  async execute(interaction: any) {
    try {
      /*
       * =========================================================
       * SLASH COMMAND
       * =========================================================
       */

      if (interaction.isChatInputCommand()) {
        await executeCommand(interaction);
        return;
      }

      /*
       * =========================================================
       * AUTOCOMPLETE
       * =========================================================
       */

      if (interaction.isAutocomplete()) {
        await executeAutocomplete(interaction);
        return;
      }

      /*
       * =========================================================
       * AUTRES INTERACTIONS
       * =========================================================
       *
       * Les boutons, menus et modals ne sont volontairement
       * pas interceptés ici pour ne pas casser tes systèmes
       * existants.
       */

    } catch (error) {
      console.error(
        '[InteractionCreate] Exception :',
        error
      );

      try {
        if (!interaction.isRepliable()) {
          return;
        }

        const message =
          '❌ Une erreur interne est survenue lors du traitement de cette interaction.';

        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.editReply({
            content: message,
            embeds: [],
            components: [],
          });
        } else {
          await interaction.reply({
            content: message,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        console.error(
          '[InteractionCreate] Impossible d’envoyer la réponse d’erreur :',
          replyError
        );
      }
    }
  },
};