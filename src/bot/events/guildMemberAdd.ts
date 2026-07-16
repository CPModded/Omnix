import { Events, GuildMember } from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig';

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
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