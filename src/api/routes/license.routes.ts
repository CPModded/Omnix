import { Router } from 'express';
import { LicenseController } from '../controllers/license.controller';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();

// Activation d'une licence achetée (Sécurisé par JWT)
router.post('/activate', isAuthenticated as any, LicenseController.activateLicense);

export default router;