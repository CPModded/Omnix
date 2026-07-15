import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Génère l'URL d'authentification
router.get('/login', AuthController.getLoginUrl);

// Réceptionne le retour d'autorisation de Discord
router.get('/callback', AuthController.handleCallback);

export default router;