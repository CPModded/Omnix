import { Router } from 'express';
import { FounderController } from '../controllers/founder.controller';
import { client as botClient } from '../../bot/client';
import { User } from '../../models/User';
import { isAuthenticated } from '../middlewares/auth'; // Import correct nommé
import { adminCheck } from '../middlewares/adminCheck'; // Import de notre middleware de vérification Admin/Owner

const router = Router();

// Endpoint de statistiques réelles d'OMNIX
router.get('/api/stats', async (req, res) => {
  try {
    const guildsCount = botClient.guilds.cache.size || 0;
    
    // Total des membres cumulés sur tous les serveurs rejoints
    const discordMembersCount = botClient.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);

    // Total des utilisateurs enregistrés dans notre base de données
    const dbUsersCount = await User.countDocuments().catch(() => 0);

    const ping = botClient.ws ? Math.round(botClient.ws.ping) : 0;

    return res.json({
      bot: {
        guildsCount,
        ping,
        discordMembersCount
      },
      database: {
        totalUsers: dbUsersCount || discordMembersCount // Fallback dynamique si la DB n'a pas encore de comptes
      }
    });
  } catch (error: any) {
    console.error('[API Stats Error] :', error.message || error);
    return res.status(500).json({ error: 'Impossible de charger les statistiques.' });
  }
});

// Page d'accueil OMNIX (Landing page)
router.get('/', (req, res) => {
  res.render('index');
});

// Page de sélection du serveur (Authentification requise)
router.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard');
});

// Page d'administration d'un serveur spécifique (Authentification requise)
router.get('/dashboard/:guildId', isAuthenticated, (req, res) => {
  res.render('manage', { guildId: req.params.guildId });
});

// Page d'Abonnements & Tarifs (Stripe)
router.get('/pricing', (req, res) => {
  res.render('pricing');
});

// Page de documentation (En savoir plus)
router.get('/learn-more', (req, res) => {
  res.render('learn-more');
});

// Page du fondateur OMNIX (Strictement réservée : Connexion + Badge Admin ou Owner requis)
router.get('/founder', isAuthenticated, adminCheck, FounderController.renderFounderPage);

// Panel d'administration Staff (Strictement réservée : Connexion + Badge Admin ou Owner requis)
router.get('/admin', isAuthenticated, adminCheck, (req, res) => { 
  res.render('admin'); 
});

export default router;