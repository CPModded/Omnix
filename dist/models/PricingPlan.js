"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   FEATURE SCHEMA
========================================================= */
const PricingFeatureSchema = new mongoose_1.Schema({
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
}, {
    _id: false
});
/* =========================================================
   PRICING PLAN SCHEMA
========================================================= */
const PricingPlanSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    versionKey: false
});
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
PricingPlanSchema.pre("validate", function (next) {
    if (this.name && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
    next();
});
/* =========================================================
   MODEL
========================================================= */
const PricingPlan = mongoose_1.default.models.PricingPlan ||
    mongoose_1.default.model("PricingPlan", PricingPlanSchema);
exports.default = PricingPlan;
