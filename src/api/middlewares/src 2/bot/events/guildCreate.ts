/**
 * ====================================================================
 * ÉVÉNEMENT : ENTRÉE DU BOT SUR UN SERVEUR (AUTO-SYNC PREMIUM)
 * Détecte le propriétaire et applique automatiquement son statut
 * Premium personnel sur la configuration du serveur (Multi-Tenant).
 * ====================================================================
 */

import { Events, Guild } from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig';
import { User } from '../../models/User';

export default {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    const guildId = guild.id;
    const ownerId = guild.ownerId;

    console.log(`[Bot Sync] 📥 OMNIX a rejoint le serveur : ${guild.name} (${guildId})`);

    try {
      // 1. Recherche ou création de la configuration isolée du serveur
      let guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) {
        guildConfig = new GuildConfig({ guildId });
      }

      // 2. Recherche du propriétaire du serveur en base de données
      const ownerDb = await User.findOne({ discordId: ownerId });

      if (ownerDb) {
        // On vérifie si le propriétaire possède une licence personnelle Premium active
        const hasUserPremium = ownerDb.licenses.some(
          lic => lic.status === 'active' && lic.activatedGuildId === null
        );

        if (hasUserPremium) {
          // Activation automatique du Premium pour ce serveur
          guildConfig.premium.isPremium = true;
          guildConfig.premium.tier = 'premium';
          guildConfig.premium.expiresAt = null; // Suit la validité de l'utilisateur

          await guildConfig.save();
          console.log(`[Bot Sync] 💎 [PREMIUM AUTOMATIQUE] Le serveur de ${ownerDb.username} a été activé en Premium.`);
          return;
        }
      }

      // Enregistrement par défaut (version d'évaluation gratuite)
      await guildConfig.save();
      console.log(`[Bot Sync] ✅ Configuration d'évaluation FREE enregistrée pour ${guild.name}`);

    } catch (error: any) {
      console.error(`[Bot Sync Error] Échec de la synchronisation lors de l'entrée sur ${guild.name} :`, error.message);
    }
  }
};