import { recordPlatformEvent } from '../../services/platformEvents';
import { Events } from 'discord.js';

import {
  executeCommand,
  executeAutocomplete,
} from '../handlers/commandHandler';

export default {
  name: Events.InteractionCreate,

  async execute(interaction: any) {
    try {
      // =========================================================
      // SLASH COMMAND
      // =========================================================

      if (interaction.isChatInputCommand()) {
        const started = Date.now();
        try {
          await executeCommand(interaction);
          await recordPlatformEvent('command_executed', { userId: interaction.user?.id, guildId: interaction.guildId || undefined, metadata: { command: interaction.commandName, durationMs: Date.now()-started } });
        } catch (error) {
          await recordPlatformEvent('command_error', { userId: interaction.user?.id, guildId: interaction.guildId || undefined, metadata: { command: interaction.commandName, durationMs: Date.now()-started, error: error instanceof Error ? error.message.slice(0,500) : 'error' } });
          throw error;
        }
        return;
      }

      // =========================================================
      // AUTOCOMPLETE
      // =========================================================

      if (interaction.isAutocomplete()) {
        await executeAutocomplete(interaction);
        return;
      }

      // =========================================================
      // BOUTONS
      // =========================================================

      if (interaction.isButton()) {
        console.log(
          `[InteractionCreate] Bouton reçu : ${interaction.customId}`
        );

        // Les handlers de boutons seront branchés
        // individuellement lorsqu'ils seront nécessaires.
        return;
      }

      // =========================================================
      // SELECT MENUS
      // =========================================================

      if (interaction.isStringSelectMenu()) {
        console.log(
          `[InteractionCreate] Menu reçu : ${interaction.customId}`
        );

        return;
      }

      // =========================================================
      // USER SELECT MENU
      // =========================================================

      if (interaction.isUserSelectMenu()) {
        console.log(
          `[InteractionCreate] User Select reçu : ${interaction.customId}`
        );

        return;
      }

      // =========================================================
      // ROLE SELECT MENU
      // =========================================================

      if (interaction.isRoleSelectMenu()) {
        console.log(
          `[InteractionCreate] Role Select reçu : ${interaction.customId}`
        );

        return;
      }

      // =========================================================
      // CHANNEL SELECT MENU
      // =========================================================

      if (interaction.isChannelSelectMenu()) {
        console.log(
          `[InteractionCreate] Channel Select reçu : ${interaction.customId}`
        );

        return;
      }

      // =========================================================
      // MENTIONABLE SELECT MENU
      // =========================================================

      if (interaction.isMentionableSelectMenu()) {
        console.log(
          `[InteractionCreate] Mentionable Select reçu : ${interaction.customId}`
        );

        return;
      }

      // =========================================================
      // MODAL
      // =========================================================

      if (interaction.isModalSubmit()) {
        console.log(
          `[InteractionCreate] Modal reçu : ${interaction.customId}`
        );

        return;
      }

    } catch (error) {
      console.error(
        '[InteractionCreate] Erreur :',
        error
      );

      // =========================================================
      // GESTION PROPRE DE L'ERREUR DISCORD
      // =========================================================

      try {
        if (!interaction.isRepliable()) {
          return;
        }

        const errorMessage =
          '❌ Une erreur interne est survenue lors du traitement de cette interaction.';

        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.editReply({
            content: errorMessage,
            embeds: [],
            components: [],
          }).catch(() => null);

          return;
        }

        await interaction.reply({
          content: errorMessage,
          flags: 64,
        }).catch(() => null);

      } catch (replyError) {
        console.error(
          '[InteractionCreate] Impossible de répondre à l’erreur :',
          replyError
        );
      }
    }
  },
};