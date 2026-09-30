import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';
import { recordPlatformEvent } from '../../services/platformEvents';
import MemberProfile from '../../models/MemberProfile';
import WelcomeDispatch from '../../models/WelcomeDispatch';

const raidWindows = new Map<string, number[]>();
const localWelcomeDispatches = new Set<string>();

function render(template: string, member: GuildMember) {
  return String(template || '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayname}', member.displayName)
    .replaceAll('{userid}', member.id)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{serverid}', member.guild.id)
    .replaceAll('{membercount}', String(member.guild.memberCount))
    .replaceAll('{mention}', `<@${member.id}>`);
}

function safeColor(value: unknown): number {
  const raw = String(value || '#7c5cff').trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(raw) ? Number.parseInt(raw, 16) : 0x7c5cff;
}

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
      await recordPlatformEvent('member_joined', {
        userId: member.id,
        guildId: member.guild.id,
        metadata: { username: member.user.username, memberCount: member.guild.memberCount },
      });

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

      const auto: any = config?.modules?.autoRole;
      if (auto?.enabled && auto.roleId && (!auto.humanOnly || !member.user.bot)) {
        const role = member.guild.roles.cache.get(auto.roleId);
        if (role && role.position < (member.guild.members.me?.roles.highest.position || 0)) {
          await member.roles.add(role, 'OMNIX Auto-Role System').catch(() => null);
        }
      }

      const welcome: any = config?.modules?.welcome;
      if (welcome?.enabled && welcome.channelId) {
        // Verrou distribué MongoDB : deux instances OMNIX ne peuvent pas
        // envoyer le même Welcomer pour la même arrivée.
        const welcomeKey = `${member.guild.id}:${member.id}`;
        if (localWelcomeDispatches.has(welcomeKey)) {
          console.warn(`[Welcomer] Doublon local ignoré : ${welcomeKey}`);
          return;
        }
        localWelcomeDispatches.add(welcomeKey);
        const localExpiry = setTimeout(() => localWelcomeDispatches.delete(welcomeKey), 10 * 60 * 1000);
        localExpiry.unref?.();

        let alreadyDispatched = false;
        try {
          await WelcomeDispatch.create({
            guildId: member.guild.id,
            memberId: member.id,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          });
        } catch (dispatchError: any) {
          if (dispatchError?.code === 11000) alreadyDispatched = true;
          else {
            // Mongo indisponible : la barrière locale reste active.
            console.warn('[Welcomer] Protection distribuée indisponible, verrou local actif.');
          }
        }
        if (alreadyDispatched) {
          console.warn(`[Welcomer] Doublon distribué ignoré : ${welcomeKey}`);
          return;
        }

        const channel: any = member.guild.channels.cache.get(welcome.channelId);
        if (channel?.isTextBased?.()) {
          const content = render(welcome.message || 'Bienvenue {user} !', member);
          const shouldEmbed = welcome.embed !== false;
          const mention = welcome.mentionUser !== false ? `<@${member.id}>` : '';

          if (shouldEmbed) {
            const embed = new EmbedBuilder()
              .setColor(safeColor(welcome.color))
              .setTitle(render(welcome.title || 'Bienvenue sur {server} !', member))
              .setDescription(content)
              .setThumbnail(member.user.displayAvatarURL({ size: 128 }));

            if (welcome.thumbnail === false) { /* avatar volontairement masqué */ }
            if (welcome.imageUrl) embed.setImage(render(welcome.imageUrl, member));
            if (welcome.footer) embed.setFooter({ text: render(welcome.footer, member) });

            await channel.send({
              content: mention || undefined,
              embeds: [embed],
            }).catch(() => null);
          } else {
            await channel.send({ content: mention ? `${mention}\n${content}` : content }).catch(() => null);
          }
        }
      }
    } catch (err: any) {
      console.error('[GuildMemberAdd]', err);
    }
  },
};
