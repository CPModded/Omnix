import os from 'os';

import { client as botClient } from '../bot/client';
import User from '../models/User';
import GuildConfig from '../models/GuildConfig';

export interface SystemStats {
  system: {
    cpuLoad: number[];
    totalMem: number;
    freeMem: number;
    memUsagePercent: number;
    uptime: number;
  };

  bot: {
    ping: number;
    guildsCount: number;
    membersCount: number;
    usersCached: number;
    uptime: number;
  };

  database: {
    totalUsers: number;
    premiumGuilds: number;
    totalGuildConfigs: number;
  };
}

export class SystemMonitor {

  static async getStats(): Promise<SystemStats> {

    // =========================================================
    // SYSTEME
    // =========================================================

    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const memUsagePercent =
      Number(
        (
          ((totalMem - freeMem) / totalMem) *
          100
        ).toFixed(2)
      );

    // =========================================================
    // DISCORD
    // =========================================================

    const guilds = botClient.guilds.cache;

    const guildsCount = guilds.size;

    let membersCount = 0;

    for (const guild of guilds.values()) {
      membersCount += guild.memberCount || 0;
    }

    const usersCached =
      botClient.users.cache.size;

    const ping =
      botClient.ws.ping >= 0
        ? botClient.ws.ping
        : 0;

    // =========================================================
    // MONGODB
    // =========================================================

    let totalUsers = 0;
    let premiumGuilds = 0;
    let totalGuildConfigs = 0;

    try {

      totalUsers =
        await User.countDocuments();

      totalGuildConfigs =
        await GuildConfig.countDocuments();

      premiumGuilds =
        await GuildConfig.countDocuments({
          'premium.isPremium': true,
        });

    } catch (error) {

      console.error(
        '[SystemMonitor] Erreur MongoDB :',
        error
      );

    }

    // =========================================================
    // RESULTAT
    // =========================================================

    return {

      system: {
        cpuLoad: os.loadavg(),

        totalMem:
          Math.round(
            totalMem / 1024 / 1024
          ),

        freeMem:
          Math.round(
            freeMem / 1024 / 1024
          ),

        memUsagePercent,

        uptime:
          os.uptime(),
      },

      bot: {

        ping,

        guildsCount,

        membersCount,

        usersCached,

        uptime:
          process.uptime(),
      },

      database: {

        totalUsers,

        premiumGuilds,

        totalGuildConfigs,
      },
    };
  }
}

export default SystemMonitor;