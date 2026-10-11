import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildVerificationLevel,
  GuildPremiumTier
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Affiche les informations détaillées du serveur'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée sur un serveur.',
        ephemeral: true
      });
    }

    const owner = await guild.fetchOwner().catch(() => null);

    const verificationNames: Record<number, string> = {
      [GuildVerificationLevel.None]: 'Aucune',
      [GuildVerificationLevel.Low]: 'Faible',
      [GuildVerificationLevel.Medium]: 'Moyenne',
      [GuildVerificationLevel.High]: 'Élevée',
      [GuildVerificationLevel.VeryHigh]: 'Très élevée'
    };

    const premiumNames: Record<number, string> = {
      [GuildPremiumTier.None]: 'Aucun',
      [GuildPremiumTier.Tier1]: 'Niveau 1',
      [GuildPremiumTier.Tier2]: 'Niveau 2',
      [GuildPremiumTier.Tier3]: 'Niveau 3'
    };

    const textChannels = guild.channels.cache.filter(
      channel => channel.isTextBased() && !channel.isVoiceBased()
    ).size;

    const voiceChannels = guild.channels.cache.filter(
      channel => channel.isVoiceBased()
    ).size;

    const categories = guild.channels.cache.filter(
      channel => channel.type === 4
    ).size;

    const roles = guild.roles.cache.filter(
      role => role.id !== guild.id
    ).size;

    const bots = guild.members.cache.filter(
      member => member.user.bot
    ).size;

    const humans = guild.memberCount - bots;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 Informations — ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 1024 }))
      .addFields(
        {
          name: '👑 Propriétaire',
          value: owner
            ? `${owner.user.tag}\n\`${owner.id}\``
            : 'Inconnu',
          inline: true
        },
        {
          name: '🆔 Identifiant',
          value: `\`${guild.id}\``,
          inline: true
        },
        {
          name: '👥 Membres',
          value:
            `Total : **${guild.memberCount}**\n` +
            `Humains : **${humans}**\n` +
            `Bots : **${bots}**`,
          inline: true
        },
        {
          name: '📁 Salons',
          value:
            `Texte : **${textChannels}**\n` +
            `Vocal : **${voiceChannels}**\n` +
            `Catégories : **${categories}**`,
          inline: true
        },
        {
          name: '🎭 Rôles',
          value: `**${roles}** rôles`,
          inline: true
        },
        {
          name: '🚀 Boost',
          value:
            `Niveau : **${premiumNames[guild.premiumTier]}**\n` +
            `Boosts : **${guild.premiumSubscriptionCount ?? 0}**`,
          inline: true
        },
        {
          name: '🛡️ Sécurité',
          value:
            `Vérification : **${verificationNames[guild.verificationLevel]}**`,
          inline: true
        },
        {
          name: '📅 Création',
          value:
            `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n` +
            `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      )
      .setFooter({
        text: `OMNIX • ${interaction.user.tag}`
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }
};