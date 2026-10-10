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
exports.License = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const LicenseSchema = new mongoose_1.Schema({
    /*
     * ---------------------------------------------------
     * LICENSE KEY
     * ---------------------------------------------------
     */
    key: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        uppercase: true,
    },
    /*
     * ---------------------------------------------------
     * TIER
     * ---------------------------------------------------
     */
    tier: {
        type: String,
        enum: [
            'premium',
            'lifetime',
            'enterprise',
        ],
        required: true,
        index: true,
    },
    /*
     * ---------------------------------------------------
     * STATUS
     * ---------------------------------------------------
     */
    status: {
        type: String,
        enum: [
            'active',
            'used',
            'suspended',
            'expired',
        ],
        default: 'active',
        index: true,
    },
    /*
     * ---------------------------------------------------
     * BUYER
     * ---------------------------------------------------
     */
    buyerId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    stripeSessionId: { type: String, default: null, index: true, sparse: true },
    stripeEventId: { type: String, default: null, index: true, sparse: true },
    /*
     * ---------------------------------------------------
     * ACTIVATED GUILD
     * ---------------------------------------------------
     */
    activatedGuildId: {
        type: String,
        default: null,
        index: true,
        trim: true,
    },
    activatedGuildIds: { type: [String], default: [] },
    maxGuilds: { type: Number, default: 10, min: 1, max: 100 },
    /*
     * ---------------------------------------------------
     * ACTIVATED AT
     * ---------------------------------------------------
     */
    activatedAt: {
        type: Date,
        default: null,
    },
    /*
     * ---------------------------------------------------
     * EXPIRATION
     * ---------------------------------------------------
     */
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
    /*
     * ---------------------------------------------------
     * DURATION
     * ---------------------------------------------------
     *
     * 0 = Lifetime
     */
    durationInDays: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
}, {
    timestamps: true,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * Recherche rapide des licences d'un utilisateur.
 */
LicenseSchema.index({
    buyerId: 1,
    status: 1,
});
/*
 * Recherche rapide des licences d'un serveur.
 */
LicenseSchema.index({
    activatedGuildId: 1,
    status: 1,
});
/*
 * Recherche des licences arrivant à expiration.
 */
LicenseSchema.index({
    expiresAt: 1,
    status: 1,
});
/* =========================================================
   MODEL
========================================================= */
exports.License = mongoose_1.default.models.License ||
    mongoose_1.default.model('License', LicenseSchema);
exports.default = exports.License;
