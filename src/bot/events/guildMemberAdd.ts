import { Events, GuildMember } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';
import { recordPlatformEvent } from '../../services/platformEvents';

const raidWindows = new Map<string, number[]>();

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
      await recordPlatformEvent('member_joined', { userId: member.id, guildId: member.guild.id, metadata: { username: member.user.username, memberCount: member.guild.memberCount } });
      const config = await GuildConfig.findOne({ guildId: member.guild.id });
      if (config?.modules?.antiRaid?.enabled) {
        const rule: any = config.modules.antiRaid;
        const now = Date.now();
        const key = member.guild.id;
        const windowMs = Math.max(1000, Number(rule.timeWindow || 10000));
        const threshold = Math.max(1, Number(rule.threshold || 10));
        const joins = (raidWindows.get(key) || []).filter(t => now - t < windowMs);
        joins.push(now);
        raidWindows.set(key, joins);
        if (joins.length >= threshold) {
          const action = String(rule.action || 'kick');
          if (action === 'ban' && member.bannable) await member.ban({ reason: 'OMNIX Anti-Raid' }).catch(() => null);
          else if (action === 'kick' && member.kickable) await member.kick('OMNIX Anti-Raid').catch(() => null);
          await recordPlatformEvent('anti_raid_triggered', { userId: member.id, guildId: member.guild.id, metadata: { threshold, joins: joins.length, action } });
        }
      }
      if (!config || !config.modules.autoRole?.enabled || !config.modules.autoRole.roleId) return;

      const role = member.guild.roles.cache.get(config.modules.autoRole.roleId);
      if (role) {
        await member.roles.add(role.id, 'OMNIX Auto-Role System');
      }
    } catch (err: any) {
      console.error('[Auto-Role Error] :', err.message);
    }
  }
};