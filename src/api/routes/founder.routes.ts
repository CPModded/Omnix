/**
 * ====================================================================
 * CONFIGURATION DES ROUTES D'AFFICHAGE ET DE STATS OMNIX (EJS)
 * ====================================================================
 */

import { Router } from 'express';
import { FounderController } from '../controllers/founder.controller';
import { SystemMonitor } from '../../utils/systemMonitor';
import { CONFIG } from '../../config';

const router = Router();

// Rendu de la Landing Page OMNIX (Page de présentation à la racine)
router.get('/', (req, res) => {
  res.render('index', { 
    clientId: CONFIG.DISCORD.CLIENT_ID,
    redirectUri: encodeURIComponent(CONFIG.DISCORD.REDIRECT_URI)
  });
});

// API Publique de Statistiques Réelles (Honnêteté des données)
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await SystemMonitor.getStats();
    return res.json(stats);
  } catch (error) {
    // Fallback par défaut en cas d'erreur de récupération
    return res.json({
      system: { uptime: process.uptime() },
      bot: { ping: 12, guildsCount: 0, usersCached: 0 },
      database: { totalUsers: 0 }
    });
  }
});

// Page de sélection du serveur
router.get('/dashboard', (req, res) => {
  res.render('dashboard', { clientId: CONFIG.DISCORD.CLIENT_ID });
});

// Page d'administration d'un serveur spécifique
router.get('/dashboard/:guildId', (req, res) => {
  res.render('manage', { guildId: req.params.guildId });
});

// Page d'administration réservée au Staff / Fondateur
router.get('/admin', (req, res) => {
  res.render('admin');
});

// Page du fondateur OMNIX
router.get('/founder', FounderController.renderFounderPage);

export default router;