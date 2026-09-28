import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import GuildConfig from '../../models/GuildConfig';
import { recordPlatformEvent } from '../../services/platformEvents';
import MemberProfile from '../../models/MemberProfile';

const raidWindows = new Map<string, number[]>();

// Protection contre les doubles exécutions du Welcomer.
// Une arrivée Discord ne doit produire qu'un seul message, même si le
// handler est accidentellement enregistré deux fois dans le même processus.
const welcomeDispatches = new Map<string, number>();
const WELCOME_DEDUP_MS = 30_000;
function render(template: string, member: GuildMember) {
  return String(template || '').replaceAll('{user}', `<@${member.id}>`).replaceAll('{username}', member.user.username).replaceAll('{displayname}', member.displayName).replaceAll('{userid}', member.id).replaceAll('{server}', member.guild.name).replaceAll('{serverid}', member.guild.id).replaceAll('{membercount}', String(member.guild.memberCount)).replaceAll('{mention}', `<@${member.id}>`);
}
export default { name: Events.GuildMemberAdd, async execute(member: GuildMember) {
  try {
    await recordPlatformEvent('member_joined', { userId: member.id, guildId: member.guild.id, metadata: { username: member.user.username, memberCount: member.guild.memberCount } });
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (config?.modules?.antiRaid?.enabled) {
      const rule: any = config.modules.antiRaid; const now=Date.now(); const key=member.guild.id; const windowMs=Math.max(1000,Number(rule.timeWindow||10000)); const threshold=Math.max(1,Number(rule.threshold||10)); const joins=(raidWindows.get(key)||[]).filter(t=>now-t<windowMs); joins.push(now); raidWindows.set(key,joins);
      if (joins.length>=threshold) { const action=String(rule.action||'kick'); if(action==='ban'&&member.bannable) await member.ban({reason:'OMNIX Anti-Raid'}).catch(()=>null); else if(action==='kick'&&member.kickable) await member.kick('OMNIX Anti-Raid').catch(()=>null); await recordPlatformEvent('anti_raid_triggered',{userId:member.id,guildId:member.guild.id,metadata:{threshold,joins:joins.length,action}}); }
    }
    const auto:any=config?.modules?.autoRole; if(auto?.enabled&&auto.roleId&&(!auto.humanOnly||!member.user.bot)){ const role=member.guild.roles.cache.get(auto.roleId); if(role && role.position < (member.guild.members.me?.roles.highest.position||0)) await member.roles.add(role,'OMNIX Auto-Role System').catch(()=>null); }
    const w:any=config?.modules?.welcome;
    if(w?.enabled&&w.channelId){
      const welcomeKey=`${member.guild.id}:${member.id}`;
      const previous=welcomeDispatches.get(welcomeKey)||0;
      if(Date.now()-previous < WELCOME_DEDUP_MS) return;
      welcomeDispatches.set(welcomeKey,Date.now());

      const ch=member.guild.channels.cache.get(w.channelId) as any;
      if(ch?.isTextBased?.()){
        const content=render(w.message||'Bienvenue {user} sur {server} !',member);
        const title=render(w.title||'Bienvenue sur {server} !',member);
        const embed=new EmbedBuilder()
          .setTitle(title)
          .setDescription(content)
          .setColor(0x6366f1)
          .setThumbnail(member.user.displayAvatarURL());
        await ch.send({embeds:[embed]}).catch(()=>null);
      }
    }
  } catch (err:any) { console.error('[GuildMemberAdd] ',err); }
} };