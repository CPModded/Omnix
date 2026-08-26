import { Events, GuildMember } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';
import { recordPlatformEvent } from '../../services/platformEvents';

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
      await recordPlatformEvent('member_joined', { userId: member.id, guildId: member.guild.id, metadata: { username: member.user.username, memberCount: member.guild.memberCount } });
      const config = await GuildConfig.findOne({ guildId: member.guild.id });
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