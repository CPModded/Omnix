import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
router.get('/login', AuthController.getLoginUrl);
router.get('/callback', AuthController.handleCallback);

export default router;