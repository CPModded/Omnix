/**
 * ====================================================================
 * CONTRÔLEUR DES SERVEURS DISCORD (ALIMENTATION DU CACHE PARTAGÉ)
 * ====================================================================
 */

import { Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from '../middlewares/auth';
import { adminAccessCache } from '../middlewares/guildAuth'; // Import du cache de sécurité partagé

// Cache local d'affichage des serveurs pour limiter les appels réseau
const userGuildsCache = new Map<string, { guilds: any[]; expiresAt: number }>();

export class GuildsController {
  static async getUserGuilds(req: AuthenticatedRequest, res: Response) {
    const accessToken = req.user?.discordAccessToken;
    const userId = req.user?.discordId;
    const username = req.user?.username;

    console.log(`[Guilds] 📥 Récupération des serveurs Discord pour : ${username}`);

    if (!accessToken || !userId) {
      console.warn(`[Guilds] ❌ Jeton d'accès absent pour l'utilisateur : ${username}`);
      return res.status(401).json({ error: 'Jeton d\'accès Discord requis.' });
    }

    const now = Date.now();
    const cachedData = userGuildsCache.get(userId);

    // Si le cache local d'affichage est encore valide (moins de 2 minutes), on l'envoie
    if (cachedData && cachedData.expiresAt > now) {
      console.log(`[Guilds] ⚡ Cache valide trouvé pour ${username}. Renvoi de ${cachedData.guilds.length} serveurs (0ms).`);
      return res.json(cachedData.guilds);
    }

    console.log(`[Guilds] 🌐 Pas de cache actif. Envoi d'une requête réseau vers l'API de Discord...`);

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
        const ADMIN_PERMISSION = BigInt(0x8); // Bitmask ADMINISTRATOR
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

      // Enregistrement dans le cache local d'affichage
      userGuildsCache.set(userId, {
        guilds: adminGuilds,
        expiresAt: now + 120 * 1000 // Cache d'affichage de 2 minutes
      });

      return res.json(adminGuilds);
    } catch (error: any) {
      console.error(`[Guilds] ❌ Échec de la requête vers l'API Discord :`, error?.response?.data || error.message);
      
      // En cas de panne de Discord, on tente de renvoyer le dernier cache d'affichage expiré
      if (cachedData) {
        console.warn(`[Guilds] ⚠️ API Discord saturée. Utilisation du cache d'affichage de secours.`);
        return res.json(cachedData.guilds);
      }

      return res.status(500).json({ error: 'Impossible de récupérer vos serveurs.' });
    }
  }
}