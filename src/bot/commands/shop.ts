/**
 * ====================================================================
 * COMMANDE DE BOUTIQUE VIRTUELLE (OMNIX ECONOMY CORE)
 * Gère le listing, l'achat de rôles et l'administration de la boutique.
 * ====================================================================
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, GuildMember } from 'discord.js';
import { Command, CommandContext } from '../types';
import { ShopItem } from '../../models/ShopItem';
import { Economy } from '../../models/Economy';
import crypto from 'crypto';

const shopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Accéder et gérer la boutique virtuelle du serveur')
    // Sous-commande : lister les articles
    .addSubcommand(sub => 
      sub.setName('list')
        .setDescription('Afficher les articles disponibles à l\'achat')
    )
    // Sous-commande : acheter un article
    .addSubcommand(sub => 
      sub.setName('buy')
        .setDescription('Acheter un article ou un rôle de la boutique')
        .addStringOption(opt => opt.setName('item_id').setDescription('ID de l\'article à acheter (ex: SH-A3F1)').setRequired(true))
    )
    // Sous-commande administrative : créer un article (Staff)
    .addSubcommand(sub => 
      sub.setName('create')
        .setDescription('Créer un nouvel article ou rôle achetable (Admin Only)')
        .addStringOption(opt => opt.setName('name').setDescription('Nom de l\'article').setRequired(true))
        .addIntegerOption(opt => opt.setName('price').setDescription('Prix de l\'article').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Rôle Discord à attribuer lors de l\'achat'))
        .addStringOption(opt => opt.setName('description').setDescription('Description de l\'article'))
    )
    // Sous-commande administrative : supprimer un article (Admin Only)
    .addSubcommand(sub => 
      sub.setName('delete')
        .setDescription('Supprimer définitivement un article de la boutique (Admin Only)')
        .addStringOption(opt => opt.setName('item_id').setDescription('ID de l\'article à supprimer').setRequired(true))
    )
    // Sous-commande administrative : voir le panneau d'analyse (Admin Only)
    .addSubcommand(sub => 
      sub.setName('panel')
        .setDescription('Afficher la console de gestion interne de la boutique (Admin Only)')
    ) as any,

  async execute({ interaction, guildConfig }: CommandContext) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const currency = guildConfig.modules.economy.currencySymbol || '$';

    // Sécurité globale : Vérifie si le module d'économie est activé sur le serveur
    if (!guildConfig.modules.economy.enabled) {
      return interaction.reply({
        content: "❌ Le module d'économie et de boutique est désactivé sur ce serveur.",
        ephemeral: true
      });
    }

    // ==========================================
    // SCÉNARIO 1 : LISTER LES ARTICLES
    // ==========================================
    if (subcommand === 'list') {
      await interaction.deferReply();

      try {
        const items = await ShopItem.find({ guildId }).sort({ price: 1 });

        if (items.length === 0) {
          return interaction.editReply({
            content: `ℹ️ La boutique de ce serveur est actuellement vide. Repassez plus tard !`
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`🏪 BOUTIQUE OFFICIELLE — ${interaction.guild!.name}`)
          .setDescription(`Utilisez la commande \`/shop buy [ID]\` pour acheter un article.\nVotre solde est affiché via la commande \`/economy balance\`.`)
          .setColor(0x06b6d4) // Cyan
          .setThumbnail(interaction.guild!.iconURL() || null);

        items.forEach(item => {
          const roleText = item.roleId ? `• Rôle attribué : <@&${item.roleId}>` : '';
          embed.addFields({
            name: `🛒 ${item.name} — ID: \`${item.itemId}\``,
            value: `• Prix : **${item.price}${currency}**\n• Description : *${item.description}*\n${roleText}`,
            inline: false
          });
        });

        return interaction.editReply({ embeds: [embed] });

      } catch (error: any) {
        console.error('[Shop Command List Error] :', error.message);
        return interaction.editReply({ content: "❌ Impossible de charger la liste des articles de la boutique." });
      }
    }

    // ==========================================
    // SCÉNARIO 2 : ACHETER UN ARTICLE
    // ==========================================
    if (subcommand === 'buy') {
      await interaction.deferReply({ ephemeral: true });
      const itemId = interaction.options.getString('item_id', true).toUpperCase();

      try {
        // 1. Recherche de l'article en base de données
        const item = await ShopItem.findOne({ guildId, itemId });
        if (!item) {
          return interaction.editReply({ content: `❌ Aucun article trouvé sous l'ID : \`${itemId}\`.` });
        }

        // 2. Recherche du compte d'économie de l'acheteur
        let account = await Economy.findOne({ guildId, userId });
        if (!account) {
          account = new Economy({ guildId, userId });
          await account.save();
        }

        // 3. Vérification du solde du portefeuille
        if (account.wallet < item.price) {
          const missing = item.price - account.wallet;
          return interaction.editReply({
            content: `❌ **Achat refusé.** Il vous manque **${missing}${currency}** en portefeuille pour acheter cet article (Prix : \`${item.price}${currency}\`).`
          });
        }

        // 4. Traitement des rôles Discord (si l'article attribue un rôle)
        if (item.roleId) {
          const member = interaction.member as GuildMember;
          
          // Vérifie si le joueur possède déjà le rôle
          if (member.roles.cache.has(item.roleId)) {
            return interaction.editReply({ content: "❌ Achat annulé : Vous possédez déjà ce rôle sur le serveur." });
          }

          // Attribution asynchrone du rôle Discord
          const roleToAssign = await interaction.guild!.roles.fetch(item.roleId).catch(() => null);
          if (!roleToAssign) {
            return interaction.editReply({ content: "❌ Échec de l'attribution : Le rôle associé à cet article n'existe plus sur ce serveur." });
          }

          await member.roles.add(roleToAssign).catch(err => {
            console.error('[Shop Role Assignment Error] :', err.message);
            throw new Error("Permissions insuffisantes du bot pour attribuer ce rôle.");
          });
        }

        // 5. Déduction financière et sauvegarde
        account.wallet -= item.price;
        await account.save();

        return interaction.editReply({
          content: `🎉 **Achat réussi !** Vous avez acheté l'article **${item.name}** pour la somme de **${item.price}${currency}** !`
        });

      } catch (error: any) {
        console.error('[Shop Buy Error] :', error.message);
        return interaction.editReply({ content: "❌ Impossible de finaliser l'achat : " + error.message });
      }
    }

    // ==========================================
    // SCÉNARIO 3 : CRÉER UN ARTICLE (ADMINISTRATEUR)
    // ==========================================
    if (subcommand === 'create') {
      // Sécurité locale : Seuls les administrateurs du serveur ont accès
      const member = interaction.member as GuildMember;
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Vous devez posséder les droits Administrateur pour configurer la boutique.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const name = interaction.options.getString('name', true);
      const price = interaction.options.getInteger('price', true);
      const role = interaction.options.getRole('role');
      const desc = interaction.options.getString('description') || 'Aucune description fournie.';

      try {
        // Génération d'un ID court unique de 4 caractères hexadécimaux (ex: SH-A83F)
        const randId = crypto.randomBytes(2).toString('hex').toUpperCase();
        const itemId = `SH-${randId}`;

        const newItem = new ShopItem({
          guildId,
          itemId,
          name,
          price,
          roleId: role ? role.id : null,
          description: desc
        });

        await newItem.save();

        return interaction.editReply({
          content: `✅ **Article créé et ajouté à la boutique !**\n\n• **Nom :** ${name}\n• **ID :** \`${itemId}\`\n• **Prix :** \`${price}${currency}\`\n• **Rôle associé :** ${role ? `<@&${role.id}>` : 'Aucun'}`
        });

      } catch (error: any) {
        console.error('[Shop Create Error] :', error.message);
        return interaction.editReply({ content: "❌ Impossible d'enregistrer le nouvel article." });
      }
    }

    // ==========================================
    // SCÉNARIO 4 : SUPPRIMER UN ARTICLE (ADMINISTRATEUR)
    // ==========================================
    if (subcommand === 'delete') {
      const member = interaction.member as GuildMember;
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Vous devez posséder les droits Administrateur.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const itemId = interaction.options.getString('item_id', true).toUpperCase();

      try {
        const deletedItem = await ShopItem.findOneAndDelete({ guildId, itemId });

        if (!deletedItem) {
          return interaction.editReply({ content: `❌ Aucun article trouvé sous l'ID : \`${itemId}\`.` });
        }

        return interaction.editReply({
          content: `🗑️ L'article **${deletedItem.name}** (\`${itemId}\`) a été définitivement supprimé de la boutique.`
        });

      } catch (error: any) {
        console.error('[Shop Delete Error] :', error.message);
        return interaction.editReply({ content: "❌ Impossible de supprimer l'article de la base." });
      }
    }

    // ==========================================
    // SCÉNARIO 5 : CONSOLE DE GESTION (ADMINISTRATEUR)
    // ==========================================
    if (subcommand === 'panel') {
      const member = interaction.member as GuildMember;
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Vous devez posséder les droits Administrateur.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const totalItems = await ShopItem.countDocuments({ guildId });

        const embed = new EmbedBuilder()
          .setTitle('⚙️ CONSOLE ADMINISTRATIVE DE BOUTIQUE')
          .setColor(0x7c3aed) // Violet
          .addFields(
            { name: '🛒 Nombre d\'articles enregistrés', value: `\`${totalItems}\` article(s)`, inline: true },
            { name: '💳 Devise active', value: `\`${currency}\``, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });

      } catch (error: any) {
        return interaction.editReply({ content: "❌ Impossible de charger les données analytiques de la boutique." });
      }
    }
  }
};

export default shopCommand;