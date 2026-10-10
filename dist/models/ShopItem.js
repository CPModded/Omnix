"use strict";
/**
 * ====================================================================
 * OMNIX — SHOP ITEM MODEL
 *
 * Articles de boutique isolés par serveur.
 *
 * IMPORTANT :
 * Un item appartient toujours à UNE guild.
 * ====================================================================
 */
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
exports.ShopItem = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const ShopItemSchema = new mongoose_1.Schema({
    /*
     * ---------------------------------------------------
     * GUILD ID
     * ---------------------------------------------------
     */
    guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * ---------------------------------------------------
     * ITEM ID
     * ---------------------------------------------------
     */
    itemId: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        minlength: 1,
        maxlength: 64,
        index: true,
    },
    /*
     * ---------------------------------------------------
     * NAME
     * ---------------------------------------------------
     */
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
    },
    /*
     * ---------------------------------------------------
     * PRICE
     * ---------------------------------------------------
     *
     * 1 coin minimum.
     */
    price: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator(value) {
                return Number.isFinite(value);
            },
            message: 'Le prix doit être un nombre valide.',
        },
    },
    /*
     * ---------------------------------------------------
     * ROLE
     * ---------------------------------------------------
     */
    roleId: {
        type: String,
        default: null,
        trim: true,
    },
    /*
     * ---------------------------------------------------
     * DESCRIPTION
     * ---------------------------------------------------
     */
    description: {
        type: String,
        default: 'Aucune description fournie.',
        trim: true,
        maxlength: 1000,
    },
}, {
    timestamps: true,
});
/* =========================================================
   VALIDATION
========================================================= */
/*
 * Un item doit toujours appartenir à une guild.
 */
ShopItemSchema.pre('validate', function (next) {
    if (!this.guildId ||
        !this.guildId.trim()) {
        return next(new Error('guildId est obligatoire pour un article de boutique.'));
    }
    if (!this.itemId ||
        !this.itemId.trim()) {
        return next(new Error('itemId est obligatoire.'));
    }
    return next();
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * CRITIQUE :
 *
 * Un même itemId peut exister sur plusieurs serveurs.
 *
 * Exemple :
 *
 * Guild A → SH-A3F1
 * Guild B → SH-A3F1
 *
 * Mais deux fois SH-A3F1 dans Guild A = impossible.
 */
ShopItemSchema.index({
    guildId: 1,
    itemId: 1,
}, {
    unique: true,
});
/*
 * Optimise l'affichage de la boutique
 * d'un serveur.
 */
ShopItemSchema.index({
    guildId: 1,
    createdAt: -1,
});
/* =========================================================
   MODEL
========================================================= */
exports.ShopItem = mongoose_1.default.models.ShopItem ||
    mongoose_1.default.model('ShopItem', ShopItemSchema);
exports.default = exports.ShopItem;
