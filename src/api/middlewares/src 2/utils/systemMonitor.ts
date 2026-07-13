import os from 'os';
import { client as botClient } from '../bot/client';
import { User } from '../models/User';
import { GuildConfig } from '../models/GuildConfig';

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
  };
  database: {
    totalUsers: number;
    premiumGuilds: number;
  };
}

export class SystemMonitor {
  static async getStats(): Promise<SystemStats> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsagePercent = parseFloat((((totalMem - freeMem) / totalMem) * 100).toFixed(2));

    const totalUsersInDb = await User.countDocuments();
    const premiumGuildsCount = await GuildConfig.countDocuments({ 'premium.isPremium': true });

    return {
      system: {
        cpuLoad: os.loadavg(), // Charge système 1, 5 et 15 min
        totalMem: Math.round(totalMem / 1024 / 1024), // En Mo
        freeMem: Math.round(freeMem / 1024 / 1024), // En Mo
        memUsagePercent,
        uptime: os.uptime()
      },
      bot: {
        ping: botClient.ws.ping,
        guildsCount: botClient.guilds.cache.size,
        usersCached: botClient.users.cache.size,
        uptime: process.uptime()
      },
      database: {
        totalUsers: totalUsersInDb,
        premiumGuilds: premiumGuildsCount
      }
    };
  }
}