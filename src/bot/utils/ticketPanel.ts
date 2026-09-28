import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Guild } from 'discord.js';
import { updateGuildConfig } from './guildConfig';
import TicketPanelLock from '../../models/TicketPanelLock';

export async function ensureTicketPanel(guild: Guild, config: any) {
  const tickets: any = config?.modules?.tickets || {};

  // Verrou distribué : /ticket setup et /panel ticket ne peuvent pas
  // créer simultanément deux catégories/panneaux pour le même serveur.
  const now = new Date();
  const lockedUntil = new Date(Date.now() + 30_000);
  try {
    await TicketPanelLock.findOneAndUpdate(
      { guildId: guild.id, $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }] },
      { $set: { lockedUntil, updatedAt: now }, $setOnInsert: { guildId: guild.id } },
      { upsert: true, new: true }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new Error('TICKET_SETUP_BUSY');
    }
    throw error;
  }

  try {
    return await ensureTicketPanelLocked(guild, config);
  } finally {
    await TicketPanelLock.updateOne(
      { guildId: guild.id },
      { $set: { lockedUntil: new Date(Date.now() - 1000), updatedAt: new Date() } }
    ).catch(() => null);
  }
}

async function ensureTicketPanelLocked(guild: Guild, config: any) {
  const tickets: any = config?.modules?.tickets || {};

  let category: any = tickets.categoryId ? guild.channels.cache.get(tickets.categoryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = await guild.channels.create({ name: 'TICKETS · SUPPORT', type: ChannelType.GuildCategory });
  }

  let supportRole: any = tickets.supportRoleId ? guild.roles.cache.get(tickets.supportRoleId) : null;
  if (!supportRole) {
    supportRole = guild.roles.cache.find((r: any) => /support|moderateur|modérateur|moderation|modération|staff|admin/i.test(r.name) && !r.managed) || null;
  }

  let panel: any = tickets.panelChannelId ? guild.channels.cache.get(tickets.panelChannelId) : null;
  if (!panel || panel.type !== ChannelType.GuildText) {
    panel = await guild.channels.create({
      name: '🎫・ouvrir-un-ticket',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
        ...(supportRole ? [{ id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ],
    });
  } else if (panel.parentId !== category.id) {
    await panel.setParent(category.id).catch(() => null);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('omnix_ticket_create:support').setLabel('Support général').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('omnix_ticket_create:premium').setLabel('Support Premium').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('omnix_ticket_create:partnership').setLabel('Partenariat').setStyle(ButtonStyle.Secondary),
  );

  const embed = new EmbedBuilder()
    .setColor(0x7c5cff)
    .setTitle('OMNIX · Centre de support')
    .setDescription('Besoin d’aide ? Choisissez le type de demande. Un salon privé sera créé pour votre compte.')
    .addFields(
      { name: 'Support général', value: 'Question, problème technique ou aide sur OMNIX.' },
      { name: 'Support Premium', value: 'Question concernant votre licence ou une fonctionnalité Premium.' },
      { name: 'Partenariat', value: 'Proposition ou demande de partenariat avec OMNIX.' },
    )
    .setFooter({ text: 'OMNIX · Support officiel' })
    .setTimestamp();

  // Un seul panneau OMNIX : on réutilise le message enregistré et on
  // supprime les anciens panneaux OMNIX restés dans le salon lors d'un
  // précédent /ticket setup.
  let panelMessage: any = null;
  if (tickets.panelMessageId) {
    panelMessage = await panel.messages.fetch(tickets.panelMessageId).catch(() => null);
  }

  if (panelMessage?.author?.id === guild.client.user?.id) {
    await panelMessage.edit({ embeds: [embed], components: [row] }).catch(() => null);
  } else {
    const recent = await panel.messages.fetch({ limit: 100 }).catch(() => null);
    if (recent) {
      const oldPanels = recent.filter((message: any) =>
        message.author?.id === guild.client.user?.id &&
        message.components?.some((component: any) =>
          component.components?.some((button: any) => String(button.customId || '').startsWith('omnix_ticket_create:'))
        )
      );
      for (const old of oldPanels.values()) await old.delete().catch(() => null);
    }
    panelMessage = await panel.send({ embeds: [embed], components: [row] });
  }

  // Nettoyage des anciens panneaux OMNIX présents dans d'autres salons :
  // après une série de /ticket setup, il ne reste qu'un panneau officiel.
  for (const candidate of guild.channels.cache.values()) {
    if (!candidate || candidate.type !== ChannelType.GuildText || candidate.id === panel.id) continue;
    try {
      const messages = await candidate.messages.fetch({ limit: 50 });
      const oldPanels = messages.filter((message: any) =>
        message.id !== panelMessage?.id &&
        message.author?.id === guild.client.user?.id &&
        message.components?.some((component: any) =>
          component.components?.some((button: any) => String(button.customId || '').startsWith('omnix_ticket_create:'))
        )
      );
      for (const old of oldPanels.values()) await old.delete().catch(() => null);
    } catch { /* permissions/rate limits : le panneau canonique reste intact */ }
  }

  const nextTickets = {
    ...tickets,
    enabled: true,
    categoryId: category.id,
    panelChannelId: panel.id,
    panelMessageId: panelMessage?.id || tickets.panelMessageId || null,
    ...(supportRole ? { supportRoleId: supportRole.id } : {}),
  };
  await updateGuildConfig(guild.id, { modules: { tickets: nextTickets } });

  return { category, supportRole, panel, panelMessage, tickets: nextTickets };
}
