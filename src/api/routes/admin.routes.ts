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
    const guildsCount = botClient && botClient.readyAt ? botClient.guilds.cache.size : 0;
    const ping = botClient && botClient.readyAt ? botClient.ws.ping : 0;

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
// 2. RÉCUPÉRATION DES SERVEURS DISCORD (Dashboard)
// ==========================================
router.get('/api/guilds', isAuthenticated, async (req: any, res) => {
  try {
    const discordId = req.user?.discordId; 
    if (!discordId) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const user = await User.findOne({ discordId });
    if (!user || !user.accessToken) {
      return res.status(401).json({ error: 'Session Discord expirée. Veuillez vous reconnecter.' });
    }

    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${user.accessToken}` }
    });

    const guilds = response.data;

    const adminGuilds = guilds.filter((g: any) => 
      g.owner || 
      (parseInt(g.permissions) & 0x8) === 0x8 || 
      (parseInt(g.permissions) & 0x20) === 0x20
    );

    return res.json(adminGuilds);
  } catch (error: any) {
    console.error('[API Guilds Error] :', error.response?.data || error.message);
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Jeton de session Discord expiré.' });
    }
    return res.status(500).json({ error: 'Impossible de récupérer vos serveurs.' });
  }
});

// ==========================================
// 3. ADMINISTRATION DES UTILISATEURS (Staff Only)
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
// 4. JOURNALISATION AUDIT CENTER (Staff Only)
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
// 5. ATTRIBUTION DE LICENCE PREMIUM AVEC DURÉE FLEXIBLE (Staff Only)
// ==========================================
router.post('/api/admin/users/:userId/grant-premium', isAuthenticated, adminCheck, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { duration } = req.body; // Récupère "1m", "3m", "6m", "1y" ou "lifetime"

    const user = await User.findOne({ discordId: userId });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Calcul dynamique de la date d'expiration de la licence
    let expiresAt: Date | null = null;
    if (duration !== 'lifetime') {
      expiresAt = new Date();
      if (duration === '1m') expiresAt.setMonth(expiresAt.getMonth() + 1);
      else if (duration === '3m') expiresAt.setMonth(expiresAt.getMonth() + 3);
      else if (duration === '6m') expiresAt.setMonth(expiresAt.getMonth() + 6);
      else if (duration === '1y') expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Génération d'une clé de licence unique d'OMNIX
    const licenseKey = `OMNIX-PREM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newLicense = {
      licenseKey,
      tier: 'premium',
      status: 'active',
      expiresAt
    };

    // Ajoute la licence dans le tableau des licences de l'utilisateur
    user.licenses = user.licenses || [];
    user.licenses.push(newLicense);
    await user.save();

    console.log(`[Staff Action] Licence Premium (${duration}) attribuée à @${user.username} : ${licenseKey}`);

    return res.json({ success: true, license: newLicense });
  } catch (error: any) {
    console.error('[API Grant Premium Error] :', error);
    return res.status(500).json({ error: 'Impossible d\'attribuer la licence Premium.' });
  }
});

// ==========================================
// 6. PROMOTION / DÉGRADATION DE DROITS STAFF ADMIN (Staff Only)
// ==========================================
router.post('/api/admin/users/:userId/toggle-admin', isAuthenticated, adminCheck, async (req: any, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ discordId: userId });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Inverse le rôle administrateur du compte
    user.isAdmin = !user.isAdmin;
    await user.save();

    console.log(`[Staff Action] Statut Admin de @${user.username} changé à : ${user.isAdmin}`);

    return res.json({ success: true, isAdmin: user.isAdmin });
  } catch (error: any) {
    console.error('[API Toggle Admin Error] :', error);
    return res.status(500).json({ error: 'Impossible de modifier les droits d\'administration.' });
  }
});

// ==========================================
// 7. WEBHOOK DE PUBLICATION DE CHANGELOG
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