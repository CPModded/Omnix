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
exports.PromoCode = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const PromoCodeSchema = new mongoose_1.Schema({
    /*
     * ---------------------------------------------------
     * CODE
     * ---------------------------------------------------
     */
    code: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        trim: true,
        minlength: 3,
        maxlength: 64,
    },
    /*
     * ---------------------------------------------------
     * DISCOUNT TYPE
     * ---------------------------------------------------
     */
    discountType: {
        type: String,
        enum: [
            'percentage',
            'fixed',
        ],
        required: true,
    },
    /*
     * ---------------------------------------------------
     * DISCOUNT VALUE
     * ---------------------------------------------------
     */
    discountValue: {
        type: Number,
        required: true,
        min: 0,
    },
    /*
     * ---------------------------------------------------
     * MAX USES
     * ---------------------------------------------------
     *
     * 0 = unlimited
     */
    maxUses: {
        type: Number,
        default: 0,
        min: 0,
    },
    /*
     * ---------------------------------------------------
     * CURRENT USES
     * ---------------------------------------------------
     */
    usesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    /*
     * ---------------------------------------------------
     * EXPIRATION
     * ---------------------------------------------------
     */
    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },
    /*
     * ---------------------------------------------------
     * ACTIVE
     * ---------------------------------------------------
     */
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
/* =========================================================
   VALIDATION
========================================================= */
/*
 * Un pourcentage ne peut pas dépasser 100%.
 */
PromoCodeSchema.pre('validate', function (next) {
    if (this.discountType ===
        'percentage' &&
        this.discountValue > 100) {
        return next(new Error('Une remise en pourcentage ne peut pas dépasser 100%.'));
    }
    /*
     * Le nombre d'utilisations ne peut pas
     * dépasser la limite configurée.
     *
     * 0 = illimité.
     */
    if (this.maxUses > 0 &&
        this.usesCount >
            this.maxUses) {
        return next(new Error('Le nombre d’utilisations dépasse la limite du code promotionnel.'));
    }
    return next();
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * Recherche rapide des codes actifs
 * arrivant à expiration.
 */
PromoCodeSchema.index({
    isActive: 1,
    expiresAt: 1,
});
/* =========================================================
   MODEL
========================================================= */
exports.PromoCode = mongoose_1.default.models.PromoCode ||
    mongoose_1.default.model('PromoCode', PromoCodeSchema);
exports.default = exports.PromoCode;
