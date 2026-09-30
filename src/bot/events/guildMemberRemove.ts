import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';
import { recordPlatformEvent } from '../../services/platformEvents';

function render(template: string, member: GuildMember) {
  return String(template || '')
    .replaceAll('{user}', member.user.username)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayname}', member.displayName)
    .replaceAll('{userid}', member.id)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{serverid}', member.guild.id)
    .replaceAll('{membercount}', String(member.guild.memberCount || 0))
    .replaceAll('{mention}', `<@${member.id}>`);
}

function safeColor(value: unknown): number {
  const raw = String(value || '#7c5cff').trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(raw) ? Number.parseInt(raw, 16) : 0x7c5cff;
}

export default {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember) {
    try {
      await recordPlatformEvent('member_left', { userId: member.id, guildId: member.guild.id, metadata: { username: member.user.username } });
      const config: any = await GuildConfig.findOne({ guildId: member.guild.id });
      const goodbye: any = config?.modules?.goodbye;
      if (!goodbye?.enabled || !goodbye.channelId) return;
      const channel: any = member.guild.channels.cache.get(goodbye.channelId);
      if (!channel?.isTextBased?.()) return;
      const content = render(goodbye.message || '{user} a quitté le serveur.', member);
      const mention = goodbye.mentionUser !== false ? `<@${member.id}>` : '';
      if (goodbye.embed !== false) {
        const embed = new EmbedBuilder()
          .setTitle(render(goodbye.title || 'À bientôt !', member))
          .setDescription(content)
          .setColor(safeColor(goodbye.color));
        if (goodbye.thumbnail !== false) embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
        if (goodbye.imageUrl) embed.setImage(render(goodbye.imageUrl, member));
        if (goodbye.footer) embed.setFooter({ text: render(goodbye.footer, member) });
        await channel.send({ content: mention || undefined, embeds: [embed] }).catch(() => null);
      } else {
        await channel.send({ content: mention ? `${mention}\n${content}` : content }).catch(() => null);
      }
    } catch (e) {
      console.error('[GuildMemberRemove]', e);
    }
  },
};
