/**
 * ====================================================================
 * CONTRÔLEUR D'ADMINISTRATION GLOBALE (OMNIX STAFF CORE)
 * Permet au staff de surveiller le système, de lister les membres
 * et d'octroyer ou de révoquer des licences Premium en temps réel.
 * ====================================================================
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { GuildConfig } from '../../models/GuildConfig';
import { SystemMonitor } from '../../utils/systemMonitor';
import { client as botClient } from '../../bot/client';
import { User } from '../../models/User';

export class AdminController {
  // 1. Récupération des données d'analyse de performance (Monitoring)
  static async getMonitoring(req: AuthenticatedRequest, res: Response) {
    try {
      const stats = await SystemMonitor.getStats();
      return res.json(stats);
    } catch (error: any) {
      return res.status(500).json({ error: 'Échec de la collecte des métriques.' });
    }
  }

  // 2. Gestion de l'octroi de la licence Premium (Serveur OU Utilisateur Personnel)
  static async togglePremium(req: AuthenticatedRequest, res: Response) {
    const { guildId, isPremium, tier, durationInDays } = req.body;

    try {
      // SCÉNARIO A : Attribution d'une licence personnelle au membre (Bypass de serveur)
      if (guildId === 'USER_LICENSE') {
        const userId = req.body.userId || req.user?.discordId;
        if (!userId) {
          return res.status(400).json({ error: 'ID utilisateur Discord manquant.' });
        }

        const user = await User.findOne({ discordId: userId });
        if (!user) {
          return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        // Réinitialise les licences utilisateur de ce membre
        user.licenses = [];
        
        if (isPremium) {
          const now = new Date();
          const expiresAt = new Date();
          expiresAt.setDate(now.getDate() + durationInDays);

          // Génération d'une clé d'utilisateur unique
          const rand = Math.random().toString(36).substring(2, 8).toUpperCase();

          user.licenses.push({
            licenseKey: `WERI-USER-${rand}`,
            tier: tier || 'premium',
            status: 'active',
            activatedGuildId: null, // Indique que la licence suit l'utilisateur sur tous ses serveurs
            expiresAt: expiresAt
          });
        }

        await user.save();
        console.log(`[Admin API] ✅ Licence utilisateur mise à jour pour ${user.username} (Premium: ${isPremium})`);
        return res.json({ message: 'Licence utilisateur mise à jour.', user });
      }

      // SCÉNARIO B : Attribution d'une licence classique liée à un serveur (Guild ID)
      let config = await GuildConfig.findOne({ guildId });
      if (!config) {
        config = new GuildConfig({ guildId });
      }

      let expiresAt: Date | null = null;
      if (isPremium && durationInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationInDays);
      }

      config.premium.isPremium = isPremium;
      config.premium.tier = isPremium ? tier : 'free';
      config.premium.expiresAt = expiresAt;

      await config.save();
      console.log(`[Admin API] ✅ Licence serveur mise à jour pour ${guildId} (Premium: ${isPremium})`);

      return res.json({ message: `Statut premium du serveur ${guildId} mis à jour.`, config });
    } catch (error: any) {
      console.error('[Admin API] ❌ Erreur togglePremium :', error.message);
      return res.status(500).json({ error: 'Impossible de modifier le statut premium.' });
    }
  }

  // 3. Émission d'une annonce globale par le bot
  static async sendGlobalAnnouncement(req: AuthenticatedRequest, res: Response) {
    const { messageContent } = req.body;

    if (!messageContent) {
      return res.status(400).json({ error: 'Le contenu du message est requis.' });
    }

    try {
      let successfulSends = 0;

      for (const [guildId, guild] of botClient.guilds.cache) {
        const targetChannel = guild.systemChannel || guild.channels.cache.find(
          ch => ch.isTextBased() && ch.permissionsFor(guild.members.me!).has('SendMessages')
        );

        if (targetChannel && 'send' in targetChannel) {
          await targetChannel.send({ content: `📢 **Annonce Globale OMNIX**\n\n${messageContent}` }).catch(() => null);
          successfulSends++;
        }
      }

      return res.json({ message: `Annonce envoyée avec succès sur ${successfulSends} serveur(s).` });
    } catch (error: any) {
      return res.status(500).json({ error: 'Échec de l\'envoi de l\'annonce globale.' });
    }
  }

  // 4. Récupération de tous les utilisateurs inscrits en base (Réservé Staff)
  static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await User.find({}).sort({ createdAt: -1 });
      return res.json(users);
    } catch (error: any) {
      console.error('[Admin API] ❌ Échec de récupération des utilisateurs :', error.message);
      return res.status(500).json({ error: 'Impossible de récupérer la liste des utilisateurs.' });
    }
  }
}