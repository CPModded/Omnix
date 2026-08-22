/**
 * ====================================================================
 * ÉVÉNEMENT : ENTRÉE DU BOT SUR UN SERVEUR
 * ====================================================================
 *
 * Lorsqu'OMNIX rejoint un nouveau serveur :
 *
 * 1. On récupère l'ID du serveur.
 * 2. On récupère l'ID du propriétaire.
 * 3. On crée/récupère la configuration MongoDB du serveur.
 * 4. On vérifie si le propriétaire possède une licence Premium.
 * 5. Si oui, le serveur bénéficie automatiquement du Premium.
 *
 * IMPORTANT :
 * Chaque serveur possède sa propre configuration MongoDB.
 * Aucun serveur ne doit partager sa configuration avec un autre.
 * ====================================================================
 */

import { Events } from 'discord.js';
import type { Guild } from 'discord.js';

import GuildConfig from '../../models/GuildConfig.ts';
import { User } from '../../models/User.ts';

export default {
  name: Events.GuildCreate,
  once: false,

  async execute(guild: Guild): Promise<void> {
    const guildId = guild.id;
    const ownerId = guild.ownerId;

    console.log(
      `[Bot Sync] 📥 OMNIX a rejoint le serveur : ${guild.name} (${guildId})`
    );

    try {
      /*
       * ============================================================
       * 1. RÉCUPÉRATION / CRÉATION DE LA CONFIGURATION DU SERVEUR
       * ============================================================
       */

      let guildConfig = await GuildConfig.findOne({
        guildId,
      });

      if (!guildConfig) {
        guildConfig = new GuildConfig({
          guildId,
        });

        console.log(
          `[Bot Sync] 🆕 Nouvelle configuration créée pour ${guild.name}`
        );
      }

      /*
       * ============================================================
       * 2. RECHERCHE DU PROPRIÉTAIRE
       * ============================================================
       */

      const ownerDb = await User.findOne({
        discordId: ownerId,
      });

      /*
       * ============================================================
       * 3. VÉRIFICATION PREMIUM
       * ============================================================
       */

      if (ownerDb) {
        const hasUserPremium = ownerDb.licenses?.some(
          (license) =>
            license.status === 'active' &&
            license.activatedGuildId === null
        ) ?? false;

        if (hasUserPremium) {
          guildConfig.premium.isPremium = true;
          guildConfig.premium.tier = 'premium';
          guildConfig.premium.expiresAt = null;

          await guildConfig.save();

          console.log(
            `[Bot Sync] 💎 PREMIUM AUTOMATIQUE activé pour ${guild.name}`
          );

          return;
        }
      }

      /*
       * ============================================================
       * 4. SERVEUR FREE / TRIAL
       * ============================================================
       */

      await guildConfig.save();

      console.log(
        `[Bot Sync] ✅ Configuration FREE enregistrée pour ${guild.name}`
      );

    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `[Bot Sync Error] ❌ Échec de la synchronisation pour ${guild.name}:`,
        message
      );
    }
  },
};