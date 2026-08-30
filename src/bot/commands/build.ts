import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  Guild,
  GuildChannel,
  type OverwriteResolvable,
} from 'discord.js';
import type { Command } from '../types';
import { CONFIG } from '../../config/index';
import BuildSnapshot from '../../models/BuildSnapshot';
import { getGuildConfig, updateGuildConfig } from '../utils/guildConfig';

const OMNIX_RULES = `Bienvenue dans la communauté OMNIX.

1. Respectez chaque membre et chaque équipe, quel que soit son rôle ou son expérience.
2. Aucun harcèlement, discrimination, menace, provocation répétée ou comportement volontairement toxique.
3. Utilisez chaque salon pour son objectif. Le spam, le flood et les mentions abusives sont interdits.
4. Aucun contenu illégal, NSFW, violent ou destiné à nuire à une personne, un serveur ou un service.
5. La publicité, l'auto-promotion et les partenariats doivent rester dans les espaces prévus.
6. Les tickets sont réservés au support et doivent contenir une demande claire et utile.
7. Ne partagez jamais de mot de passe, token, donnée personnelle ou information privée.
8. Respectez les décisions de l'équipe. Une contestation doit passer par les moyens de contact prévus.
9. Les arnaques, faux liens, phishing, usurpations et tentatives de contournement de sécurité sont interdits.
10. L'équipe OMNIX peut prendre toute mesure nécessaire pour protéger la communauté.

En restant sur le serveur, vous acceptez ce règlement et les conditions applicables à la communauté OMNIX.`;

const STAFF_ROLE = /founder|fondateur|owner|proprietaire|co[- ]?founder|direction|directeur|super.?admin|administrateur|administrator|head.?admin|lead.?dev|developer|développeur/i;
const MOD_ROLE = /moderator|modérateur|moderateur|mod|support|staff|community.?manager|helper|assistant/i;
const PREMIUM_ROLE = /premium|vip/i;
const PARTNER_ROLE = /partner|partenaire/i;

const RULE_NAME = /(^|[-_·・\s])(rules|regles|règ?les|reglement|règlement)([-_·・\s]|$)/iu;
const TICKET_NAME = /ticket|support|help|assistance|create[-_ ]?ticket|ouvrir[-_ ]?ticket/i;
const LOG_NAME = /(^|[-_·・\s])(logs?|journalisation)([-_·・\s]|$)/i;
const PREMIUM_NAME = /premium|vip/i;
const DEV_NAME = /dev|développement|developpement|api|plugin|beta|testing/i;
const PARTNER_NAME = /partner|partenaire|advertising|publicit/i;
const STAFF_NAME = /staff|modération|moderation|administration|haut.?grad|direction/i;
const TRANSCRIPT_NAME = /transcript|honeypot/i;

const CATEGORY_DEFINITIONS = [
  { key: 'info', names: ['📣 INFORMATIONS'], test: (n: string) => RULE_NAME.test(n) || /announcements?|annonces?|faq|welcome|bienvenue|status|statut|roles?|rôles?|links?|liens?/i.test(n) },
  { key: 'community', names: ['💬 COMMUNAUTÉ'], test: (n: string) => /general|général|discussion|showcase|suggestions?|bug[-_ ]?report|media|m[eè]mes|off[-_ ]?topic/i.test(n) },
  { key: 'support', names: ['🆘 SUPPORT'], test: (n: string) => TICKET_NAME.test(n) && !/premium/i.test(n) },
  { key: 'premium', names: ['💎 PREMIUM'], test: (n: string) => PREMIUM_NAME.test(n) },
  { key: 'development', names: ['🤖 DÉVELOPPEMENT'], test: (n: string) => DEV_NAME.test(n) },
  { key: 'partners', names: ['💼 PARTENAIRES'], test: (n: string) => PARTNER_NAME.test(n) },
  { key: 'logs', names: ['📜 JOURNALISATION (LOGS)'], test: (n: string) => LOG_NAME.test(n) },
  { key: 'voice', names: ['🔊 SALONS VOCAUX'], test: (_n: string) => false },
  { key: 'transcripts', names: ['🧾 TRANSCRIPTS'], test: (n: string) => TRANSCRIPT_NAME.test(n) },
  { key: 'tickets-private', names: ['🎫 TICKETS'], test: (n: string) => /tickets?/i.test(n) && !/support|create/i.test(n) },
  { key: 'staff-moderation', names: ['🛡️ STAFF — MODÉRATION'], test: (n: string) => STAFF_NAME.test(n) && /mod|moder|support/i.test(n) },
  { key: 'staff-high', names: ['👑 STAFF — HAUT GRADÉ'], test: (n: string) => STAFF_NAME.test(n) && /haut|direction|admin|founder|fondateur|owner/i.test(n) },
];

