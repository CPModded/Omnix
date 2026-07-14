/**
 * ====================================================================
 * CONFIGURATION DES ROUTES D'AFFICHAGE DU DASHBOARD (OMNIX CORE)
 * ====================================================================
 */

import { Router } from 'express';
import { FounderController } from '../controllers/founder.controller';
import { CONFIG } from '../../config';

const router = Router();

// Page d'accueil OMNIX
router.get('/', (req, res) => {
  res.render('index', { 
    clientId: CONFIG.DISCORD.CLIENT_ID,
    redirectUri: encodeURIComponent(CONFIG.DISCORD.REDIRECT_URI)
  });
});

// Page d'Abonnements & Tarifs (Stripe)
router.get('/pricing', (req, res) => {
  res.render('pricing', { clientId: CONFIG.DISCORD.CLIENT_ID });
});

// Page de documentation (En savoir plus)
router.get('/learn-more', (req, res) => {
  res.render('learn-more');
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