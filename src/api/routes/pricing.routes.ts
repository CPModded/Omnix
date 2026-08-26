import express from "express";
import PricingOffer from "../../models/PricingOffer";
import PricingPlan from "../../models/PricingPlan";
import PromoCode from "../../models/PromoCode";
import { isAuthenticated } from "../middlewares/auth";
import { adminCheck } from "../middlewares/adminCheck";
const adminOnly = [isAuthenticated as any, adminCheck as any];

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidStripeUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "buy.stripe.com" ||
        url.hostname.endsWith(".stripe.com")
      )
    );
  } catch {
    return false;
  }
}

/* =========================================================
   PUBLIC
   GET /api/pricing/offers
========================================================= */

router.get("/offers", async (_req, res) => {
  try {
    let offers = await PricingOffer.find({active:true}).sort({sortOrder:1,price:1}).lean();
    if (!offers.length) {
      const plans = await PricingPlan.find({active:true}).sort({sortOrder:1,price:1}).lean();
      offers = plans.map((p:any)=>({ _id:String(p._id), name:p.name, slug:p.slug, type:'premium', duration:p.durationLabel||`${p.durationDays} jours`, durationDays:p.durationDays, price:p.price, currency:p.currency||'EUR', stripeUrl:p.stripeUrl||'', stripePriceId:p.stripePriceId||null, buttonText:'Choisir cette offre', description:p.description||'', featured:Boolean(p.featured), active:Boolean(p.active), sortOrder:p.sortOrder||0, features:p.features||[] }));
    }
    return res.json({success:true,offers});
  } catch (error) {
    console.error(
      "[OMNIX] GET pricing offers:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Impossible de charger les offres."
    });
  }
});

/* =========================================================
   PUBLIC PROMO VALIDATION
========================================================= */
router.post('/validate-promo', async (req,res)=>{
  try{const code=String(req.body?.code||'').trim().toUpperCase(); const offerId=String(req.body?.offerId||''); const offer=offerId?await PricingOffer.findOne({_id:offerId,active:true}).lean():null; const promo=await PromoCode.findOne({code,isActive:true,expiresAt:{$gt:new Date()}}).lean(); if(!promo)return res.status(404).json({success:false,error:'Code promo invalide ou expiré.'}); if(Number(promo.maxUses)>0&&Number(promo.usesCount)>=Number(promo.maxUses))return res.status(400).json({success:false,error:'Ce code promo a atteint sa limite.'}); const base=Number(offer?.price||0); const discount=promo.discountType==='percentage'?base*(Number(promo.discountValue)/100):Number(promo.discountValue); return res.json({success:true,code:promo.code,discount:Math.min(base,Math.max(0,discount)),finalPrice:Math.max(0,base-Math.max(0,discount)),discountType:promo.discountType,discountValue:promo.discountValue});}catch(e){return res.status(500).json({success:false,error:'Impossible de vérifier le code promo.'});}
});

/* =========================================================
   ADMIN
   GET /api/admin/pricing/offers
========================================================= */

router.get("/admin/offers", ...adminOnly, async (_req, res) => {
  try {
    const offers = await PricingOffer.find()
      .sort({
        sortOrder: 1,
        createdAt: 1
      })
      .lean();

    return res.json({
      success: true,
      offers
    });
  } catch (error) {
    console.error(
      "[OMNIX] GET admin pricing offers:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Impossible de charger les offres."
    });
  }
});

/* =========================================================
   ADMIN
   POST /api/admin/pricing/offers
========================================================= */

