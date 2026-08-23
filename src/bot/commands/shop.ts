import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  randomUUID,
} from 'crypto';
import {
  getGuildConfig,
} from '../utils/guildConfig.ts';
/* =========================================================
   COMMAND
========================================================= */
export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription(
      'Gère et affiche la boutique OMNIX.'
    )
    /* =====================================================
       AFFICHER
    ===================================================== */
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription(
          'Affiche la boutique.'
        )
    )
    /* =====================================================
       AJOUTER
    ===================================================== */
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription(
          'Ajoute un article à la boutique.'
        )
        .addStringOption(option =>
          option
            .setName('nom')
            .setDescription(
              'Nom de l article.'
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription(
              'Description de l article.'
            )
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('prix')
            .setDescription(
              'Prix en coins.'
            )
            .setRequired(true)
            .setMinValue(0)
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription(
              'Emoji de l article.'
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('lien')
            .setDescription(
              'Lien vers le produit.'
            )
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('stock')
            .setDescription(
              'Stock. -1 = illimité.'
            )
            .setRequired(false)
            .setMinValue(-1)
        )
        .addStringOption(option =>
          option
            .setName('categorie')
            .setDescription(
              'Catégorie de l article.'
            )
            .setRequired(false)
        )
    )
    /* =====================================================
       MODIFIER
    ===================================================== */
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription(
          'Modifie un article.'
        )
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription(
              'ID de l article.'
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('nom')
            .setDescription(
              'Nouveau nom.'
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription(
              'Nouvelle description.'
            )
            .setRequired(false)
        )
        .addNumberOption(option =>
          option
            .setName('prix')
            .setDescription(
              'Nouveau prix.'
            )
            .setRequired(false)
            .setMinValue(0)
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription(
              'Nouvel emoji.'
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('lien')
            .setDescription(
              'Nouveau lien.'
            )
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('stock')
            .setDescription(
              'Nouveau stock. -1 = illimité.'
            )
            .setRequired(false)
            .setMinValue(-1)
        )
        .addStringOption(option =>
          option
            .setName('categorie')
            .setDescription(
              'Nouvelle catégorie.'
            )
            .setRequired(false)
        )
    )
    /* =====================================================
       SUPPRIMER
    ===================================================== */
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription(
          'Supprime un article.'
        )
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription(
              'ID de l article.'
            )
            .setRequired(true)
        )
    )
    /* =====================================================
       LISTE
    ===================================================== */
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription(
          'Liste tous les articles.'
        )
    ),
  /* =======================================================
     EXECUTE
  ======================================================= */
  async execute(
    interaction: any
  ) {
    try {
      /* =====================================================
         SERVEUR
      ===================================================== */
      if (!interaction.guildId) {
        await interaction.reply({
          content:
            '❌ Cette commande doit être utilisée sur un serveur.',
          flags: 64,
        });
        return;
      }
      /* =====================================================
         CONFIG
      ===================================================== */
      const config =
        await getGuildConfig(
          interaction.guildId
        );
      if (!config) {
        await interaction.reply({
          content:
            '❌ Impossible de récupérer la configuration du serveur.',
          flags: 64,
        });
        return;
      }
      /*
       * Sécurité supplémentaire pour les anciennes configs.
       */
      if (!Array.isArray(config.shop)) {
        config.shop = [];
        await config.save();
      }
      const subcommand =
        interaction.options.getSubcommand();
      /* =====================================================
         VIEW
      ===================================================== */
      if (
        subcommand === 'view'
      ) {
        if (
          config.shop.length === 0
        ) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(
                  '🛒 Boutique OMNIX'
                )
                .setDescription(
                  'La boutique est actuellement vide.'
                )
                .setFooter({
                  text:
                    'OMNIX • Boutique',
                }),
            ],
          });
          return;
        }
        const embed =
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              '🛒 Boutique OMNIX'
            )
            .setDescription(
              'Découvrez les articles disponibles ci-dessous.'
            )
            .setTimestamp();
        /*
         * Discord limite un embed à 25 fields.
         */
        const items =
          config.shop.slice(
            0,
            25
          );
        for (
          const item of items
        ) {
          const stock =
            item.stock === -1
              ? '∞ Illimité'
              : item.stock <= 0
                ? '❌ Épuisé'
                : `📦 ${item.stock}`;
          const link =
            item.link
              ? `\n🔗 [Accéder au produit](${item.link})`
              : '';
          embed.addFields({
            name:
              `${item.emoji || '🛒'} ${item.name}`,
            value:
              `${item.description || 'Aucune description.'}\n\n` +
              `💰 **${item.price} coins**\n` +
              `${stock}` +
              `${item.category ? `\n📁 ${item.category}` : ''}` +
              link +
              `\n\n🆔 \`${item.id}\``,
            inline: false,
          });
        }
        if (
          config.shop.length > 25
        ) {
          embed.setFooter({
            text:
              `OMNIX • ${config.shop.length} articles • Affichage limité à 25`,
          });
        } else {
          embed.setFooter({
            text:
              `OMNIX • ${config.shop.length} article(s)`,
          });
        }
        await interaction.reply({
          embeds: [
            embed,
          ],
        });
        return;
      }
      /* =====================================================
         LIST
      ===================================================== */
      if (
        subcommand === 'list'
      ) {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          await interaction.reply({
            content:
              '❌ Tu dois être administrateur pour gérer la boutique.',
            flags: 64,
          });
          return;
        }
        if (
          config.shop.length === 0
        ) {
          await interaction.reply({
            content:
              '🛒 La boutique ne contient aucun article.',
            flags: 64,
          });
          return;
        }
        const lines =
          config.shop.map(
            (item, index) =>
              `${index + 1}. ${item.emoji || '🛒'} **${item.name}** — ${item.price} coins — ID: \`${item.id}\``
          );
        const chunks: string[] = [];
        for (
          let i = 0;
          i < lines.length;
          i += 20
        ) {
          chunks.push(
            lines
              .slice(i, i + 20)
              .join('\n')
          );
        }
        const embed =
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(
              '📋 Articles de la boutique'
            )
            .setDescription(
              chunks[0] ??
                'Aucun article.'
            );
        await interaction.reply({
          embeds: [
            embed,
          ],
          flags: 64,
        });
        return;
      }
      /* =====================================================
         PERMISSIONS ADMIN
      ===================================================== */
      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        await interaction.reply({
          content:
            '❌ Tu dois être administrateur pour modifier la boutique.',
          flags: 64,
        });
        return;
      }
      /* =====================================================
         ADD
      ===================================================== */
      if (
        subcommand === 'add'
      ) {
        const name =
          interaction.options.getString(
            'nom',
            true
          );
        const description =
          interaction.options.getString(
            'description',
            true
          );
        const price =
          interaction.options.getNumber(
            'prix',
            true
          );
        const emoji =
          interaction.options.getString(
            'emoji'
          ) || '🛒';
        const link =
          interaction.options.getString(
            'lien'
          ) || undefined;
        const stock =
          interaction.options.getInteger(
            'stock'
          ) ?? -1;
        const category =
          interaction.options.getString(
            'categorie'
          ) || 'Général';
        /*
         * Validation URL.
         */
        if (link) {
          try {
            const parsed =
              new URL(link);
            if (
              ![
                'http:',
                'https:',
              ].includes(
                parsed.protocol
              )
            ) {
              throw new Error(
                'Protocole invalide'
              );
            }
          } catch {
            await interaction.reply({
              content:
                '❌ Le lien fourni n’est pas une URL valide. Utilise `https://...`.',
              flags: 64,
            });
            return;
          }
        }
        const now =
          new Date();
        const item = {
          id:
            randomUUID()
              .split('-')[0]
              .toUpperCase(),
          name,
          description,
          price,
          emoji,
          link,
          stock,
          category,
          createdAt: now,
          updatedAt: now,
        };
        config.shop.push(
          item
        );
        await config.save();
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x22c55e)
              .setTitle(
                '✅ Article ajouté'
              )
              .setDescription(
                `**${emoji} ${name}** a été ajouté à la boutique.`
              )
              .addFields(
                {
                  name:
                    '💰 Prix',
                  value:
                    `${price} coins`,
                  inline: true,
                },
                {
                  name:
                    '📦 Stock',
                  value:
                    stock === -1
                      ? '∞ Illimité'
                      : String(stock),
                  inline: true,
                },
                {
                  name:
                    '🆔 ID',
                  value:
                    `\`${item.id}\``,
                  inline: true,
                }
              ),
          ],
        });
        return;
      }
      /* =====================================================
         EDIT
      ===================================================== */
      if (
        subcommand === 'edit'
      ) {
        const id =
          interaction.options.getString(
            'id',
            true
          );
        const item =
          config.shop.find(
            entry =>
              entry.id
                .toLowerCase() ===
              id.toLowerCase()
          );
        if (!item) {
          await interaction.reply({
            content:
              `❌ Aucun article trouvé avec l'ID \`${id}\`.`,
            flags: 64,
          });
          return;
        }
        const name =
          interaction.options.getString(
            'nom'
          );
        const description =
          interaction.options.getString(
            'description'
          );
        const price =
          interaction.options.getNumber(
            'prix'
          );
        const emoji =
          interaction.options.getString(
            'emoji'
          );
        const link =
          interaction.options.getString(
            'lien'
          );
        const stock =
          interaction.options.getInteger(
            'stock'
          );
        const category =
          interaction.options.getString(
            'categorie'
          );
        /*
         * Au moins une modification.
         */
        if (
          name === null &&
          description === null &&
          price === null &&
          emoji === null &&
          link === null &&
          stock === null &&
          category === null
        ) {
          await interaction.reply({
            content:
              '❌ Tu dois fournir au moins une valeur à modifier.',
            flags: 64,
          });
          return;
        }
        /*
         * Validation URL.
         */
        if (link !== null) {
          try {
            const parsed =
              new URL(link);
            if (
              ![
                'http:',
                'https:',
              ].includes(
                parsed.protocol
              )
            ) {
              throw new Error();
            }
          } catch {
            await interaction.reply({
              content:
                '❌ Le nouveau lien n’est pas valide. Utilise `https://...`.',
              flags: 64,
            });
            return;
          }
        }
        if (
          name !== null
        ) {
          item.name =
            name;
        }
        if (
          description !== null
        ) {
          item.description =
            description;
        }
        if (
          price !== null
        ) {
          item.price =
            price;
        }
        if (
          emoji !== null
        ) {
          item.emoji =
            emoji;
        }
        if (
          link !== null
        ) {
          item.link =
            link;
        }
        if (
          stock !== null
        ) {
          item.stock =
            stock;
        }
        if (
          category !== null
        ) {
          item.category =
            category;
        }
        item.updatedAt =
          new Date();
        await config.save();
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3b82f6)
              .setTitle(
                '✅ Article modifié'
              )
              .setDescription(
                `L'article **${item.name}** a été mis à jour.`
              )
              .addFields({
                name:
                  '🆔 ID',
                value:
                  `\`${item.id}\``,
                inline: true,
              }),
          ],
        });
        return;
      }
      /* =====================================================
         REMOVE
      ===================================================== */
      if (
        subcommand === 'remove'
      ) {
        const id =
          interaction.options.getString(
            'id',
            true
          );
        const index =
          config.shop.findIndex(
            item =>
              item.id
                .toLowerCase() ===
              id.toLowerCase()
          );
        if (
          index === -1
        ) {
          await interaction.reply({
            content:
              `❌ Aucun article trouvé avec l'ID \`${id}\`.`,
            flags: 64,
          });
          return;
        }
        const [
          removed,
        ] =
          config.shop.splice(
            index,
            1
          );
        await config.save();
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle(
                '🗑️ Article supprimé'
              )
              .setDescription(
                `L'article **${removed.name}** a été supprimé de la boutique.`
              )
              .addFields({
                name:
                  '🆔 ID',
                value:
                  `\`${removed.id}\``,
                inline: true,
              }),
          ],
        });
        return;
      }
    } catch (error) {
      console.error(
        '[Shop] Erreur :',
        error
      );
      const message =
        '❌ Une erreur est survenue pendant la gestion de la boutique.';
      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              message,
            flags: 64,
          });
        } else {
          await interaction.reply({
            content:
              message,
            flags: 64,
          });
        }
      } catch (replyError) {
        console.error(
          '[Shop] Impossible de répondre à l interaction :',
          replyError
        );
      }
    }
  },
};