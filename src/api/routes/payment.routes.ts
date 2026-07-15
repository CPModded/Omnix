import { Router, raw } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();

// Création d'une session Stripe Checkout (Sécurisé par JWT)
router.post('/checkout', isAuthenticated as any, PaymentController.createCheckoutSession);

// Réception des événements Stripe (Format RAW brut obligatoire pour valider la signature)
router.post('/webhook', raw({ type: 'application/json' }), PaymentController.handleWebhook);

export default router;