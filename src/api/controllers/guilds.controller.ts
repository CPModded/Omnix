/**
 * ====================================================================
 * CONTRÔLEUR DES SERVEURS DISCORD (TRAÇAGE CONSOLE ET TIMEOUT)
 * ====================================================================
 */

import { Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from '../middlewares/auth';

const userGuildsCache = new Map<string, { guilds: any[]; expiresAt: number }>();

export class GuildsController {
  static async getUserGuilds(req: AuthenticatedRequest, res: Response) {
    const accessToken = req.user?.discordAccessToken;
    const userId = req.user?.discordId;
    const username = req.user?.username;

    console.log(`[Guilds] 📥 Début de récupération des serveurs pour l'utilisateur : ${username}`);

    if (!accessToken || !userId) {
      console.warn(`[Guilds] ❌ Échec : Jeton d'accès Discord absent dans la session de ${username}`);
      return res.status(401).json({ error: 'Jeton d\'accès Discord requis.' });
    }

    const now = Date.now();
    const cachedData = userGuildsCache.get(userId);

    // Vérification du Cache en mémoire
    if (cachedData && cachedData.expiresAt > now) {
      console.log(`[Guilds] ⚡ Cache valide trouvé pour ${username}. Renvoi de ${cachedData.guilds.length} serveurs (0ms).`);
      return res.json(cachedData.guilds);
    }

    console.log(`[Guilds] 🌐 Pas de cache actif. Envoi d'une requête réseau vers l'API de Discord...`);

    try {
      // Mesure de temps pour le log de latence
      const startTime = Date.now();

      const response = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000 // Limite de 5 secondes de patience
      });

      const latency = Date.now() - startTime;
      const guilds = response.data;
      console.log(`[Guilds] 📥 Réponse reçue de Discord en ${latency}ms (Nombre de serveurs : ${guilds.length})`);

      // Filtrage des serveurs Administrateur
      const adminGuilds = guilds.filter((guild: any) => {
        const permissions = BigInt(guild.permissions);
        const ADMIN_PERMISSION = BigInt(0x8);
        return (permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION;
      });

      console.log(`[Guilds] 🔍 Filtrage réussi pour ${username} : ${adminGuilds.length} serveurs administrables.`);

      // Mise en cache pour 2 minutes (120 000 ms)
      userGuildsCache.set(userId, {
        guilds: adminGuilds,
        expiresAt: now + 120 * 1000
      });
      console.log(`[Guilds] 💾 Données enregistrées dans le cache serveur pour ${username}.`);

      return res.json(adminGuilds);
    } catch (error: any) {
      console.error(`[Guilds] ❌ Échec de la requête vers l'API Discord :`, error?.response?.data || error.message);
      
      if (cachedData) {
        console.warn(`[Guilds] ⚠️ Renvoi de secours des données expirées du cache suite à l'échec de Discord.`);
        return res.json(cachedData.guilds);
      }

      return res.status(500).json({ error: 'Impossible de récupérer vos serveurs.' });
    }
  }
}