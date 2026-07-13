/**
 * ====================================================================
 * ROUTAGE DE L'API D'ADMINISTRATION GLOBALE (OMNIX STAFF)
 * Sécurise l'accès aux données sensibles par double vérification.
 * ====================================================================
 */

import { Router, Response, NextFunction } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { isAuthenticated, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Middleware de niveau "Owner" : Bloque l'accès si l'utilisateur n'est pas Admin
function requireBotOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    console.warn(`[API Auth] 🚫 Tentative d'intrusion bloquée pour : ${req.user?.username || 'Inconnu'}`);
    return res.status(403).json({ error: 'Accès restreint. Permissions de niveau Owner requises.' });
  }
  next();
}

// Routes réservées au Staff
router.get('/monitoring', isAuthenticated as any, requireBotOwner as any, AdminController.getMonitoring);
router.post('/premium', isAuthenticated as any, requireBotOwner as any, AdminController.togglePremium);
router.post('/announce', isAuthenticated as any, requireBotOwner as any, AdminController.sendGlobalAnnouncement);
router.get('/users', isAuthenticated as any, requireBotOwner as any, AdminController.getUsers); // Nouvelle route

export default router;