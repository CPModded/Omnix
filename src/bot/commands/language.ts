import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { CONFIG } from '../../config';
import { SUPPORTED_LOCALES, normalizeLocale, setGuildLanguageRole } from '../../services/localization';
import GuildConfig from '../../models/GuildConfig';

export default {
  data: new SlashCommandBuilder().setName('language').setDescription('Gère les langues automatiques d’OMNIX (Owner uniquement).')
    .addSubcommand(s => s.setName('set').setDescription('Définit la langue du serveur.').addStringOption(o => o.setName('locale').setDescription('Code langue').setRequired(true).addChoices(...SUPPORTED_LOCALES.map(l => ({ name:l, value:l })))) )
    .addSubcommand(s => s.setName('auto').setDescription('Active ou désactive la détection automatique.').addBooleanOption(o => o.setName('enabled').setDescription('Détection automatique').setRequired(true)))
    .addSubcommand(s => s.setName('role').setDescription('Associe un rôle à une langue.').addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)).addStringOption(o => o.setName('locale').setDescription('Langue').setRequired(true).addChoices(...SUPPORTED_LOCALES.map(l => ({ name:l, value:l })))) )
    .addSubcommand(s => s.setName('status').setDescription('Affiche la configuration des langues.')),
  async execute(interaction:any) {
    if (!CONFIG.OWNER_IDS.includes(String(interaction.user.id))) return interaction.reply({ content:'Cette commande est réservée au propriétaire d’OMNIX.', flags:MessageFlags.Ephemeral });
    const sub=interaction.options.getSubcommand();
    const config:any=await GuildConfig.findOne({guildId:interaction.guildId});
    if (!config) return interaction.reply({content:'Configuration du serveur introuvable.',flags:MessageFlags.Ephemeral});
    if(sub==='set'){ config.locale=normalizeLocale(interaction.options.getString('locale')); await config.save(); return interaction.reply({embeds:[new EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Langue').setDescription(`Langue du serveur définie sur **${config.locale}**.`)]}); }
    if(sub==='auto'){ config.autoLocale=interaction.options.getBoolean('enabled'); await config.save(); return interaction.reply({content:`Détection automatique ${config.autoLocale?'activée':'désactivée'}.`,flags:MessageFlags.Ephemeral}); }
    if(sub==='role'){ const role=interaction.options.getRole('role'); const locale=normalizeLocale(interaction.options.getString('locale')); await setGuildLanguageRole(interaction.guildId, role.id, locale); return interaction.reply({content:`Le rôle ${role} utilise maintenant **${locale}**.`,flags:MessageFlags.Ephemeral}); }
    return interaction.reply({embeds:[new EmbedBuilder().setColor(0x7c5cff).setTitle('OMNIX · Langues').setDescription(`Auto : **${config.autoLocale!==false?'activée':'désactivée'}**\nLangue serveur : **${config.locale}**\nRôles configurés : **${Object.keys(config.languageRoles||{}).length}**`)]});
  }
};
