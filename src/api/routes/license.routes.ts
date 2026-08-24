import { Router } from 'express';
import { LicenseController } from '../controllers/license.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';
const router=Router();
router.post('/activate',isAuthenticated as any,canManageGuild as any,LicenseController.activateLicense);
export default router;
