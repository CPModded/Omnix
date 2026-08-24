import mongoose, { Document, Schema } from "mongoose";

export interface IPricingOffer extends Document {
  name: string;
  slug: string;

  type: "premium";

  duration: string;
  durationDays: number;

  price: number;
  currency: string;

  stripeUrl: string;
  stripePriceId?: string | null;

  buttonText: string;
  description: string;

  featured: boolean;
  active: boolean;

  sortOrder: number;

  createdAt: Date;
  updatedAt: Date;
}

const PricingOfferSchema = new Schema<IPricingOffer>(
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
      unique: true,
      trim: true,
      lowercase: true
    },

    type: {
      type: String,
      enum: ["premium"],
      default: "premium",
      required: true
    },

    duration: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },

    durationDays: {
      type: Number,
      required: true,
      min: 1
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    currency: {
      type: String,
      default: "EUR",
      uppercase: true,
      trim: true,
      maxlength: 3
    },

    stripeUrl: { type: String, required: true, trim: true },
    stripePriceId: { type: String, default: null, trim: true, match: /^price_[A-Za-z0-9]+$/ },

    buttonText: {
      type: String,
      default: "S'abonner",
      trim: true,
      maxlength: 50
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300
    },

    featured: {
      type: Boolean,
      default: false
    },

    active: {
      type: Boolean,
      default: true
    },

    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const PricingOffer =
  mongoose.models.PricingOffer ||
  mongoose.model<IPricingOffer>(
    "PricingOffer",
    PricingOfferSchema
  );

export default PricingOffer;