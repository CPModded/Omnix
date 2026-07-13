import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { Command, CommandContext } from '../types';

const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Créer un ticket de support privé')
    .addSubcommand(sub => sub.setName('open').setDescription('Ouvrir un nouveau ticket')) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (!guildConfig.modules.tickets.enabled) {
      return interaction.reply({
        content: "Le module de tickets de support n'est pas activé sur ce serveur.",
        ephemeral: true
      });
    }

    if (subcommand === 'open') {
      await interaction.deferReply({ ephemeral: true });

      // Incrémentation du compteur de tickets local
      guildConfig.modules.tickets.counter += 1;
      await guildConfig.save();

      const ticketNumber = guildConfig.modules.tickets.counter;
      const channelName = `ticket-${ticketNumber.toString().padStart(4, '0')}`;

      try {
        // Création du salon textuel avec des permissions strictes
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: guildConfig.modules.tickets.categoryId || undefined, // Catégorie configurée sur le Dashboard
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel] // Cacher le salon à tout le monde
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ] // Autoriser l'auteur
            }
          ]
        });

        await ticketChannel.send({
          content: `👋 Bonjour ${interaction.user}, un membre de l'équipe va prendre en charge votre demande. Vous pouvez décrire votre problème ici.`
        });

        return interaction.editReply({
          content: `✅ Votre ticket a été créé avec succès : ${ticketChannel}`
        });

      } catch (error: any) {
        console.error('[Ticket Error] Impossible de créer le salon de ticket:', error.message);
        return interaction.editReply({
          content: "Une erreur est survenue lors de la création de votre salon de ticket. Veuillez vérifier les permissions d'administration du bot."
        });
      }
    }
  }
};

export default ticketCommand;