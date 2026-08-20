import os from 'node:os';
import {
  client as botClient,
} from '../bot/client.ts';
import User from '../models/User.ts';
import GuildConfig from '../models/GuildConfig.ts';
/* =========================================================
   TYPES
========================================================= */
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
    usersCached: number;
    uptime: number;
    ready: boolean;
  };
  database: {
    totalUsers: number;
    premiumGuilds: number;
    connected: boolean;
  };
}
/* =========================================================
   SYSTEM MONITOR
========================================================= */
export class SystemMonitor {
  static async getStats(): Promise<SystemStats> {
    const totalMem =
      os.totalmem();
    const freeMem =
      os.freemem();
    const memUsagePercent =
      Number(
        (
          ((totalMem - freeMem) /
            totalMem) *
          100
        ).toFixed(2)
      );
    let totalUsers = 0;
    let premiumGuilds = 0;
    let databaseConnected = true;
    /* =====================================================
       DATABASE
    ===================================================== */
    try {
      totalUsers =
        await User.countDocuments();
      premiumGuilds =
        await GuildConfig.countDocuments({
          'premium.isPremium': true,
        });
    } catch (error) {
      databaseConnected = false;
      console.error(
        '[SystemMonitor] Erreur MongoDB :',
        error
      );
    }
    /* =====================================================
       DISCORD
    ===================================================== */
    const ready =
      botClient.isReady();
    const ping =
      ready
        ? botClient.ws.ping
        : -1;
    /* =====================================================
       RETURN
    ===================================================== */
    return {
      system: {
        cpuLoad:
          os.loadavg(),
        totalMem:
          Math.round(
            totalMem /
              1024 /
              1024
          ),
        freeMem:
          Math.round(
            freeMem /
              1024 /
              1024
          ),
        memUsagePercent,
        uptime:
          os.uptime(),
      },
      bot: {
        ping,
        guildsCount:
          botClient.guilds.cache.size,
        usersCached:
          botClient.users.cache.size,
        uptime:
          process.uptime(),
        ready,
      },
      database: {
        totalUsers,
        premiumGuilds,
        connected:
          databaseConnected,
      },
    };
  }
}
export default SystemMonitor;