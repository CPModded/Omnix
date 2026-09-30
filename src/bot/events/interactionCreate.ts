import { recordPlatformEvent } from '../../services/platformEvents';
import { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getGuildConfig, nextGuildTicketNumber } from '../utils/guildConfig';
import GuildTicket from '../../models/GuildTicket';
import InteractionReceipt from '../../models/InteractionReceipt';

const localInteractionReceipts = new Set<string>();

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

        // Discord peut livrer une même interaction à plusieurs instances
        // du bot. MongoDB sert de verrou distribué pour qu'une commande ne
        // soit exécutée qu'une seule fois. En cas de Mongo indisponible, on
        // conserve le comportement normal du bot.
        try {
          const interactionKey = String(interaction.id);
          if (localInteractionReceipts.has(interactionKey)) {
            console.warn(`[InteractionCreate] Doublon local ignoré : ${interaction.commandName} (${interactionKey})`);
            return;
          }
          localInteractionReceipts.add(interactionKey);
          const localExpiry = setTimeout(() => localInteractionReceipts.delete(interactionKey), 2 * 60 * 1000);
          localExpiry.unref?.();

          const receiptExpiry = new Date(Date.now() + 2 * 60 * 1000);
          try {
            await InteractionReceipt.create({
              interactionId: interactionKey,
              kind: `command:${String(interaction.commandName)}`,
              expiresAt: receiptExpiry,
            });
          } catch (receiptError: any) {
            if (receiptError?.code === 11000) {
              console.warn(`[InteractionCreate] Doublon distribué ignoré : ${interaction.commandName} (${interactionKey})`);
              return;
            }
            // Mongo indisponible : la barrière locale reste active.
          }

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
        const [action, type] = String(interaction.customId).split(':');
        if (!action.startsWith('omnix_ticket_') || !interaction.guild) return;

        const interactionKey = String(interaction.id);

        // Une interaction Discord ne doit être acquittée qu'une seule fois.
        // On garde une barrière locale pour les doublons livrés au même
        // processus, puis on acquitte immédiatement l'interaction avant toute
        // opération MongoDB. Ainsi, une base lente ne fait plus expirer le
        // bouton.
        if (localInteractionReceipts.has(`button:${interactionKey}`)) {
          console.warn(`[InteractionCreate] Doublon local ignoré : bouton ${interaction.customId} (${interactionKey})`);
          return;
        }
        localInteractionReceipts.add(`button:${interactionKey}`);
        const buttonLocalExpiry = setTimeout(() => localInteractionReceipts.delete(`button:${interactionKey}`), 2 * 60 * 1000);
        buttonLocalExpiry.unref?.();

        if (!interaction.deferred && !interaction.replied) {
          try {
            await interaction.deferReply({ flags: 64 });
          } catch (error: any) {
            if (error?.code === 10062 || error?.rawError?.code === 10062) {
              console.warn(`[InteractionCreate] Interaction expirée ou déjà consommée : bouton ${interaction.customId} (${interactionKey})`);
              return;
            }
            throw error;
          }
        }

        // Verrou distribué après l'acquittement Discord. Si une seconde
        // instance reçoit la même interaction, la première aura déjà
        // consommé le token Discord et la seconde sortira proprement.
        try {
          await InteractionReceipt.create({
            interactionId: interactionKey,
            kind: `button:${String(interaction.customId)}`,
            expiresAt: new Date(Date.now() + 2 * 60 * 1000),
          });
        } catch (receiptError: any) {
          if (receiptError?.code === 11000) {
            console.warn(`[InteractionCreate] Doublon distribué ignoré : bouton ${interaction.customId} (${interactionKey})`);
            return;
          }
          // Mongo indisponible : la barrière locale reste active et le
          // traitement continue afin de ne pas casser les interactions.
        }

        let config: any;
        try {
          config = await getGuildConfig(interaction.guild.id);
        } catch (error: any) {
          console.error('[Ticket] Configuration indisponible :', error?.message || error);
          return interaction.editReply({
            content: '⚠️ OMNIX ne peut pas accéder à la configuration du serveur pour le moment. La base de données est temporairement indisponible. Réessaie dans quelques instants.',
          }).catch(() => null);
        }
        const tickets: any = config?.modules?.tickets || {};

        if (action === 'omnix_ticket_create') {
          if (tickets.enabled === false) {
            return interaction.editReply({ content: '❌ Le système de tickets est actuellement désactivé.' });
          }

          const open = await GuildTicket.countDocuments({
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            status: 'open',
          });
          if (open >= Number(tickets.maxOpenPerUser || 1)) {
            return interaction.editReply({ content: 'Tu as déjà le nombre maximal de tickets ouverts.' });
          }

          const category = tickets.categoryId ? interaction.guild.channels.cache.get(tickets.categoryId) : null;
          if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.editReply({ content: 'La catégorie des tickets est introuvable. Relance /ticket setup.' });
          }

          const number = await nextGuildTicketNumber(interaction.guild.id);
          let channel: any = null;

          try {
            channel = await interaction.guild.channels.create({
              name: `ticket-${number}`,
              type: ChannelType.GuildText,
              parent: category.id,
              permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ...(tickets.supportRoleId ? [{ id: tickets.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
              ],
            });

            await GuildTicket.create({
              guildId: interaction.guild.id,
              ticketNumber: number,
              channelId: channel.id,
              userId: interaction.user.id,
              username: interaction.user.username,
              subject: type || 'support',
              status: 'open',
            });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`omnix_ticket_claim:${channel.id}`).setLabel('Prendre en charge').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`omnix_ticket_close:${channel.id}`).setLabel('Fermer').setStyle(ButtonStyle.Danger),
            );

            await channel.send({
              content: `<@${interaction.user.id}> Votre demande **${type || 'support'}** est ouverte.`,
              components: [row],
            });

            await recordPlatformEvent('ticket_created', {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
              metadata: { ticketNumber: number, channelId: channel.id, type: type || 'support' },
            });

            return interaction.editReply({ content: `Ticket créé : ${channel}` });
          } catch (error) {
            if (channel) await channel.delete('Rollback création ticket OMNIX').catch(() => null);
            throw error;
          }
        }

        const ticketChannel = interaction.channel;
        if (!ticketChannel || !('name' in ticketChannel)) return;

        const staff = tickets.supportRoleId && interaction.member?.roles?.cache?.has(tickets.supportRoleId);
        if (!staff && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.editReply({ content: 'Accès réservé au support.' });
        }

        const ticket = await GuildTicket.findOne({
          guildId: interaction.guild.id,
          channelId: ticketChannel.id,
          status: 'open',
        });

        if (!ticket) {
          return interaction.editReply({ content: '❌ Ce salon n’est pas un ticket OMNIX actif.' });
        }

        if (action === 'omnix_ticket_claim') {
          ticket.claimedBy = interaction.user.id;
          await ticket.save();
          await recordPlatformEvent('ticket_claimed', { userId: interaction.user.id, guildId: interaction.guild.id, metadata: { ticketNumber: ticket.ticketNumber, channelId: ticket.channelId } });
          return interaction.editReply({ content: `Ticket **#${ticket.ticketNumber}** pris en charge par ${interaction.user}.` });
        }

        if (action === 'omnix_ticket_close') {
          ticket.status = 'closed';
          ticket.closedAt = new Date();
          ticket.closedBy = interaction.user.id;
          await ticket.save();

          // Optional transcript: keep it bounded to the latest 100 messages
          // so a 512 MiB container is not forced to hold a huge transcript.
          if (tickets.transcriptChannelId && 'messages' in ticketChannel && typeof (ticketChannel as any).messages?.fetch === 'function') {
            const transcriptChannel: any = interaction.guild.channels.cache.get(tickets.transcriptChannelId);
            if (transcriptChannel?.isTextBased?.() && typeof transcriptChannel.send === 'function') {
              const fetched: any = await (ticketChannel as any).messages.fetch({ limit: 100 }).catch(() => null);
              if (fetched) {
                const lines = [...fetched.values()].reverse().map((m: any) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag || m.author?.username || 'Utilisateur'}: ${String(m.content || '[embed/fichier]').slice(0, 1000)}`);
                const header = `📄 **Transcript ticket #${ticket.ticketNumber}**\nServeur : ${interaction.guild.name}\nCréé par : ${ticket.username}`;
                await transcriptChannel.send(header).catch(() => null);
                for (let i = 0; i < lines.length; i += 20) {
                  await transcriptChannel.send('```text\n' + lines.slice(i, i + 20).join('\n').slice(0, 1950) + '\n```').catch(() => null);
                }
              }
            }
          }

          if (tickets.logChannelId) {
            const logChannel: any = interaction.guild.channels.cache.get(tickets.logChannelId);
            if (logChannel?.isTextBased?.() && typeof logChannel.send === 'function') {
              await logChannel.send(`🔒 Ticket #${ticket.ticketNumber} fermé par <@${interaction.user.id}> — <#${ticket.channelId}>`).catch(() => null);
            }
          }

          await recordPlatformEvent('ticket_closed', { userId: interaction.user.id, guildId: interaction.guild.id, metadata: { ticketNumber: ticket.ticketNumber, channelId: ticket.channelId } });
          await interaction.editReply({ content: 'Ticket fermé.' });
          return ticketChannel.delete('Ticket OMNIX fermé');
        }

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

    } catch (error: any) {
      if (error?.code === 10062 || error?.rawError?.code === 10062) {
        console.warn('[InteractionCreate] Interaction expirée ou déjà consommée (10062).');
        return;
      }

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
          '❌ OMNIX n’a pas pu terminer cette action. Si le problème persiste, vérifie l’état de la base de données dans le dashboard.';

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