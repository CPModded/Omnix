/**
 * ====================================================================
 * CONTRÔLEUR DES PAIEMENTS ET LIVRAISON AUTOMATIQUE (STRIPE)
 * ====================================================================
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { CONFIG } from '../../config';
import { License } from '../../models/License';
import { AuthenticatedRequest } from '../middlewares/auth';
import crypto from 'crypto';

const stripe = new Stripe(CONFIG.PAYMENTS.STRIPE_KEY, {
  apiVersion: '2025-01-27' as any
});

export class PaymentController {
  // 1. Initialise une session de paiement Stripe Checkout
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
        success_url: `${CONFIG.CLIENT_URL}/dashboard?payment=success`,
        cancel_url: `${CONFIG.CLIENT_URL}/dashboard?payment=cancel`,
      });

      return res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Erreur session Stripe Checkout:', error.message);
      return res.status(500).json({ error: 'Création de la session de paiement impossible.' });
    }
  }

  // 2. Écoute de l'événement webhook Stripe pour la livraison de la clé
  static async handleWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    if (!sig) {
      return res.status(400).send('Signature Stripe manquante.');
    }

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        CONFIG.PAYMENTS.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('Erreur signature webhook Stripe:', err.message);
      return res.status(400).send(`Erreur Signature Webhook: ${err.message}`);
    }

    // Si le paiement est réussi, on génère et stocke la clé de licence
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier as 'premium' | 'lifetime' | 'enterprise';
      const durationInDays = parseInt(session.metadata?.durationInDays || '30', 10);

      if (userId && tier) {
        try {
          // Génération cryptographique d'une clé de licence unique d'OMNIX
          const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
          const licenseKey = `OMNIX-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

          const newLicense = new License({
            key: licenseKey,
            tier: tier,
            status: 'active',
            buyerId: userId,
            durationInDays: durationInDays,
          });

          await newLicense.save();
          console.log(`[Stripe Webhook] 💎 Licence ${licenseKey} créée de manière automatisée pour l'utilisateur : ${userId}`);

        } catch (dbError) {
          console.error('[Stripe Webhook Error] Échec de l\'enregistrement de la licence :', dbError);
          return res.status(500).send('Erreur d\'écriture en base de données.');
        }
      }
    }

    return res.json({ received: true });
  }
}