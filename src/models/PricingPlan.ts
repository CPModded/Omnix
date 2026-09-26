import mongoose, {
  Document,
  Model,
  Schema
} from "mongoose";
/* =========================================================
   TYPES
========================================================= */
export interface IPricingFeature {
  name: string;
  description?: string;
  enabled: boolean;
}
export interface IPricingPlan extends Document {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  durationLabel: string;
  stripeUrl?: string;
  stripePriceId?: string;
  stripeProductId?: string;
  badge?: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  features: IPricingFeature[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
/* =========================================================
   FEATURE SCHEMA
========================================================= */
const PricingFeatureSchema =
  new Schema<IPricingFeature>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
      },
      description: {
        type: String,
        trim: true,
        maxlength: 500
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    {
      _id: false
    }
  );
/* =========================================================
   PRICING PLAN SCHEMA
========================================================= */
const PricingPlanSchema =
  new Schema<IPricingPlan>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true,
        maxlength: 100
      },
      description: {
        type: String,
        trim: true,
        maxlength: 1000
      },
      /* -------------------------------------------------------
         PRIX
      ------------------------------------------------------- */
      price: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        default: "EUR",
        trim: true,
        uppercase: true,
        maxlength: 10
      },
      /* -------------------------------------------------------
         DURÉE
      ------------------------------------------------------- */
      durationDays: {
        type: Number,
        required: true,
        min: 1
      },
      durationLabel: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      /* -------------------------------------------------------
         STRIPE
      ------------------------------------------------------- */
      stripeUrl: {
        type: String,
        trim: true,
        maxlength: 1000
      },
      stripePriceId: {
        type: String,
        trim: true,
        maxlength: 255
      },
      stripeProductId: {
        type: String,
        trim: true,
        maxlength: 255
      },
      /* -------------------------------------------------------
         AFFICHAGE
      ------------------------------------------------------- */
      badge: {
        type: String,
        trim: true,
        maxlength: 50
      },
      featured: {
        type: Boolean,
        default: false,
        index: true
      },
      active: {
        type: Boolean,
        default: true,
        index: true
      },
      sortOrder: {
        type: Number,
        default: 0,
        index: true
      },
      /* -------------------------------------------------------
         FONCTIONNALITÉS
      ------------------------------------------------------- */
      features: {
        type: [PricingFeatureSchema],
        default: []
      },
      /* -------------------------------------------------------
         MÉTADONNÉES
      ------------------------------------------------------- */
      metadata: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    {
      timestamps: true,
      versionKey: false
    }
  );
/* =========================================================
   INDEX
========================================================= */
PricingPlanSchema.index({
  active: 1,
  sortOrder: 1
});
PricingPlanSchema.index({
  featured: 1,
  active: 1
});
/* =========================================================
   NORMALISATION DU SLUG
========================================================= */
PricingPlanSchema.pre(
  "validate",
  function (next) {
    if (this.name && !this.slug) {
      this.slug = this.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    next();
  }
);
/* =========================================================
   MODEL
========================================================= */
const PricingPlan: Model<IPricingPlan> =
  mongoose.models.PricingPlan ||
  mongoose.model<IPricingPlan>(
    "PricingPlan",
    PricingPlanSchema
  );
export default PricingPlan;