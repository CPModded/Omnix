import { Router } from 'express';
import { GuildsController } from '../controllers/guilds.controller';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();

// Récupère la liste des serveurs de l'utilisateur connecté (Sécurisé par JWT)
router.get('/', isAuthenticated as any, GuildsController.getUserGuilds);

export default router;