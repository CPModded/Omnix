import { recordPlatformEvent } from '../../services/platformEvents';
import { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getGuildConfig, nextGuildTicketNumber } from '../utils/guildConfig';
import GuildTicket from '../../models/GuildTicket';

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
        const [action, type] = String(interaction.customId).split(':');
        if (!action.startsWith('omnix_ticket_') || !interaction.guild) return;

        const config = await getGuildConfig(interaction.guild.id);
        const tickets: any = config.modules?.tickets || {};

        if (action === 'omnix_ticket_create') {
          if (tickets.enabled === false) {
            return interaction.reply({ content: '❌ Le système de tickets est actuellement désactivé.', flags: 64 });
          }

          const open = await GuildTicket.countDocuments({
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            status: 'open',
          });
          if (open >= Number(tickets.maxOpenPerUser || 1)) {
            return interaction.reply({ content: 'Tu as déjà le nombre maximal de tickets ouverts.', flags: 64 });
          }

          const category = tickets.categoryId ? interaction.guild.channels.cache.get(tickets.categoryId) : null;
          if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: 'La catégorie des tickets est introuvable. Relance /ticket setup.', flags: 64 });
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

            return interaction.reply({ content: `Ticket créé : ${channel}`, flags: 64 });
          } catch (error) {
            if (channel) await channel.delete('Rollback création ticket OMNIX').catch(() => null);
            throw error;
          }
        }

        const ticketChannel = interaction.channel;
        if (!ticketChannel || !('name' in ticketChannel)) return;

        const staff = tickets.supportRoleId && interaction.member?.roles?.cache?.has(tickets.supportRoleId);
        if (!staff && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: 'Accès réservé au support.', flags: 64 });
        }

        const ticket = await GuildTicket.findOne({
          guildId: interaction.guild.id,
          channelId: ticketChannel.id,
          status: 'open',
        });

        if (!ticket) {
          return interaction.reply({ content: '❌ Ce salon n’est pas un ticket OMNIX actif.', flags: 64 });
        }

        if (action === 'omnix_ticket_claim') {
          ticket.claimedBy = interaction.user.id;
          await ticket.save();
          await recordPlatformEvent('ticket_claimed', { userId: interaction.user.id, guildId: interaction.guild.id, metadata: { ticketNumber: ticket.ticketNumber, channelId: ticket.channelId } });
          return interaction.reply({ content: `Ticket **#${ticket.ticketNumber}** pris en charge par ${interaction.user}.` });
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
          await interaction.reply({ content: 'Ticket fermé.' });
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