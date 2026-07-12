import { Router, raw } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { isAuthenticated } from '../middlewares/auth';

const router = Router();

// Route d'achat (Sécurisée par JWT)
router.post('/checkout', isAuthenticated as any, PaymentController.createCheckoutSession);

// Route Webhook Stripe (Utilise directement "raw" importé ci-dessus)
router.post('/webhook', raw({ type: 'application/json' }), PaymentController.handleWebhook);

export default router;