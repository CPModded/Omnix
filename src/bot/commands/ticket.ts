import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../utils/guildConfig';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gère le système de tickets OMNIX.')
    .addSubcommand(s => s.setName('setup').setDescription('Installe ou réinstalle le panneau de tickets OMNIX.'))
    .addSubcommand(s => s.setName('status').setDescription('Affiche le statut du système de tickets.')),

  async execute(interaction: any) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({ content:'Cette commande doit être utilisée sur un serveur.', flags:MessageFlags.Ephemeral });
    }

    const config = await getGuildConfig(interaction.guildId).catch(() => null);
    if (!config) return interaction.reply({ content:'La configuration OMNIX de ce serveur est introuvable.', flags:MessageFlags.Ephemeral });

    const tickets: any = config.modules?.tickets || {};
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const embed = new EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Tickets').setDescription('État actuel du système de tickets.')
        .addFields(
          { name:'Statut', value:tickets.enabled ? 'Activé' : 'Désactivé', inline:true },
          { name:'Catégorie', value:tickets.categoryId ? `<#${tickets.categoryId}>` : 'Non configurée', inline:true },
          { name:'Panneau', value:tickets.panelChannelId ? `<#${tickets.panelChannelId}>` : 'Non configuré', inline:true },
          { name:'Rôle support', value:tickets.supportRoleId ? `<@&${tickets.supportRoleId}>` : 'Non configuré', inline:true },
        ).setTimestamp();
      return interaction.reply({ embeds:[embed] });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content:'Tu dois avoir la permission **Gérer le serveur** pour configurer les tickets.', flags:MessageFlags.Ephemeral });
    }

    let category = tickets.categoryId ? interaction.guild.channels.cache.get(tickets.categoryId) : null;
    if (!category || category.type !== ChannelType.GuildCategory) {
      category = await interaction.guild.channels.create({ name:'TICKETS · SUPPORT', type:ChannelType.GuildCategory });
    }

    let supportRole = tickets.supportRoleId ? interaction.guild.roles.cache.get(tickets.supportRoleId) : null;
    if (!supportRole) {
      supportRole = interaction.guild.roles.cache.find((r:any) => /support|moderateur|modérateur|moderation|modération|staff|admin/i.test(r.name) && !r.managed) || null;
    }

    let panel = tickets.panelChannelId ? interaction.guild.channels.cache.get(tickets.panelChannelId) : null;
    if (!panel || panel.type !== ChannelType.GuildText) {
      panel = await interaction.guild.channels.create({
        name:'🎫・ouvrir-un-ticket',
        type:ChannelType.GuildText,
        parent:category.id,
        permissionOverwrites:[
          { id:interaction.guild.roles.everyone.id, deny:[PermissionFlagsBits.SendMessages] },
          ...(supportRole ? [{ id:supportRole.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory] }] : []),
        ],
      });
    } else if (panel.parentId !== category.id) {
      await panel.setParent(category.id).catch(() => {});
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('omnix_ticket_create:support').setLabel('Support général').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('omnix_ticket_create:premium').setLabel('Support Premium').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('omnix_ticket_create:partnership').setLabel('Partenariat').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Centre de support').setDescription('Besoin d’aide ? Choisissez le type de demande correspondant à votre besoin. Un salon privé sera créé automatiquement.')
      .addFields(
        { name:'Support général', value:'Question, problème technique ou aide sur OMNIX.', inline:false },
        { name:'Support Premium', value:'Question concernant votre licence ou une fonctionnalité Premium.', inline:false },
        { name:'Partenariat', value:'Proposition ou demande de partenariat avec OMNIX.', inline:false },
      ).setFooter({ text:'OMNIX · Support officiel' }).setTimestamp();

    await panel.send({ embeds:[embed], components:[row] });

    await updateGuildConfig(interaction.guildId, {
      modules: {
        tickets: {
          enabled: true,
          categoryId: category.id,
          panelChannelId: panel.id,
          ...(supportRole ? { supportRoleId: supportRole.id } : {}),
        },
      },
    });

    return interaction.reply({ embeds:[new EmbedBuilder().setColor(0x10b981).setTitle('Tickets OMNIX configurés').setDescription(`Le système est prêt.\n\nPanneau : <#${panel.id}>\nCatégorie : <#${category.id}>\nRôle support : ${supportRole ? `<@&${supportRole.id}>` : 'aucun rôle détecté'}`).setTimestamp()], flags:MessageFlags.Ephemeral });
  },
};
