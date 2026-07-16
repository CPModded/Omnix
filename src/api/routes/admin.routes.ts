import { Router } from 'express';
import { client as botClient } from '../../bot/client';
import { EmbedBuilder, TextChannel } from 'discord.js';

const router = Router();

// Route sécurisée pour pousser une mise à jour dans le salon #changelog
router.post('/api/admin/deploy-changelog', async (req, res) => {
  const { secret, version, description, author } = req.body;
  const changelogChannelId = "VOTRE_CHANNEL_ID_CHANGELOG"; // ID du salon #changelog sur votre serveur officiel

  // Validation de sécurité simple via clé secrète
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }

  try {
    const channel = await botClient.channels.fetch(changelogChannelId) as TextChannel;
    if (!channel) {
      return res.status(404).json({ error: 'Salon changelog introuvable.' });
    }

    const changelogEmbed = new EmbedBuilder()
      .setTitle(`🚀 NOUVELLE MISE À JOUR — VERSION ${version}`)
      .setColor(0x7c3aed) // Violet royal
      .setDescription(description)
      .addFields({ name: 'Déployeur', value: `🔧 ${author || 'OMNIX Engine'}`, inline: true })
      .setFooter({ text: 'OMNIX Auto-Changelog' })
      .setTimestamp();

    await channel.send({ embeds: [changelogEmbed] });
    return res.json({ message: 'Changelog poussé avec succès sur Discord.' });
  } catch (err: any) {
    console.error('[Changelog Webhook Error] :', err.message);
    return res.status(500).json({ error: 'Échec de la publication.' });
  }
});

export default router;