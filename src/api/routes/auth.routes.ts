import { Router } from 'express';
// 🟢 CORRECTIF : Importation de l'objet contrôleur complet par défaut (sans accolades)
import authController from '../controllers/auth.controller.ts'; 

const router = Router();

/**
 * Routeur d'authentification OMNIX
 * Utilise l'objet importé par défaut pour cibler proprement la fonction de rappel
 */
router.get('/callback', authController.discordCallback);

export default router;