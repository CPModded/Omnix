import { Router } from 'express';
import { LicenseController } from '../controllers/license.controller';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();

router.post('/activate', isAuthenticated as any, LicenseController.activateLicense);

export default router;