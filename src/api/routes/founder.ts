import { Router } from 'express';
import { FounderController } from '../controllers/founder.controller';
import { CONFIG } from '../../config';

const router = Router();

// Page de présentation du projet (Landing page)
router.get('/', (req, res) => {
  res.render('index', { clientId: CONFIG.DISCORD.CLIENT_ID });
});

// Page de sélection du serveur
router.get('/dashboard', (req, res) => {
  res.render('dashboard', { clientId: CONFIG.DISCORD.CLIENT_ID });
});

// Page d'administration d'un serveur spécifique
router.get('/dashboard/:guildId', (req, res) => {
  res.render('manage', { guildId: req.params.guildId });
});

// Page du fondateur (Weritale)
router.get('/founder', FounderController.renderFounderPage);

export default router;