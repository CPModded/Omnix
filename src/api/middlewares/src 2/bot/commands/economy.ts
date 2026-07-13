import { SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../types';
import { Economy } from '../../models/Economy';

const economyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Gérer votre portefeuille et votre banque virtuelle')
    .addSubcommand(sub => sub.setName('balance').setDescription('Afficher votre solde actuel'))
    .addSubcommand(sub => sub.setName('work').setDescription('Travailler pour gagner des pièces')) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const currency = guildConfig.modules.economy.currencySymbol || '$';

    if (!guildConfig.modules.economy.enabled) {
      return interaction.reply({
        content: "Le module d'économie n'est pas activé sur ce serveur.",
        ephemeral: true
      });
    }

    // Récupération ou création du compte d'économie isolé
    let account = await Economy.findOne({ guildId, userId });
    if (!account) {
      account = new Economy({ guildId, userId });
      await account.save();
    }

    if (subcommand === 'balance') {
      return interaction.reply({
        content: `💳 **Vos finances locales :**\n• Portefeuille : \`${account.wallet}${currency}\`\n• Banque : \`${account.bank}${currency}\``,
        ephemeral: true
      });
    }

    if (subcommand === 'work') {
      const cooldown = 60 * 60 * 1000; // Cooldown de 1 heure
      const now = new Date();

      if (account.lastWork && (now.getTime() - account.lastWork.getTime() < cooldown)) {
        const timeLeft = cooldown - (now.getTime() - account.lastWork.getTime());
        const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
        return interaction.reply({
          content: `⏳ Vous êtes fatigué. Veuillez attendre encore **${minutesLeft} minute(s)** avant de travailler à nouveau.`,
          ephemeral: true
        });
      }

      // Gain aléatoire
      const gain = Math.floor(Math.random() * 80) + 20; // Entre 20 et 100
      account.wallet += gain;
      account.lastWork = now;
      await account.save();

      return interaction.reply({
        content: `🛠️ Vous avez travaillé dur et gagné **${gain}${currency}** ! Votre nouveau solde est de \`${account.wallet}${currency}\`.`
      });
    }
  }
};

export default economyCommand;