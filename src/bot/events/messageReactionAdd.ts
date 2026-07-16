import { Events, MessageReaction, User } from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig';

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction: MessageReaction, user: User) {
    if (user.bot) return;

    // Récupération complète du message si mis en cache partielle
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        return;
      }
    }

    try {
      const config = await GuildConfig.findOne({ guildId: reaction.message.guildId });
      if (!config || !config.modules.reactionRoles?.enabled) return;

      const rule = config.modules.reactionRoles.list.find(
        r => r.messageId === reaction.message.id && r.emoji === reaction.emoji.name
      );

      if (rule) {
        const member = await reaction.message.guild?.members.fetch(user.id);
        if (member) {
          await member.roles.add(rule.roleId, 'OMNIX Reaction-Role System');
        }
      }
    } catch (err: any) {
      console.error('[Reaction Role Add Error] :', err.message);
    }
  }
};