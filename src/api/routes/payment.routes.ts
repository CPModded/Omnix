import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { isAuthenticated } from '../middlewares/auth';
const router=Router();
router.post('/checkout',isAuthenticated as any,PaymentController.createCheckoutSession);
router.post('/webhook',PaymentController.handleWebhook);
export default router;
