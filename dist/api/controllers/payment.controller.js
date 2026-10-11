"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const stripe_1 = __importDefault(require("stripe"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const index_1 = require("../../config/index");
const License_1 = require("../../models/License");
const Payment_1 = require("../../models/Payment");
const User_1 = require("../../models/User");
const platformEvents_1 = require("../../services/platformEvents");
const PricingOffer_1 = require("../../models/PricingOffer");
const PricingPlan_1 = __importDefault(require("../../models/PricingPlan"));
const PromoCode_1 = __importDefault(require("../../models/PromoCode"));
const stripe = index_1.CONFIG.PAYMENTS.STRIPE_SECRET_KEY.trim() ? new stripe_1.default(index_1.CONFIG.PAYMENTS.STRIPE_SECRET_KEY.trim(), { apiVersion: '2025-01-27' }) : null;
const str = (v, n = 100) => typeof v === 'string' ? v.trim().slice(0, n) : '';
class PaymentController {
    static async createCheckoutSession(req, res) { const u = req.user; if (!u?.discordId)
        return res.status(401).json({ success: false, error: 'Identification requise.' }); const priceId = str(req.body?.priceId); const tier = str(req.body?.tier, 30) || 'premium'; const days = Number(req.body?.durationInDays); const promoCode = str(req.body?.promoCode, 64).toUpperCase(); if (!/^price_[A-Za-z0-9]+$/.test(priceId) || !['premium', 'lifetime', 'enterprise'].includes(tier) || !Number.isInteger(days) || days < 0 || days > 3650)
        return res.status(400).json({ success: false, error: 'Offre de paiement invalide.' }); try {
        if (!stripe)
            throw new Error('Stripe non configuré.');
        const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
        if (!price.active)
            throw new Error('Offre Stripe inactive.');
        const catalog = await PricingOffer_1.PricingOffer.findOne({ active: true, stripePriceId: priceId }).lean().catch(() => null) || await PricingPlan_1.default.findOne({ active: true, stripePriceId: priceId }).lean().catch(() => null);
        if (catalog && Number(catalog.durationDays) !== days)
            throw new Error('Durée d’offre invalide.');
        const origin = index_1.CONFIG.CLIENT_URL || index_1.CONFIG.DOMAIN;
        if (!origin)
            throw new Error('CLIENT_URL/DOMAIN non configuré.');
        let discounts = [];
        if (promoCode) {
            const promo = await PromoCode_1.default.findOne({ code: promoCode, isActive: true, expiresAt: { $gt: new Date() } }).lean();
            if (!promo)
                throw new Error('Code promo invalide ou expiré.');
            if (Number(promo.maxUses) > 0 && Number(promo.usesCount) >= Number(promo.maxUses))
                throw new Error('Ce code promo a atteint sa limite.');
            const couponData = { name: `OMNIX ${promo.code}`, duration: 'once', metadata: { promoCode: promo.code } };
            if (promo.discountType === 'percentage') {
                couponData.percent_off = Number(promo.discountValue);
            }
            else {
                couponData.amount_off = Math.min(Number(promo.discountValue) * 100, Number(price.unit_amount || 0));
                couponData.currency = String(price.currency || 'eur');
            }
            const coupon = await stripe.coupons.create(couponData);
            discounts = [{ coupon: coupon.id }];
        }
        const mode = price.type === 'recurring' ? 'subscription' : 'payment';
        const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price: priceId, quantity: 1 }], mode, discounts, metadata: { userId: u.discordId, tier, durationInDays: String(days), priceId, promoCode }, success_url: `${origin}/dashboard?payment=success`, cancel_url: `${origin}/dashboard?payment=cancel` });
        return res.json({ success: true, id: session.id, url: session.url });
    }
    catch (e) {
        console.error('[Stripe] Checkout:', e?.message || e);
        return res.status(400).json({ success: false, error: e?.message || 'Création de la session de paiement impossible.' });
    } }
    static async handleWebhook(req, res) {
        const sig = req.headers['stripe-signature'];
        if (!sig)
            return res.status(400).send('Signature Stripe manquante.');
        if (!stripe || !index_1.CONFIG.PAYMENTS.STRIPE_WEBHOOK_SECRET)
            return res.status(503).send('Webhook Stripe non configuré.');
        try {
            const raw = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : null);
            if (!raw)
                return res.status(400).send('Corps brut Stripe indisponible.');
            const event = stripe.webhooks.constructEvent(raw, sig, index_1.CONFIG.PAYMENTS.STRIPE_WEBHOOK_SECRET);
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                const buyer = str(session.metadata?.userId, 32);
                const tier = str(session.metadata?.tier, 30);
                const days = Number(session.metadata?.durationInDays ?? 30);
                const promoCode = str(session.metadata?.promoCode, 64).toUpperCase();
                if (!/^\d{17,20}$/.test(buyer) || !['premium', 'lifetime', 'enterprise'].includes(tier) || !Number.isInteger(days) || days < 0 || days > 3650)
                    return res.status(400).send('Métadonnées invalides.');
                const exists = await License_1.License.findOne({ $or: [{ stripeSessionId: session.id }, { stripeEventId: event.id }] });
                if (!exists) {
                    const a = node_crypto_1.default.randomBytes(8).toString('hex').toUpperCase(), b = node_crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
                    try {
                        await License_1.License.create({ key: `OMNIX-${a.slice(0, 4)}-${a.slice(4, 8)}-${b}`, tier, status: 'active', buyerId: buyer, durationInDays: days, expiresAt: days > 0 ? new Date(Date.now() + days * 86400000) : null, stripeSessionId: session.id, stripeEventId: event.id });
                    }
                    catch (e) {
                        if (e?.code !== 11000)
                            throw e;
                    }
                }
                const amount = Number(session.amount_total || 0);
                const currency = String(session.currency || 'eur');
                await Payment_1.Payment.findOneAndUpdate({ stripeSessionId: session.id }, { userId: buyer, stripeSessionId: session.id, stripeEventId: event.id, amount: amount / 100, currency, status: 'paid', tier, durationInDays: days }, { upsert: true, new: true, setDefaultsOnInsert: true });
                await User_1.User.updateOne({ discordId: buyer }, { $set: { isPremium: true } });
                if (promoCode)
                    await PromoCode_1.default.updateOne({ code: promoCode }, { $inc: { usesCount: 1 } }).catch(() => undefined);
                await (0, platformEvents_1.recordPlatformEvent)('payment', { userId: buyer, metadata: { amount: amount / 100, currency, tier, sessionId: session.id } });
                await (0, platformEvents_1.recordPlatformEvent)('subscription', { userId: buyer, metadata: { tier, durationInDays: days } });
            }
            return res.json({ received: true });
        }
        catch (e) {
            console.error('[Stripe] Webhook:', e?.message || e);
            return res.status(400).send('Signature Webhook invalide.');
        }
    }
}
exports.PaymentController = PaymentController;
