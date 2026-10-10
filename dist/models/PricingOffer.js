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
exports.PricingOffer = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PricingOfferSchema = new mongoose_1.Schema({
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
    },
    premiumServerLimit: { type: Number, default: 10, min: 1, max: 100 }
}, {
    timestamps: true
});
exports.PricingOffer = mongoose_1.default.models.PricingOffer ||
    mongoose_1.default.model("PricingOffer", PricingOfferSchema);
exports.default = exports.PricingOffer;
