import { Router } from 'express';
import { client as botClient } from '../../bot/client';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { isAuthenticated } from '../middlewares/auth';
import { adminCheck } from '../middlewares/adminCheck';

const router = Router();

// Route pour lister tous les utilisateurs de la base de données (Staff Only)
router.get('/api/admin/users', isAuthenticated, adminCheck, async (req, res) => {
  try {
    const users = await User.find()
      .select('discordId username avatar isAdmin rewards licenses')
      .limit(50);
      
    return res.json(users);
  } catch (error: any) {
    console.error('[API Admin Users Error] :', error);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des utilisateurs.' });
  }
});

// Route pour lister l'historique d'Audit Center (Staff Only)
router.get('/api/admin/audit-logs', isAuthenticated, adminCheck, async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(30);
      
    return res.json(logs);
  } catch (error: any) {
    console.error('[API Admin Audit Logs Error] :', error);
    return res.status(500).json({ error: 'Impossible de récupérer le journal d\'audit.' });
  }
});

// Route sécurisée pour pousser une mise à jour dans le salon #changelog
router.post('/api/admin/deploy-changelog', async (req, res) => {
  const { secret, version, description, author } = req.body;
  const changelogChannelId = "1527176322319777832"; // ID de votre salon #changelog officiel OMNIX

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