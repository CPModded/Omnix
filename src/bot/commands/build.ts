import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ChannelType, 
  PermissionFlagsBits, 
  Role,
  ColorResolvable
} from 'discord.js';
import { Command } from '../types';
import { CONFIG } from '../../config';

export default {
  data: new SlashCommandBuilder()
    .setName('build')
    .setDescription('Nettoie le serveur et génère la structure officielle OMNIX avec émojis.'),

  async execute({ interaction }) {
    // 1. Vérification stricte de l'autorisation d'exécution
    const isOwner = CONFIG.DISCORD.OWNER_IDS.includes(interaction.user.id);
    if (!isOwner) {
      return interaction.reply({ 
        content: '❌ Cette commande d\'initialisation globale est strictement réservée au fondateur de la plateforme.', 
        ephemeral: true 
      });
    }

    await interaction.deferReply();
    const guild = interaction.guild!;

    try {
      // ==========================================
      // ÉTAPE 1 : NETTOYAGE COMPLET DU SERVEUR
      // ==========================================
      await interaction.editReply('🗑️ **Étape 1/5 : Nettoyage des anciens salons existants...**');
      
      const existingChannels = await guild.channels.fetch();
      for (const [_, channel] of existingChannels) {
        if (channel) {
          await channel.delete('OMNIX Hard Reset').catch(() => {});
        }
      }

      await interaction.editReply('🗑️ **Étape 2/5 : Nettoyage des anciens rôles personnalisés...**');
      
      const existingRoles = await guild.roles.fetch();
      for (const [_, role] of existingRoles) {
        // Sécurité : Ne jamais tenter de supprimer @everyone ou les rôles gérés par des intégrations/bots
        if (role.id === guild.id || role.managed) continue;
        
        await role.delete('OMNIX Hard Reset').catch(() => {});
      }

      // ==========================================
      // ÉTAPE 2 : CRÉATION DES NOUVEAUX RÔLES
      // ==========================================
      await interaction.editReply('⚙️ **Étape 3/5 : Génération des nouveaux rôles de couleur...**');

      const rolesConfig = [
        { name: 'Founder', color: '#FFD700', hoist: true, mentionable: true },
        { name: 'Co-Founder', color: '#FF8C00', hoist: true, mentionable: true },
        { name: 'Lead Developer', color: '#8A2BE2', hoist: true, mentionable: true },
        { name: 'Developer', color: '#8A2BE2', hoist: true, mentionable: true },
        { name: 'System Administrator', color: '#FF0055', hoist: true },
        { name: 'Administrator', color: '#FF0000', hoist: true },
        { name: 'Moderator', color: '#0000FF', hoist: true },
        { name: 'Support Manager', color: '#00FF66', hoist: true },
        { name: 'Support', color: '#00FF00', hoist: true },
        { name: 'Community Manager', color: '#FFAA00' },
        { name: 'Translator', color: '#00AAFF' },
        { name: 'Beta Tester', color: '#FFFF00' },
        { name: 'Partner', color: '#FF00FF' },
        { name: 'Content Creator', color: '#E100FF' },
        { name: 'Premium Lifetime', color: '#00FFFF', hoist: true },
        { name: 'Premium', color: '#00FFFF', hoist: true },
        { name: 'Verified', color: '#FFFFFF' },
        { name: 'Member', color: '#808080' },
        { name: 'Bot', color: '#7289DA', hoist: true },
        { name: 'Muted', color: '#4F4F4F' }
      ];

      const createdRoles = new Map<string, Role>();

      for (const roleDef of rolesConfig) {
        const role = await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color as ColorResolvable,
          hoist: roleDef.hoist || false,
          mentionable: roleDef.mentionable || false,
          reason: 'OMNIX Server Builder'
        });
        createdRoles.set(roleDef.name, role);
      }

      // Raccourcis pour les rôles requis pour les salons privés
      const rFounder = createdRoles.get('Founder')!;
      const rCoFounder = createdRoles.get('Co-Founder')!;
      const rDeveloper = createdRoles.get('Developer')!;
      const rLeadDev = createdRoles.get('Lead Developer')!;
      const rAdmin = createdRoles.get('Administrator')!;
      const rMod = createdRoles.get('Moderator')!;
      const rSupport = createdRoles.get('Support')!;
      const rSupportManager = createdRoles.get('Support Manager')!;
      const rPremium = createdRoles.get('Premium')!;
      const rPremiumLifetime = createdRoles.get('Premium Lifetime')!;
      const rMuted = createdRoles.get('Muted')!;
      const rEveryone = guild.roles.everyone;

      // ==========================================
      // ÉTAPE 3 : CRÉATION DES CATÉGORIES & SALONS
      // ==========================================
      await interaction.editReply('⚙️ **Étape 4/5 : Déploiement des salons textuels et d\'annonces avec émojis...**');

      const categoriesStructure = [
        {
          name: '📢 INFORMATIONS',
          overwrites: [
            { id: rEveryone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
            { id: rAdmin.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] },
            { id: rFounder.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] }
          ],
          channels: [
            { name: '👋・welcome', type: ChannelType.GuildText },
            { name: '🔔・announcements', type: ChannelType.GuildAnnouncement },
            { name: '🚀・changelog', type: ChannelType.GuildAnnouncement },
            { name: '📊・status', type: ChannelType.GuildText },
            { name: '🗺️・roadmap', type: ChannelType.GuildText },
            { name: '📚・faq', type: 'forum' },
            { name: '📜・rules', type: ChannelType.GuildText },
            { name: '🎭・roles', type: ChannelType.GuildText },
            { name: '🔗・links', type: ChannelType.GuildText }
          ]
        },
        {
          name: '💬 COMMUNAUTÉ',
          overwrites: [
            { id: rEveryone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions] },
            { id: rMuted.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions] }
          ],
          channels: [
            { name: '💬・general', type: ChannelType.GuildText },
            { name: '🤖・bot-discussion', type: ChannelType.GuildText },
            { name: '✨・showcase', type: ChannelType.GuildText },
            { name: '💡・suggestions', type: ChannelType.GuildText },
            { name: '🐛・bug-report', type: ChannelType.GuildText },
            { name: '📸・media', type: ChannelType.GuildText },
            { name: '😂・memes', type: ChannelType.GuildText },
            { name: '☕・off-topic', type: ChannelType.GuildText }
          ]
        },
        {
          name: '🆘 SUPPORT',
          overwrites: [
            { id: rEveryone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: rSupport.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rSupportManager.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rAdmin.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rFounder.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ],
          channels: [
            { name: '🎫・create-ticket', type: ChannelType.GuildText },
            { name: '💬・support-chat', type: ChannelType.GuildText },
            { name: '💎・premium-support', type: ChannelType.GuildText }
          ]
        },
        {
          name: '💎 PREMIUM',
          overwrites: [
            { id: rEveryone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: rPremium.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rPremiumLifetime.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rAdmin.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rFounder.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ],
          channels: [
            { name: '✨・premium-news', type: ChannelType.GuildText },
            { name: '💬・premium-chat', type: ChannelType.GuildText },
            { name: '🧪・beta-testing', type: ChannelType.GuildText }
          ]
        },
        {
          name: '🤖 DÉVELOPPEMENT',
          overwrites: [
            { id: rEveryone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: rDeveloper.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rLeadDev.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rFounder.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: rCoFounder.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ],
          channels: [
            { name: '💻・dev-news', type: ChannelType.GuildText },
            { name: '🔌・api', type: ChannelType.GuildText },
            { name: '🧱・plugins', type: ChannelType.GuildText },
            { name: '🧠・ideas', type: ChannelType.GuildText }
          ]
        },
        {
          name: '💼 PARTENAIRES',
          overwrites: [
            { id: rEveryone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
            { id: rAdmin.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] },
            { id: rFounder.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] }
          ],
          channels: [
            { name: '🤝・partners', type: ChannelType.GuildText },
            { name: '📢・advertising', type: ChannelType.GuildText }
          ]
        },
        {
          name: '📜 JOURNALISATION (LOGS)',
          overwrites: [
            { id: rEveryone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: rAdmin.id, allow: [PermissionFlagsBits.ViewChannel] },
            { id: rFounder.id, allow: [PermissionFlagsBits.ViewChannel] },
            { id: rMod.id, allow: [PermissionFlagsBits.ViewChannel] }
          ],
          channels: [
            { name: '📥・logs-joins', type: ChannelType.GuildText },
            { name: '📤・logs-leaves', type: ChannelType.GuildText },
            { name: '🛡️・logs-mod', type: ChannelType.GuildText },
            { name: '🎫・logs-tickets', type: ChannelType.GuildText },
            { name: '💎・logs-premium', type: ChannelType.GuildText },
            { name: '💳・logs-payments', type: ChannelType.GuildText },
            { name: '🔒・logs-security', type: ChannelType.GuildText },
            { name: '⚠️・logs-errors', type: ChannelType.GuildText },
            { name: '🤖・logs-bot', type: ChannelType.GuildText },
            { name: '🔊・logs-voice', type: ChannelType.GuildText },
            { name: '🎭・logs-role', type: ChannelType.GuildText }
          ]
        }
      ];

      for (const catConfig of categoriesStructure) {
        const category = await guild.channels.create({
          name: catConfig.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: catConfig.overwrites
        });

        for (const chanConfig of catConfig.channels) {
          let type = chanConfig.type;
          
          if (chanConfig.type === 'forum') {
            try {
              type = ChannelType.GuildForum;
            } catch (e) {
              type = ChannelType.GuildText; // Fallback textuel
            }
          }

          try {
            await guild.channels.create({
              name: chanConfig.name,
              type: type as any,
              parent: category.id
            });
          } catch (channelError: any) {
            if (type === ChannelType.GuildForum) {
              await guild.channels.create({
                name: chanConfig.name,
                type: ChannelType.GuildText,
                parent: category.id
              });
            }
          }
        }
      }

      await interaction.editReply('⚙️ **Étape 5/5 : Configuration finale des salons vocaux...**');

      const voiceCategory = await guild.channels.create({
        name: '🔊 SALONS VOCAUX',
        type: ChannelType.GuildCategory
      });

      const voiceChannels = [
        { name: '🔊・General 1', type: ChannelType.GuildVoice },
        { name: '🔊・General 2', type: ChannelType.GuildVoice },
        { name: '🎮・Gaming', type: ChannelType.GuildVoice },
        { name: '🎧・Support', type: ChannelType.GuildVoice },
        { name: '💎・Premium', type: ChannelType.GuildVoice },
        { name: '💤・AFK', type: ChannelType.GuildVoice }
      ];

      for (const vc of voiceChannels) {
        await guild.channels.create({
          name: vc.name,
          type: vc.type,
          parent: voiceCategory.id
        });
      }

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ RECONSTRUCTION COMPLÈTE TERMINÉE')
        .setDescription('L\'ancien contenu a été nettoyé. La structure, les rôles thématiques de couleur, ainsi que les salons organisés avec émojis d\'OMNIX ont été réinitialisés avec succès.')
        .setColor(0x059669)
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [successEmbed] });

    } catch (err: any) {
      console.error('[Build Command Error] :', err);
      await interaction.editReply(`❌ Échec de la construction du serveur : ${err.message}`);
    }
  }
} as Command;