router.post("/admin/offers", ...adminOnly, async (req, res) => {
  try {
    const {
      name,
      duration,
      durationDays,
      price,
      currency,
      stripeUrl,
      buttonText,
      description,
      featured,
      active,
      sortOrder
    } = req.body;

    if (!name || !duration) {
      return res.status(400).json({
        success: false,
        error: "Le nom et la durée sont obligatoires."
      });
    }

    if (
      !Number.isFinite(Number(durationDays)) ||
      Number(durationDays) <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "La durée en jours est invalide."
      });
    }

    if (
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Le prix est invalide."
      });
    }

    if (
      typeof stripeUrl !== "string" ||
      !isValidStripeUrl(stripeUrl)
    ) {
      return res.status(400).json({
        success: false,
        error: "Le lien Stripe est invalide."
      });
    }

    let slug = createSlug(name);

    if (!slug) {
      slug = `offer-${Date.now()}`;
    }

    const existing = await PricingOffer.findOne({
      slug
    });

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    /*
     * Une seule offre mise en avant.
     */
    if (Boolean(featured)) {
      await PricingOffer.updateMany(
        {},
        {
          $set: {
            featured: false
          }
        }
      );
    }

    const offer = await PricingOffer.create({
      name: String(name).trim(),
      slug,

      type: "premium",

      duration: String(duration).trim(),
      durationDays: Number(durationDays),

      price: Number(price),
      currency:
        String(currency || "EUR")
          .trim()
          .toUpperCase(),

      stripeUrl: String(stripeUrl).trim(),

      buttonText:
        String(buttonText || "S'abonner").trim(),

      description:
        String(description || "").trim(),

      featured: Boolean(featured),
      active:
        active === undefined
          ? true
          : Boolean(active),

      sortOrder:
        Number.isFinite(Number(sortOrder))
          ? Number(sortOrder)
          : 0
    });

    return res.status(201).json({
      success: true,
      offer
    });
  } catch (error) {
    console.error(
      "[OMNIX] POST pricing offer:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Impossible de créer l'offre."
    });
  }
});

/* =========================================================
   ADMIN
   PUT /api/admin/pricing/offers/:id
========================================================= */

router.put("/admin/offers/:id", ...adminOnly, async (req, res) => {
  try {
    const offer =
      await PricingOffer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: "Offre introuvable."
      });
    }

    const {
      name,
      duration,
      durationDays,
      price,
      currency,
      stripeUrl,
      buttonText,
      description,
      featured,
      active,
      sortOrder
    } = req.body;

    if (name !== undefined) {
      offer.name = String(name).trim();
    }

    if (duration !== undefined) {
      offer.duration = String(duration).trim();
    }

    if (durationDays !== undefined) {
      if (
        !Number.isFinite(Number(durationDays)) ||
        Number(durationDays) <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: "La durée est invalide."
        });
      }

      offer.durationDays = Number(durationDays);
    }

    if (price !== undefined) {
      if (
        !Number.isFinite(Number(price)) ||
        Number(price) < 0
      ) {
        return res.status(400).json({
          success: false,
          error: "Le prix est invalide."
        });
      }

      offer.price = Number(price);
    }

    if (currency !== undefined) {
      offer.currency =
        String(currency)
          .trim()
          .toUpperCase();
    }

    if (stripeUrl !== undefined) {
      if (
        typeof stripeUrl !== "string" ||
        !isValidStripeUrl(stripeUrl)
      ) {
        return res.status(400).json({
          success: false,
          error: "Le lien Stripe est invalide."
        });
      }

      offer.stripeUrl =
        String(stripeUrl).trim();
    }

    if (buttonText !== undefined) {
      offer.buttonText =
        String(buttonText).trim();
    }

    if (description !== undefined) {
      offer.description =
        String(description).trim();
    }

    if (active !== undefined) {
      offer.active = Boolean(active);
    }

    if (sortOrder !== undefined) {
      offer.sortOrder =
        Number.isFinite(Number(sortOrder))
          ? Number(sortOrder)
          : offer.sortOrder;
    }

    if (featured !== undefined) {
      offer.featured = Boolean(featured);

      if (offer.featured) {
        await PricingOffer.updateMany(
          {
            _id: {
              $ne: offer._id
            }
          },
          {
            $set: {
              featured: false
            }
          }
        );
      }
    }

    await offer.save();

    return res.json({
      success: true,
      offer
    });
  } catch (error) {
    console.error(
      "[OMNIX] PUT pricing offer:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Impossible de modifier l'offre."
    });
  }
});

/* =========================================================
   ADMIN
   DELETE /api/admin/pricing/offers/:id
========================================================= */

router.delete(
  "/admin/offers/:id",
  ...adminOnly,
  async (req, res) => {
    try {
      const offer =
        await PricingOffer.findById(
          req.params.id
        );

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: "Offre introuvable."
        });
      }

      await offer.deleteOne();

      return res.json({
        success: true,
        message: "Offre supprimée."
      });
    } catch (error) {
      console.error(
        "[OMNIX] DELETE pricing offer:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Impossible de supprimer l'offre."
      });
    }
  }
);

export default router;