function normalizeName(name: string): string {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').trim();
}
function isRulesChannel(name: string) { return RULE_NAME.test(normalizeName(name)); }
function isTicketChannel(name: string) { return TICKET_NAME.test(normalizeName(name)); }
function isLogChannel(name: string) { return LOG_NAME.test(normalizeName(name)); }
function isStaffRole(name: string) { return STAFF_ROLE.test(name) || MOD_ROLE.test(name); }

function findRole(guild: Guild, matcher: RegExp) {
  return guild.roles.cache.find(r => !r.managed && matcher.test(r.name));
}

function roleIds(guild: Guild) {
  return {
    high: guild.roles.cache.filter(r => !r.managed && r.id !== guild.id && STAFF_ROLE.test(r.name)).map(r => r.id),
    moderation: guild.roles.cache.filter(r => !r.managed && r.id !== guild.id && MOD_ROLE.test(r.name) && !STAFF_ROLE.test(r.name)).map(r => r.id),
    premium: guild.roles.cache.filter(r => !r.managed && r.id !== guild.id && PREMIUM_ROLE.test(r.name)).map(r => r.id),
    partner: guild.roles.cache.filter(r => !r.managed && r.id !== guild.id && PARTNER_ROLE.test(r.name)).map(r => r.id),
  };
}

function overwritesFor(guild: Guild, visibility: 'public' | 'premium' | 'moderation' | 'high' | 'support' | 'partner' | 'logs') {
  const ids = roleIds(guild);
  const out: OverwriteResolvable[] = [];
  const everyone = guild.roles.everyone;

  if (visibility === 'public') {
    out.push({ id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [] });
  } else {
    out.push({ id: everyone.id, allow: [], deny: [PermissionFlagsBits.ViewChannel] });
  }

  const allow = (id: string, permissions: bigint[]) => out.push({ id, allow: permissions, deny: [] });
  const viewSend = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
  const viewOnly = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];

  if (visibility === 'premium') ids.premium.forEach(id => allow(id, viewSend));
  if (visibility === 'partner') ids.partner.forEach(id => allow(id, viewSend));
  if (visibility === 'moderation' || visibility === 'support') {
    [...ids.moderation, ...ids.high].forEach(id => allow(id, viewSend));
  }
  if (visibility === 'high') ids.high.forEach(id => allow(id, viewSend));
  if (visibility === 'logs') {
    [...ids.moderation, ...ids.high].forEach(id => allow(id, viewOnly));
    const botRole = guild.members.me?.roles.highest;
    if (botRole && botRole.id !== everyone.id) allow(botRole.id, viewSend);
  }

  return out;
}

function classifyChannel(name: string, type: ChannelType) {
  const n = normalizeName(name);
  if (type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice) return 'voice';
  if (isLogChannel(n)) return 'logs';
  if (TRANSCRIPT_NAME.test(n)) return 'transcripts';
  if (isRulesChannel(n)) return 'info';
  if (isTicketChannel(n)) return /premium[-_ ]?support/i.test(n) ? 'premium' : 'support';
  if (PREMIUM_NAME.test(n)) return 'premium';
  if (DEV_NAME.test(n)) return 'development';
  if (PARTNER_NAME.test(n)) return 'partners';
  if (/staff|moderation|modération|administration|haut.?grade|direction/i.test(n)) {
    return /haut|direction|admin|founder|fondateur|owner/i.test(n) ? 'staff-high' : 'staff-moderation';
  }
  if (/honeypot|transcript/i.test(n)) return 'logs';
  return 'community';
}

