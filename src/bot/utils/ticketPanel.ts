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

  const categories = Array.isArray(tickets.categoriesList) && tickets.categoriesList.length ? tickets.categoriesList : [
    { id: 'support', name: 'Support général', emoji: '🎫', type: 'category', targetId: category.id, welcomeMessage: tickets.entryText || 'Bonjour {user}, un conseiller va vous répondre.' },
    { id: 'premium', name: 'Support Premium', emoji: '⭐', type: 'category', targetId: category.id, welcomeMessage: tickets.entryText || 'Bonjour {user}, un conseiller va vous répondre.' },
    { id: 'partnership', name: 'Partenariat', emoji: '🤝', type: 'category', targetId: category.id, welcomeMessage: tickets.entryText || 'Bonjour {user}, un conseiller va vous répondre.' },
  ];
  const components: any[] = [];
  if (tickets.uiMode === 'select') {
    const { StringSelectMenuBuilder } = await import('discord.js');
    const menu = new StringSelectMenuBuilder().setCustomId('omnix_ticket_create_select').setPlaceholder('Choisissez votre demande').addOptions(categories.slice(0,25).map((c:any)=>({label:String(c.name||'Ticket').slice(0,100),value:String(c.id).slice(0,100),emoji:String(c.emoji||'🎫').slice(0,2)})));
    components.push(new ActionRowBuilder<any>().addComponents(menu));
  } else {
    for (let i=0;i<categories.length && i<20;i+=5) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...categories.slice(i,i+5).map((c:any)=>new ButtonBuilder().setCustomId(`omnix_ticket_create:${c.id}`).setLabel(String(c.name||'Ticket').slice(0,80)).setEmoji(String(c.emoji||'🎫').slice(0,2)).setStyle(i===0?ButtonStyle.Primary:ButtonStyle.Secondary))));
  }
  const row = components;
  const embed = new EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Centre de support').setDescription(String(tickets.panelText || 'Choisissez le type de demande qui correspond à votre besoin.')).setFooter({ text: 'OMNIX · Support officiel' }).setTimestamp();
  for (const c of categories.slice(0,25)) embed.addFields({name:`${c.emoji||'🎫'} ${String(c.name||'Ticket')}`.slice(0,256),value:String(c.welcomeMessage||'Ouvrir un ticket privé.').slice(0,1024),inline:true});

  // Un seul panneau OMNIX : on réutilise le message enregistré et on
  // supprime les anciens panneaux OMNIX restés dans le salon lors d'un
  // précédent /ticket setup.
  let panelMessage: any = null;
  if (tickets.panelMessageId) {
    panelMessage = await panel.messages.fetch(tickets.panelMessageId).catch(() => null);
  }

  if (panelMessage?.author?.id === guild.client.user?.id) {
    await panelMessage.edit({ embeds: [embed], components: row }).catch(() => null);
  } else {
    const recent = await panel.messages.fetch({ limit: 100 }).catch(() => null);
    if (recent) {
      const oldPanels = recent.filter((message: any) =>
        message.author?.id === guild.client.user?.id &&
        message.components?.some((component: any) =>
          component.components?.some((button: any) => (String(button.customId || '').startsWith('omnix_ticket_create:') || String(button.customId || '') === 'omnix_ticket_create_select'))
        )
      );
      for (const old of oldPanels.values()) await old.delete().catch(() => null);
    }
    panelMessage = await panel.send({ embeds: [embed], components: row });
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
          component.components?.some((button: any) => (String(button.customId || '').startsWith('omnix_ticket_create:') || String(button.customId || '') === 'omnix_ticket_create_select'))
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
