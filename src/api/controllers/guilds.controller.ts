/**
 * ====================================================================
 * CONTRÔLEUR DES SERVEURS DISCORD (SALONS, RÔLES & CACHE PARTAGÉ)
 * ====================================================================
 */

import { Response } from 'express';
import axios from 'axios';
import { ChannelType } from 'discord.js';
import { AuthenticatedRequest } from '../middlewares/auth';
import { adminAccessCache } from '../middlewares/guildAuth';
import { client as botClient } from '../../bot/client';

const userGuildsCache = new Map<string, { guilds: any[]; expiresAt: number }>();

export class GuildsController {
  // 1. Récupère la liste des serveurs administrés
  static async getUserGuilds(req: AuthenticatedRequest, res: Response) {
    const accessToken = req.user?.discordAccessToken;
    const userId = req.user?.discordId;
    const username = req.user?.username;

    console.log(`[Guilds] 📥 Récupération des serveurs Discord pour : ${username}`);

    if (!accessToken || !userId) {
      return res.status(401).json({ error: 'Jeton d\'accès Discord requis.' });
    }

    const now = Date.now();
    const cachedData = userGuildsCache.get(userId);

    if (cachedData && cachedData.expiresAt > now) {
      return res.json(cachedData.guilds);
    }

    try {
      const response = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000 
      });

      const guilds = response.data;

      const adminGuilds = guilds.filter((guild: any) => {
        const permissions = BigInt(guild.permissions);
        const ADMIN_PERMISSION = BigInt(0x8);
        return (permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION;
      });

      const adminGuildIds = adminGuilds.map((g: any) => g.id);
      adminAccessCache.set(userId, {
        guilds: adminGuildIds,
        expiresAt: now + 5 * 60 * 1000
      });

      userGuildsCache.set(userId, {
        guilds: adminGuilds,
        expiresAt: now + 120 * 1000
      });

      return res.json(adminGuilds);
    } catch (error: any) {
      if (cachedData) return res.json(cachedData.guilds);
      return res.status(500).json({ error: 'Impossible de récupérer vos serveurs.' });
    }
  }

  // 2. NOUVEAU : Récupère la liste des salons textuels et des catégories d'un serveur
  static async getGuildChannels(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;

    try {
      const guild = await botClient.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return res.status(404).json({ error: 'Bot non présent sur ce serveur.' });
      }

      const channels = await guild.channels.fetch();
      
      // On filtre pour ne garder que les salons textuels classiques et les catégories
      const formattedChannels = channels
        .filter(ch => ch !== null && (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildCategory))
        .map(ch => ({
          id: ch!.id,
          name: ch!.name,
          type: ch!.type === ChannelType.GuildCategory ? 'category' : 'text'
        }));

      return res.json(formattedChannels);
    } catch (error) {
      return res.status(500).json({ error: 'Échec de la récupération des salons.' });
    }
  }

  // 3. NOUVEAU : Récupère la liste des rôles personnalisables d'un serveur
  static async getGuildRoles(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;

    try {
      const guild = await botClient.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return res.status(404).json({ error: 'Bot non présent.' });
      }

      const roles = await guild.roles.fetch();

      // On filtre pour exclure le rôle universel @everyone et les rôles gérés par d'autres bots
      const formattedRoles = roles
        .filter(r => r.name !== '@everyone' && !r.managed)
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.hexColor
        }));

      return res.json(formattedRoles);
    } catch (error) {
      return res.status(500).json({ error: 'Échec de la récupération des rôles.' });
    }
  }
}