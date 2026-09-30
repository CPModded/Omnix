import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';

const OMNIX = 0x7c5cff;

export default {
  data: new SlashCommandBuilder()
    .setName('blueprint')
    .setDescription('Analyse la structure du serveur et propose un plan d’amélioration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: any) {
    if (!interaction.guild) return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', flags: 64 });
    await interaction.deferReply({ flags: 64 });

    const config: any = await GuildConfig.findOne({ guildId: interaction.guild.id }).lean();
    const channels = interaction.guild.channels.cache;
    const roles = interaction.guild.roles.cache;
    const categories = channels.filter((c: any) => c.type === 4).size;
    const text = channels.filter((c: any) => c.isTextBased?.() && c.type !== 13).size;
    const voice = channels.filter((c: any) => c.isVoiceBased?.()).size;

    const recommendations: string[] = [];
    if (!config?.modules?.logs?.enabled) recommendations.push('Créer un espace de logs séparé pour garder une trace des événements sensibles.');
    if (!config?.modules?.welcome?.enabled) recommendations.push('Mettre en place un accueil guidé pour les nouveaux membres.');
    if (!config?.modules?.tickets?.enabled) recommendations.push('Prévoir un point d’entrée support unique plutôt que plusieurs salons d’assistance.');
    if (!config?.modules?.suggestions?.enabled) recommendations.push('Ajouter un espace de suggestions avec décision publique du staff.');
    if (!config?.modules?.antiSpam?.enabled && !config?.modules?.autoMod?.enabled) recommendations.push('Activer au moins une couche anti-spam/AutoMod.');
    if (categories > 20) recommendations.push('Votre serveur possède beaucoup de catégories : envisagez de regrouper les espaces rarement utilisés.');
    if (roles.size > 80) recommendations.push('Le nombre de rôles est élevé : regrouper les rôles fonctionnels peut simplifier la gestion.');
    if (recommendations.length === 0) recommendations.push('La structure est cohérente. Conservez un point d’entrée simple et mesurez l’activité avant d’ajouter de nouveaux modules.');

    const embed = new EmbedBuilder()
      .setColor(OMNIX)
      .setTitle('✦ OMNIX Blueprint')
      .setDescription(`**Architecture de ${interaction.guild.name}**\nOmnix analyse la structure actuelle sans modifier votre serveur.`)
      .addFields(
        { name: '🏗️ Structure', value: `Catégories **${categories}**\nTextuels **${text}** · Vocaux **${voice}**\nRôles **${roles.size}**`, inline: true },
        { name: '🧩 Omnix', value: `Modules actifs : **${Object.values(config?.modules || {}).filter((m: any) => m?.enabled).length}**\nPremium : **${config?.premium?.isPremium ? 'Actif' : 'Standard'}**`, inline: true },
        { name: '🧭 Plan proposé', value: recommendations.slice(0, 6).map((r) => `• ${r}`).join('\n'), inline: false },
      )
      .setFooter({ text: 'OMNIX · Blueprint · Analyse sans modification automatique' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
