/**
 * ====================================================================
 * CONFIGURATION DES ROUTES DE L'API D'ADMINISTRATION GLOBALE
 * ====================================================================
 */

import { Router, Response, NextFunction } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { isAuthenticated, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Middleware local pour restreindre l'exécution aux administrateurs
function requireBotOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    console.warn(`[API Auth] 🚫 Tentative d'accès non autorisé par : ${req.user?.username || 'Inconnu'}`);
    return res.status(403).json({ error: 'Accès restreint. Permissions de niveau Owner requises.' });
  }
  next();
}

// Routes d'administration sécurisées
router.get('/monitoring', isAuthenticated as any, requireBotOwner as any, AdminController.getMonitoring);
router.post('/premium', isAuthenticated as any, requireBotOwner as any, AdminController.togglePremium);
router.post('/announce', isAuthenticated as any, requireBotOwner as any, AdminController.sendGlobalAnnouncement);
router.get('/users', isAuthenticated as any, requireBotOwner as any, AdminController.getUsers);
router.post('/blacklist', isAuthenticated as any, requireBotOwner as any, AdminController.toggleBlacklist);

export default router;