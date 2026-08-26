import { Events, type GuildMember } from 'discord.js';
import { recordPlatformEvent } from '../../services/platformEvents';

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    try {
      await recordPlatformEvent('member_left', {
        userId: member.id,
        guildId: member.guild.id,
        metadata: { username: member.user?.username || 'Utilisateur', memberCount: member.guild.memberCount }
      });
    } catch (error) {
      console.error('[Discord] member_left event error:', error);
    }
  }
};
