import { Router } from 'express';
// Importation ESM du contrôleur avec son extension .ts
import { discordCallback } from '../controllers/auth.controller.ts'; 

const router = Router();

/**
 * Routeur d'authentification OMNIX
 * Puisqu'il est monté avec le préfixe "/api/auth" dans index.ts,
 * le chemin d'accès final pour le navigateur est bien "/api/auth/callback"
 */
router.get('/callback', discordCallback);

export default router;