function categoryPermission(key: string): 'public' | 'premium' | 'moderation' | 'high' | 'support' | 'partner' | 'logs' {
  if (key === 'premium') return 'premium';
  if (key === 'staff-high') return 'high';
  if (key === 'staff-moderation') return 'moderation';
  if (key === 'logs') return 'logs';
  if (key === 'transcripts') return 'logs';
  if (key === 'tickets-private') return 'support';
  if (key === 'support') return 'support';
  if (key === 'partners') return 'partner';
  return 'public';
}

async function fetchAll(guild: Guild) {
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();
  return {
    channels: [...channels.values()].filter(Boolean) as GuildChannel[],
    roles: [...roles.values()].filter(Boolean),
  };
}

function dedupeSnapshotChannels(channels: any[]) {
  const seen = new Set<string>();
  return channels.filter(channel => {
    const key = `${channel.type}:${normalizeName(channel.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function analyzeGuild(guild: Guild, includeStaff: boolean) {
  const { channels, roles } = await fetchAll(guild);
  const includedChannels = channels.filter(c => includeStaff || !isStaffChannel(c));
  const includedRoles = roles.filter(r => !r.managed && r.id !== guild.id && (includeStaff || !isStaffRole(r.name)));

  return {
    roles: includedRoles.map(role => ({ sourceId: role.id, name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, position: role.position, managed: role.managed })),
    channels: dedupeSnapshotChannels(includedChannels.map(channel => ({
      sourceId: channel.id,
      name: channel.name,
      type: channel.type,
      parentSourceId: channel.parentId,
      position: channel.rawPosition,
      topic: 'topic' in channel ? (channel as any).topic ?? null : null,
      nsfw: 'nsfw' in channel ? Boolean((channel as any).nsfw) : false,
      rateLimitPerUser: 'rateLimitPerUser' in channel ? Number((channel as any).rateLimitPerUser || 0) : 0,
      bitrate: 'bitrate' in channel ? Number((channel as any).bitrate || 0) : undefined,
      userLimit: 'userLimit' in channel ? Number((channel as any).userLimit || 0) : undefined,
      permissionOverwrites: channel.permissionOverwrites.cache.map(o => ({ id: o.id, name: guild.roles.cache.get(o.id)?.name ?? null, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })),
    }))),
  };
}

async function ensureCategory(guild: Guild, name: string, visibility: Parameters<typeof overwritesFor>[1]) {
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && normalizeName(c.name) === normalizeName(name));
  if (!category) {
    category = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: 'OMNIX Build — structure et permissions' });
  }
  await category.permissionOverwrites.set(overwritesFor(guild, visibility), 'OMNIX Build — permissions de catégorie').catch(() => {});
  return category;
}

async function ensureChannel(guild: Guild, data: any, parent: GuildChannel | null, visibility: Parameters<typeof overwritesFor>[1], forcedName?: string) {
  const name = forcedName || data.name;
  let channel = guild.channels.cache.find(c => c.type === data.type && normalizeName(c.name) === normalizeName(name));
  if (!channel) {
    const options: any = { name, type: data.type, reason: 'OMNIX Build — organisation automatique' };
    if (parent) options.parent = parent.id;
    if (data.topic && [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(data.type)) options.topic = data.topic;
    if (data.nsfw != null && [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(data.type)) options.nsfw = data.nsfw;
    if (data.rateLimitPerUser != null && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(data.type)) options.rateLimitPerUser = data.rateLimitPerUser;
    if ((data.type === ChannelType.GuildVoice || data.type === ChannelType.GuildStageVoice) && data.bitrate) options.bitrate = data.bitrate;
    if ((data.type === ChannelType.GuildVoice || data.type === ChannelType.GuildStageVoice) && data.userLimit) options.userLimit = data.userLimit;
    channel = await guild.channels.create(options) as GuildChannel;
  } else if (parent && channel.parentId !== parent.id) {
    await channel.setParent(parent.id, { lockPermissions: false, reason: 'OMNIX Build — repositionnement intelligent' }).catch(() => {});
  }
  await channel.permissionOverwrites.set(overwritesFor(guild, visibility), 'OMNIX Build — permissions du salon').catch(() => {});
  return channel;
}

async function removeDuplicateChannels(guild: Guild) {
  const groups = new Map<string, GuildChannel[]>();
  for (const channel of guild.channels.cache.values()) {
    const key = `${channel.type}:${normalizeName(channel.name)}`;
    const list = groups.get(key) || [];
    list.push(channel);
    groups.set(key, list);
  }
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.rawPosition - b.rawPosition);
    for (const duplicate of list.slice(1)) {
      if (duplicate.id === guild.rulesChannelId) continue;
      await duplicate.delete('OMNIX Build — suppression d’un doublon').then(() => removed++).catch(() => {});
    }
  }
  return removed;
}

async function syncGuildConfig(guild: Guild, created: Map<string, GuildChannel>) {
  const config = await getGuildConfig(guild.id);
  const getId = (key: string) => created.get(key)?.id || null;
  const supportRole = findRole(guild, MOD_ROLE);
  const logs = {
    joins: getId('logs-joins'), leaves: getId('logs-leaves'), moderation: getId('logs-moderation'), tickets: getId('logs-tickets'),
    premium: getId('logs-premium'), payments: getId('logs-payments'), security: getId('logs-security'), errors: getId('logs-errors'),
    bot: getId('logs-bot'), voice: getId('logs-voice'), roles: getId('logs-role'),
  };
  await updateGuildConfig(guild.id, {
    name: guild.name,
    ownerId: guild.ownerId,
    modules: {
      tickets: { enabled: Boolean(getId('create-ticket') || getId('ticket-support')), categoryId: created.get('ticket-category')?.id || null, supportRoleId: supportRole?.id || null, transcriptChannelId: getId('transcripts'), logChannelId: logs.tickets, maxOpenPerUser: config.modules.tickets?.maxOpenPerUser || 1 },
      moderation: { enabled: true, logChannelId: logs.moderation },
      logs: { enabled: true, channelIds: logs },
    },
  });
}

async function pasteSnapshot(guild: Guild, snapshot: any, includeStaff: boolean) {
  const roleNames = new Set<string>();
  for (const role of snapshot.roles || []) {
    if (!includeStaff && isStaffRole(role.name)) continue;
    if (roleNames.has(normalizeName(role.name))) continue;
    roleNames.add(normalizeName(role.name));
    const existing = guild.roles.cache.find(r => !r.managed && r.id !== guild.id && normalizeName(r.name) === normalizeName(role.name));
    if (!existing) await guild.roles.create({ name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, reason: 'OMNIX Build — rôle manquant dans la structure copiée' }).catch(() => {});
  }

  const categoryMap = new Map<string, GuildChannel>();
  const created = new Map<string, GuildChannel>();
  const definitions = CATEGORY_DEFINITIONS.filter(d => includeStaff || !d.key.startsWith('staff-'));
  for (const def of definitions) {
    const category = await ensureCategory(guild, def.names[0], categoryPermission(def.key));
    categoryMap.set(def.key, category);
  }
  for (const [position, def] of definitions.entries()) {
    const category = categoryMap.get(def.key);
    if (category) await category.setPosition(position).catch(() => {});
  }

  const dataChannels = dedupeSnapshotChannels((snapshot.channels || []).filter((c: any) => c.type !== ChannelType.GuildCategory));
  for (const data of dataChannels.sort((a: any, b: any) => a.position - b.position)) {
    const key = classifyChannel(data.name, data.type);
    if (!includeStaff && key.startsWith('staff-')) continue;
    const parent = categoryMap.get(key) || categoryMap.get('community') || null;
    const visibility = categoryPermission(key);
    const forced = key === 'info' && isRulesChannel(data.name) ? '📜・regles' : undefined;
    const channel = await ensureChannel(guild, data, parent, visibility, forced);
    created.set(data.name, channel);
    if (isRulesChannel(data.name) && channel.isTextBased() && 'send' in channel) {
      const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
      if (!recent?.some((m: any) => m.author?.id === guild.client.user?.id && m.content?.includes('Bienvenue dans la communauté OMNIX'))) {
        await (channel as any).send({ embeds: [new EmbedBuilder().setTitle('Règlement de la communauté OMNIX').setDescription(OMNIX_RULES).setColor(0x5865f2)] }).catch(() => {});
      }
    }
  }

  // Structure minimale OMNIX attendue d’après la configuration officielle.
  const required: Array<[string, string, ChannelType]> = [
    ['info', '📢・announcements', ChannelType.GuildAnnouncement], ['info', '📚・faq', ChannelType.GuildText], ['info', '👋・welcome', ChannelType.GuildText], ['info', '📊・status', ChannelType.GuildText], ['info', '🎭・roles', ChannelType.GuildText], ['info', '🔗・links', ChannelType.GuildText], ['info', '📜・regles', ChannelType.GuildText],
    ['community', '💬・general', ChannelType.GuildText], ['community', '🤖・bot-discussion', ChannelType.GuildText], ['community', '✨・showcase', ChannelType.GuildText], ['community', '💡・suggestions', ChannelType.GuildText], ['community', '🐛・bug-report', ChannelType.GuildText], ['community', '📸・media', ChannelType.GuildText], ['community', '😂・memes', ChannelType.GuildText], ['community', '☕・off-topic', ChannelType.GuildText],
    ['support', '🎫・create-ticket', ChannelType.GuildText], ['support', '💬・support-chat', ChannelType.GuildText], ['support', '💎・premium-support', ChannelType.GuildText],
    ['premium', '✨・premium-news', ChannelType.GuildText], ['premium', '💬・premium-chat', ChannelType.GuildText], ['premium', '🧪・beta-testing', ChannelType.GuildText],
    ['development', '💻・dev-news', ChannelType.GuildText], ['development', '🔌・api', ChannelType.GuildText], ['development', '🧱・plugins', ChannelType.GuildText], ['development', '🧠・ideas', ChannelType.GuildText],
    ['partners', '🤝・partners', ChannelType.GuildText], ['partners', '📢・advertising', ChannelType.GuildText],
    ['transcripts', '🍯・honeypot', ChannelType.GuildText], ['transcripts', '🧾・transcripts', ChannelType.GuildText],
    ['logs', '📥・logs-joins', ChannelType.GuildText], ['logs', '📤・logs-leaves', ChannelType.GuildText], ['logs', '🛡️・logs-moderation', ChannelType.GuildText], ['logs', '🎫・logs-tickets', ChannelType.GuildText], ['logs', '💎・logs-premium', ChannelType.GuildText], ['logs', '💳・logs-payments', ChannelType.GuildText], ['logs', '🔒・logs-security', ChannelType.GuildText], ['logs', '⚠️・logs-errors', ChannelType.GuildText], ['logs', '🤖・logs-bot', ChannelType.GuildText], ['logs', '📡・logs-voice', ChannelType.GuildText], ['logs', '🎭・logs-role', ChannelType.GuildText], ['logs', '📜・logs-staff', ChannelType.GuildText], ['logs', '👑・logs-admin', ChannelType.GuildText],
    ['voice', '📡・General 1', ChannelType.GuildVoice], ['voice', '📡・General 2', ChannelType.GuildVoice], ['voice', '🎮・Gaming', ChannelType.GuildVoice], ['voice', '🎧・Support', ChannelType.GuildVoice], ['voice', '💎・Premium', ChannelType.GuildVoice], ['voice', '💤・AFK', ChannelType.GuildVoice],
  ];

  if (includeStaff) {
    required.push(
      ['staff-moderation', '🛡️・modération', ChannelType.GuildText],
      ['staff-moderation', '🛡️・mod-chat', ChannelType.GuildText],
      ['staff-moderation', '🎫・staff-tickets', ChannelType.GuildText],
      ['staff-high', '👑・direction', ChannelType.GuildText],
      ['staff-high', '👑・administration', ChannelType.GuildText],
      ['staff-high', '🔐・sécurité', ChannelType.GuildText],
    );
  }

  for (const [key, name, type] of required) {
    const parent = categoryMap.get(key)!;
    const visibility = categoryPermission(key);
    const data = { name, type, topic: type === ChannelType.GuildText ? `Salon OMNIX — ${name}` : null, nsfw: false, rateLimitPerUser: 0 };
    const channel = await ensureChannel(guild, data, parent, visibility);
    created.set(name, channel);
    if (name.includes('create-ticket')) created.set('create-ticket', channel);
    if (name.includes('transcripts')) created.set('transcripts', channel);
    const match = normalizeName(name).match(/(?:logs[-_·・]|logs)(joins|leaves|moderation|tickets|premium|payments|security|errors|bot|voice|role|staff|admin)/);
    if (match) created.set(`logs-${match[1]}`, channel);
  }

  const ticketCategory = categoryMap.get('tickets-private') ?? categoryMap.get('support');
  if (ticketCategory) created.set('ticket-category', ticketCategory);
  await removeDuplicateChannels(guild);
  await syncGuildConfig(guild, created);

  return { channels: dataChannels.length, categories: categoryMap.size, roles: roleNames.size, removedDuplicates: 0 };
}

function isStaffChannel(channel: GuildChannel) {
  return STAFF_NAME.test(channel.name) || STAFF_NAME.test(channel.parent?.name || '') || isLogChannel(channel.name);
}

export default {
  data: new SlashCommandBuilder()
    .setName('build')
    .setDescription('Analyse, copie et reconstruit intelligemment la structure OMNIX.')
    .addSubcommand(sub => sub.setName('copy').setDescription('Analyse la totalité du serveur et enregistre sa structure.').addBooleanOption(o => o.setName('staff').setDescription('Inclure le staff, la modération et les espaces privés.').setRequired(false)))
    .addSubcommand(sub => sub.setName('past').setDescription('Reconstruit la structure et réapplique les permissions.').addBooleanOption(o => o.setName('staff').setDescription('Créer et sécuriser également les espaces staff.').setRequired(false))),

  async execute({ interaction }: any) {
    const ownerIds = Array.isArray(CONFIG.OWNER_IDS) ? CONFIG.OWNER_IDS.map(String) : [];
    if (!ownerIds.includes(String(interaction.user.id))) return interaction.reply({ content: 'Cette commande est réservée au fondateur d’OMNIX.', flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', flags: MessageFlags.Ephemeral });

    const includeStaff = Boolean(interaction.options.getBoolean('staff') ?? false);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const sub = interaction.options.getSubcommand();
      if (sub === 'copy') {
        await interaction.editReply('Analyse de la totalité des catégories, salons, rôles et permissions en cours…');
        const data = await analyzeGuild(interaction.guild, includeStaff);
        await BuildSnapshot.deleteMany({ ownerId: String(interaction.user.id) });
        await BuildSnapshot.create({ ownerId: String(interaction.user.id), sourceGuildId: interaction.guild.id, sourceGuildName: interaction.guild.name, includeStaff, roles: data.roles, channels: data.channels });
        return interaction.editReply(`Copie terminée : ${data.channels.length} salons et ${data.roles.length} rôles analysés${includeStaff ? ', staff inclus.' : ', staff exclu.'}`);
      }

      const snapshot = await BuildSnapshot.findOne({ ownerId: String(interaction.user.id) }).sort({ createdAt: -1 }).lean();
      if (!snapshot) return interaction.editReply('Aucune copie disponible. Utilise d’abord `/build copy`.');
      await interaction.editReply('Reconstruction de la structure OMNIX et application des permissions par rôle…');
      const result = await pasteSnapshot(interaction.guild, snapshot, includeStaff);
      return interaction.editReply(`Build terminé : ${result.channels} salons analysés, ${result.categories} catégories et ${result.roles} rôles traités. Les permissions, les espaces staff, les logs, les tickets et les salons de la communauté ont été réorganisés.`);
    } catch (error: any) {
      console.error('[Build Command Error]', error);
      return interaction.editReply(`Échec de /build : ${error?.message || 'Erreur inconnue'}`);
    }
  },
} as Command;
