/**
 * ====================================================================
 * CONSOLE D'ADMINISTRATION DISCORD (STAFF OMNIX ONLY)
 * ====================================================================
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command, CommandContext } from '../types';
import { CONFIG } from '../../config';
import { User } from '../../models/User';
import { GuildConfig } from '../../models/GuildConfig';
import { SystemMonitor } from '../../utils/systemMonitor';

const adminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Console d\'administration globale (Réservé au Staff OMNIX)')
    // Sous-commande 1 : Licences Utilisateurs
    .addSubcommand(sub =>
      sub.setName('user-premium')
        .setDescription('Modifier l\'abonnement Premium personnel d\'un membre')
        .addUserOption(opt => opt.setName('target').setDescription('Membre concerné').setRequired(true))
        .addStringOption(opt => opt.setName('action').setDescription('Action à effectuer').setRequired(true).addChoices(
          { name: 'Donner', value: 'give' },
          { name: 'Retirer', value: 'remove' }
        ))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Durée de l\'abonnement (Jours, 0 pour Lifetime)').setRequired(true))
    )
    // Sous-commande 2 : Licences Serveurs
    .addSubcommand(sub =>
      sub.setName('guild-premium')
        .setDescription('Modifier l\'abonnement Premium d\'un serveur')
        .addStringOption(opt => opt.setName('guild_id').setDescription('ID numérique de la Guild').setRequired(true))
        .addStringOption(opt => opt.setName('action').setDescription('Action à effectuer').setRequired(true).addChoices(
          { name: 'Donner', value: 'give' },
          { name: 'Retirer', value: 'remove' }
        ))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Durée de l\'abonnement (Jours, 0 pour Lifetime)').setRequired(true))
    )
    // Sous-commande 3 : Blacklist Platform
    .addSubcommand(sub =>
      sub.setName('blacklist')
        .setDescription('Bannir ou débannir un utilisateur du Dashboard OMNIX')
        .addUserOption(opt => opt.setName('target').setDescription('Utilisateur concerné').setRequired(true))
        .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true).addChoices(
          { name: 'Bannir', value: 'add' },
          { name: 'Débannir', value: 'remove' }
        ))
        .addStringOption(opt => opt.setName('reason').setDescription('Motif de la sanction'))
    )
    // Sous-commande 4 : Métriques Système
    .addSubcommand(sub =>
      sub.setName('system-stats')
        .setDescription('Consulter l\'état de santé et de latence d\'OMNIX')
    )
    // Sous-commande 5 : Annonce Globale
    .addSubcommand(sub =>
      sub.setName('global-announce')
        .setDescription('Diffuser une annonce sur l\'ensemble des serveurs')
        .addStringOption(opt => opt.setName('message').setDescription('Contenu de l\'annonce textuelle').setRequired(true))
    ) as any,

  async execute({ interaction }: CommandContext) {
    const userId = interaction.user.id;

    // SÉCURITÉ ABSOLUE : Vérifie si le membre fait partie des Owners déclarés dans le .env
    const isOwner = CONFIG.DISCORD.OWNER_IDS.includes(userId);
    if (!isOwner) {
      return interaction.reply({
        content: "❌ Accès refusé. Cette commande est strictement réservée au Staff OMNIX.",
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // ----------------------------------------------------
    // SCÉNARIO 1 : LICENCES UTILISATEURS
    // ----------------------------------------------------
    if (subcommand === 'user-premium') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('target', true);
      const action = interaction.options.getString('action', true);
      const duration = interaction.options.getInteger('duration', true);

      try {
        const userDb = await User.findOne({ discordId: target.id });
        if (!userDb) {
          return interaction.editReply({ content: "❌ Cet utilisateur ne s'est encore jamais connecté au Dashboard." });
        }

        userDb.set('licenses', []);

        if (action === 'give') {
          let expiresAt: Date | null = null;
          if (duration > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + duration);
          }

          const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
          userDb.licenses.push({
            licenseKey: `OMNIX-USER-${rand}`,
            tier: duration === 0 ? 'lifetime' : 'premium',
            status: 'active',
            activatedGuildId: null,
            expiresAt: expiresAt
          });
        }

        await userDb.save();
        return interaction.editReply({
          content: `✅ **Licence utilisateur mise à jour pour ${target.username} !**\n• Premium : \`${action === 'give' ? 'ACTIF' : 'INACTIF'}\`\n• Durée : \`${duration === 0 ? 'À VIE' : duration + ' jours'}\``
        });
      } catch (err: any) {
        return interaction.editReply({ content: "❌ Impossible d'enregistrer la licence en base : " + err.message });
      }
    }

    // ----------------------------------------------------
    // SCÉNARIO 2 : LICENCES SERVEURS (GUILDS)
    // ----------------------------------------------------
    if (subcommand === 'guild-premium') {
      await interaction.deferReply({ ephemeral: true });
      const targetGuildId = interaction.options.getString('guild_id', true);
      const action = interaction.options.getString('action', true);
      const duration = interaction.options.getInteger('duration', true);

      try {
        let config = await GuildConfig.findOne({ guildId: targetGuildId });
        if (!config) {
          config = new GuildConfig({ guildId: targetGuildId });
        }

        if (action === 'give') {
          let expiresAt: Date | null = null;
          if (duration > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + duration);
          }
          config.premium.isPremium = true;
          config.premium.tier = duration === 0 ? 'lifetime' : 'premium';
          config.premium.expiresAt = expiresAt;
        } else {
          config.premium.isPremium = false;
          config.premium.tier = 'free';
          config.premium.expiresAt = null;
        }

        await config.save();
        return interaction.editReply({
          content: `✅ **Licence serveur mise à jour pour la Guild \`${targetGuildId}\` !**\n• Premium : \`${action === 'give' ? 'ACTIF' : 'INACTIF'}\`\n• Durée : \`${duration === 0 ? 'À VIE' : duration + ' jours'}\``
        });
      } catch (err: any) {
        return interaction.editReply({ content: "❌ Impossible d'enregistrer la licence serveur : " + err.message });
      }
    }

    // ----------------------------------------------------
    // SCÉNARIO 3 : BLACKLIST PLATFORM
    // ----------------------------------------------------
    if (subcommand === 'blacklist') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('target', true);
      const action = interaction.options.getString('action', true);
      const reason = interaction.options.getString('reason') || 'Aucune raison fournie.';

      try {
        const userDb = await User.findOne({ discordId: target.id });
        if (!userDb) {
          return interaction.editReply({ content: "❌ Cet utilisateur ne s'est jamais connecté au Dashboard." });
        }

        if (userDb.isAdmin && action === 'add') {
          return interaction.editReply({ content: "❌ Impossible de blacklister un administrateur du staff." });
        }

        userDb.isBlacklisted = (action === 'add');
        await userDb.save();

        return interaction.editReply({
          content: `🛑 **Statut de bannissement d'OMNIX mis à jour pour ${target.username} !**\n• Blacklist : \`${userDb.isBlacklisted ? 'ACTIF' : 'INACTIF'}\`\n• Raison : *${reason}*`
        });
      } catch (err: any) {
        return interaction.editReply({ content: "❌ Impossible de modifier la blacklist : " + err.message });
      }
    }

    // ----------------------------------------------------
    // SCÉNARIO 4 : MÉTRIQUES SYSTÈME
    // ----------------------------------------------------
    if (subcommand === 'system-stats') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const stats = await SystemMonitor.getStats();
        
        const embed = new EmbedBuilder()
          .setTitle('📝 CONSOLE D\'ANALYSE OMNIX')
          .setColor(0x7c3aed)
          .addFields(
            { name: '💻 Charge CPU', value: `\`${stats.system.cpuLoad[0].toFixed(2)}%\``, inline: true },
            { name: '💾 Mémoire RAM', value: `\`${stats.system.freeMem}Mo / ${stats.system.totalMem}Mo\` (${stats.system.memUsagePercent}%)`, inline: true },
            { name: '⚡ Latence API', value: `\`${stats.bot.ping}ms\``, inline: true },
            { name: '📁 Serveurs Actifs', value: `\`${stats.bot.guildsCount}\``, inline: true },
            { name: '👤 Utilisateurs Inscrits', value: `\`${stats.database.totalUsers}\``, inline: true },
            { name: '💎 Serveurs Premium', value: `\`${stats.database.premiumGuilds}\``, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        return interaction.editReply({ content: "❌ Échec de la collecte des métriques : " + err.message });
      }
    }

    // ----------------------------------------------------
    // SCÉNARIO 5 : ANNONCE GLOBALE
    // ----------------------------------------------------
    if (subcommand === 'global-announce') {
      await interaction.deferReply({ ephemeral: true });
      const message = interaction.options.getString('message', true);

      try {
        let count = 0;
        for (const [id, guild] of interaction.client.guilds.cache) {
          const targetChannel = guild.systemChannel || guild.channels.cache.find(
            ch => ch.isTextBased() && ch.permissionsFor(guild.members.me!).has('SendMessages')
          );
          if (targetChannel && 'send' in targetChannel) {
            await targetChannel.send({ content: `📢 **Annonce Globale OMNIX**\n\n${message}` }).catch(() => null);
            count++;
          }
        }
        return interaction.editReply({ content: `✅ Annonce globale diffusée avec succès sur **${count}** serveurs.` });
      } catch (err: any) {
        return interaction.editReply({ content: "❌ Impossible de diffuser l'annonce : " + err.message });
      }
    }
  }
};

export default adminCommand;