/**
 * ====================================================================
 * FILTRE DE SÉCURITÉ DE SERVEUR (TRAÇAGE CONSOLE ET CACHE DE SÉCURITÉ)
 * Vérifie instantanément en mémoire locale si l'utilisateur connecté
 * est bien administrateur du serveur ciblé (0ms).
 * ====================================================================
 */

import { Response, NextFunction } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from './auth';

// Cache de sécurité en mémoire (userId => { guildIds, expiresAt })
export const adminAccessCache = new Map<string, { guilds: string[]; expiresAt: number }>();

export async function canManageGuild(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { guildId } = req.params;
  const user = req.user;

  console.log(`[Guild Auth] 🛡️ Validation des accès pour : ${user?.username} sur le serveur : ${guildId}`);

  if (!user) {
    console.warn(`[Guild Auth] ❌ Échec : Utilisateur non authentifié.`);
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }

  const now = Date.now();
  const cachedData = adminAccessCache.get(user.discordId);

  // 1. UTILISATION DU CACHE : Si l'utilisateur vient de la liste des serveurs, on valide en 0ms !
  if (cachedData && cachedData.expiresAt > now) {
    if (cachedData.guilds.includes(guildId)) {
      console.log(`[Guild Auth] ⚡ Autorisation accordée via le Cache (0ms) pour ${user.username}`);
      return next();
    }
    console.warn(`[Guild Auth] ❌ Accès refusé via le Cache pour ${user.username} (permissions manquantes)`);
    return res.status(403).json({ error: 'Permissions administratives manquantes pour ce serveur.' });
  }

  console.log(`[Guild Auth] 🌐 Pas de cache valide. Envoi de la requête réseau vers Discord...`);

  try {
    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${user.discordAccessToken}` },
      timeout: 5000 // Limite de 5 secondes de patience
    });

    const guilds = response.data;
    const adminGuildIds: string[] = guilds
      .filter((guild: any) => {
        const permissions = BigInt(guild.permissions);
        const ADMIN_PERMISSION = BigInt(0x8); // Bitmask ADMINISTRATOR
        return (permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION;
      })
      .map((guild: any) => guild.id);

    // Enregistrement des droits d'administration dans le cache pour 5 minutes
    adminAccessCache.set(user.discordId, {
      guilds: adminGuildIds,
      expiresAt: now + 5 * 60 * 1000,
    });
    console.log(`[Guild Auth] 💾 Droits d'administration mis en cache pour 5 minutes.`);

    if (adminGuildIds.includes(guildId)) {
      console.log(`[Guild Auth] ✅ Autorisation accordée après vérification réseau pour ${user.username}`);
      return next();
    }

    console.warn(`[Guild Auth] ❌ Accès refusé après vérification réseau pour ${user.username}`);
    return res.status(403).json({ error: 'Permissions administratives manquantes pour ce serveur.' });
  } catch (error: any) {
    console.error(`[Guild Auth] ❌ Échec de la requête de vérification Discord :`, error?.response?.data || error.message);
    
    // SÉCURITÉ DE SECOURS : Si l'API de Discord est inaccessible, on utilise le cache expiré s'il existe
    if (cachedData) {
      console.warn(`[Guild Auth] ⚠️ API Discord inaccessible. Utilisation du cache expiré de secours.`);
      if (cachedData.guilds.includes(guildId)) {
        return next();
      }
    }

    return res.status(500).json({ error: 'Échec de la validation de vos permissions administratives.' });
  }
}