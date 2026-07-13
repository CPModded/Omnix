import { Request, Response } from 'express';
import Stripe from 'stripe';
import { CONFIG } from '../../config';
import { License } from '../../models/License';
import { AuthenticatedRequest } from '../middlewares/auth';
import crypto from 'crypto';

const stripe = new Stripe(CONFIG.PAYMENTS.STRIPE_KEY, {
  apiVersion: '2025-01-27' as any // Utilisation d'une version récente de l'API Stripe
});

export class PaymentController {
  // 1. Initialise un tunnel d'achat Stripe Checkout
  static async createCheckoutSession(req: AuthenticatedRequest, res: Response) {
    const { tier, durationInDays, priceId } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Identification requise.' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: durationInDays === 0 ? 'payment' : 'subscription',
        metadata: {
          userId: user.discordId,
          tier: tier,
          durationInDays: durationInDays.toString()
        },
        success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?payment=success`,
        cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?payment=cancel`,
      });

      return res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Erreur de session Stripe Checkout:', error.message);
      return res.status(500).json({ error: 'Création de la session de paiement impossible.' });
    }
  }

  // 2. Traitement du Webhook Stripe pour l'activation ou livraison automatique
  static async handleWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    if (!sig) {
      return res.status(400).send('Signature Stripe manquante.');
    }

    try {
      // Validation cryptographique de l'origine de l'appel
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        CONFIG.PAYMENTS.STRIPE_WEBHOOK
      );
    } catch (err: any) {
      console.error('Erreur signature webhook Stripe:', err.message);
      return res.status(400).send(`Erreur Signature Webhook: ${err.message}`);
    }

    // Capture de la complétion du paiement
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier as 'premium' | 'lifetime' | 'enterprise';
      const durationInDays = parseInt(session.metadata?.durationInDays || '30', 10);

      if (userId && tier) {
        try {
          // Génération d'une clé de licence unique (ex: WERI-XXXX-XXXX-XXXX)
          const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
          const licenseKey = `WERI-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

          const newLicense = new License({
            key: licenseKey,
            tier: tier,
            status: 'active',
            buyerId: userId,
            durationInDays: durationInDays,
          });

          await newLicense.save();
          console.log(`[Stripe Webhook] Licence ${licenseKey} générée automatiquement pour l'utilisateur ${userId}`);

          // Optionnel : Envoyer un message privé sur Discord via le bot pour lui donner sa clé
        } catch (dbError) {
          console.error('[Stripe Webhook Error] Échec de sauvegarde de la licence:', dbError);
          return res.status(500).send('Erreur d\'écriture en base de données.');
        }
      }
    }

    return res.json({ received: true });
  }
}