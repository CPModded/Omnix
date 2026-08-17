import { Router } from 'express';
// Importation nommée explicite et conforme ES Modules (.ts)
import { discordCallback } from '../controllers/auth.controller.ts'; 

const router = Router();

/**
 * Routeur d'authentification OMNIX
 * Route de rappel Discord OAuth2
 */
router.get('/callback', discordCallback);

export default router;