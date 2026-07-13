import { Router } from 'express';
import { GuildsController } from '../controllers/guilds.controller';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();
router.get('/', isAuthenticated as any, GuildsController.getUserGuilds);

export default router;