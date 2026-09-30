import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import GuildTicket from '../../models/GuildTicket';
import ModerationCase from '../../models/ModerationCase';
import PlatformEvent from '../../models/PlatformEvent';

const OMNIX = 0x7c5cff;

export default {
  data: new SlashCommandBuilder()
    .setName('brief')
    .setDescription('Prépare un brief staff des dernières 24 heures')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: any) {
    if (!interaction.guild) return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', flags: 64 });
    await interaction.deferReply({ flags: 64 });

    const since = new Date(Date.now() - 86400000);
    const guildId = interaction.guild.id;
    const [joins, leaves, errors, tickets, closedTickets, cases] = await Promise.all([
      PlatformEvent.countDocuments({ guildId, type: 'member_joined', createdAt: { $gte: since } }),
      PlatformEvent.countDocuments({ guildId, type: 'member_left', createdAt: { $gte: since } }),
      PlatformEvent.countDocuments({ guildId, type: 'command_error', createdAt: { $gte: since } }),
      GuildTicket.countDocuments({ guildId, status: 'open' }),
      GuildTicket.countDocuments({ guildId, status: 'closed', closedAt: { $gte: since } }),
      ModerationCase.countDocuments({ guildId, createdAt: { $gte: since } }),
    ]);

    const tone = errors === 0 && tickets < 5 ? '🟢 Stable' : errors > 0 || tickets >= 5 ? '🟠 À surveiller' : '🟡 Normal';
    const net = joins - leaves;
    const notes = [
      `${net >= 0 ? '📈' : '📉'} Évolution membres : ${net >= 0 ? '+' : ''}${net}`,
      `🎫 ${tickets} ticket(s) actuellement ouvert(s), ${closedTickets} clôturé(s) aujourd’hui`,
      `🛡️ ${cases} action(s) de modération sur 24 h`,
      errors === 0 ? '✅ Aucune erreur de commande enregistrée.' : `⚠️ ${errors} erreur(s) de commande à vérifier.`,
    ];

    const embed = new EmbedBuilder()
      .setColor(OMNIX)
      .setTitle('✦ OMNIX Staff Brief')
      .setDescription(`**${interaction.guild.name}** · dernières 24 heures\nÉtat général : **${tone}**`)
      .addFields({ name: 'Résumé opérationnel', value: notes.join('\n') }, { name: 'Utilisation', value: 'Utilisez `/pulse` pour une lecture plus complète de la santé de la communauté.' })
      .setFooter({ text: 'OMNIX · Staff Intelligence' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
