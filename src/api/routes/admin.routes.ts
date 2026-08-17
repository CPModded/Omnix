import { Router } from 'express';
import { client as botClient } from '../../bot/client.ts';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { User } from '../../models/User.ts';
import AuditLog from '../../models/AuditLog.ts';
import { isAuthenticated } from '../middlewares/auth.ts';
import { adminCheck } from '../middlewares/adminCheck.ts';

const router = Router();

// ==========================================
// 1. STATISTIQUES GLOBAL DU DASHBOARD (Fetch de l'accueil)
// ==========================================
router.get('/api/stats', async (req, res) => {
  try {
    // 🟢 CORRECTIF DE SÉCURITÉ CONFLIT (Render / Eternodes) :
    // Si le bot n'est pas démarré sur cette instance (ex: sur Render car START_BOT est à "false"),
    // l'objet "botClient" n'est pas prêt et "botClient.readyAt" est nul.
    // On applique des valeurs de secours de 0 pour éviter un plantage TypeError critique.
    const guildsCount = botClient && botClient.readyAt ? botClient.guilds.cache.size : 0;
    const ping = botClient && botClient.readyAt ? botClient.ws.ping : 0;

    // Récupération sécurisée du nombre de membres inscrits en base de données MongoDB Atlas
    const totalUsers = await User.countDocuments().catch(() => 0);

    return res.json({
      success: true,
      bot: {
        guildsCount,
        ping
      },
      database: {
        totalUsers
      }
    });
  } catch (error: any) {
    console.error('[API Stats Error] :', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Une erreur interne est survenue lors de la récupération des statistiques d\'activité.' 
    });
  }
});

// ==========================================
// 2. ADMINISTRATION DES UTILISATEURS (Staff Only)
// ==========================================
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

// ==========================================
// 3. JOURNALISATION AUDIT CENTER (Staff Only)
// ==========================================
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

// ==========================================
// 4. WEBHOOK DE PUBLICATION DE CHANGELOG
// ==========================================
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