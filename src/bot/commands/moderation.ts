import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Command, CommandContext } from '../types';

const moderationCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Outils de modération du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => 
      sub.setName('ban')
        .setDescription('Bannir un utilisateur du serveur')
        .addUserOption(opt => opt.setName('target').setDescription('Membre à bannir').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Raison du bannissement'))
    ) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'Aucune raison fournie.';
    const guild = interaction.guild!;

    if (!guildConfig.modules.moderation.enabled) {
      return interaction.reply({
        content: "Le module de modération est désactivé sur ce serveur.",
        ephemeral: true
      });
    }

    if (subcommand === 'ban') {
      const member = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        return interaction.reply({ content: "Cet utilisateur n'est pas présent sur ce serveur.", ephemeral: true });
      }

      // Vérification de la hiérarchie de rôles
      if (!member.bannable) {
        return interaction.reply({
          content: "Impossible de bannir ce membre. Son rôle est supérieur ou égal au mien.",
          ephemeral: true
        });
      }

      try {
        await member.ban({ reason: `Modérateur: ${interaction.user.tag} | Raison: ${reason}` });
        
        // Logique optionnelle d'enregistrement d'historique dans les logs du serveur
        if (guildConfig.modules.moderation.logChannelId) {
          const logChannel = await guild.channels.fetch(guildConfig.modules.moderation.logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            await logChannel.send({
              content: `🚨 **Bannissement** | Membre : ${targetUser.tag} (${targetUser.id})\n• Modérateur : ${interaction.user.tag}\n• Raison : ${reason}`
            });
          }
        }

        return interaction.reply({
          content: `🔨 **${targetUser.tag}** a été banni pour la raison suivante : *${reason}*`
        });

      } catch (error: any) {
        console.error('[Moderation Error] Échec du bannissement:', error.message);
        return interaction.reply({
          content: "Échec de l'application de la sanction. Veuillez réessayer.",
          ephemeral: true
        });
      }
    }
  }
};

export default moderationCommand;