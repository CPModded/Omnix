/**
 * ====================================================================
 * CONTRÔLEUR DES SERVEURS DISCORD (ALIMENTATION DU CACHE PARTAGÉ)
 * Récupère, filtre et enregistre les droits d'administration dans le
 * cache de sécurité partagé pour éviter d'interroger Discord.
 * ====================================================================
 */

import { Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from '../middlewares/auth';
import { adminAccessCache } from '../middlewares/guildAuth'; // Import du cache de sécurité partagé

// Cache local d'affichage
const userGuildsCache = new Map<string, { guilds: any[]; expiresAt: number }>();

export class GuildsController {
  static async getUserGuilds(req: AuthenticatedRequest, res: Response) {
    const accessToken = req.user?.discordAccessToken;
    const userId = req.user?.discordId;
    const username = req.user?.username;

    console.log(`[Guilds] 📥 Début de récupération des serveurs pour : ${username}`);

    if (!accessToken || !userId) {
      console.warn(`[Guilds] ❌ Jeton d'accès absent pour ${username}`);
      return res.status(401).json({ error: 'Jeton d\'accès Discord requis.' });
    }

    const now = Date.now();
    const cachedData = userGuildsCache.get(userId);

    if (cachedData && cachedData.expiresAt > now) {
      console.log(`[Guilds] ⚡ Cache valide trouvé pour ${username}. Renvoi de ${cachedData.guilds.length} serveurs.`);
      return res.json(cachedData.guilds);
    }

    console.log(`[Guilds] 🌐 Envoi d'une requête réseau vers l'API de Discord...`);

    try {
      const response = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000 
      });

      const guilds = response.data;
      console.log(`[Guilds] 📥 Réponse reçue de Discord : ${guilds.length} serveurs au total.`);

      // Filtrer pour n'afficher que les serveurs où l'utilisateur détient la permission ADMINISTRATOR (0x8)
      const adminGuilds = guilds.filter((guild: any) => {
        const permissions = BigInt(guild.permissions);
        const ADMIN_PERMISSION = BigInt(0x8);
        return (permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION;
      });

      // ALIMENTATION DU CACHE DE SÉCURITÉ PARTAGÉ :
      // On extrait uniquement les IDs de serveurs et on les enregistre pour le filtre canManageGuild
      const adminGuildIds = adminGuilds.map((g: any) => g.id);
      adminAccessCache.set(userId, {
        guilds: adminGuildIds,
        expiresAt: now + 5 * 60 * 1000 // Cache d'administration de 5 minutes
      });
      console.log(`[Guilds] 🛡️ [CACHE PARTAGÉ] Droits d'administration de ${username} enregistrés dans la sécurité.`);

      // Enregistrement dans le cache d'affichage
      userGuildsCache.set(userId, {
        guilds: adminGuilds,
        expiresAt: now + 120 * 1000
      });

      return res.json(adminGuilds);
    } catch (error: any) {
      console.error(`[Guilds] ❌ Échec de la requête vers l'API Discord :`, error?.response?.data || error.message);
      
      if (cachedData) {
        console.warn(`[Guilds] ⚠️ API Discord saturée. Utilisation du cache d'affichage expiré.`);
        return res.json(cachedData.guilds);
      }

      return res.status(500).json({ error: 'Impossible de récupérer vos serveurs.' });
    }
  }
}