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
exports.Economy = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const EconomySchema = new mongoose_1.Schema({
    /*
     * Discord Guild ID
     *
     * IMPORTANT :
     * toutes les données économiques sont isolées
     * par serveur.
     */
    guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Discord User ID
     */
    userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    /*
     * Argent disponible immédiatement.
     */
    wallet: {
        type: Number,
        default: 100,
        min: 0,
    },
    /*
     * Argent placé en banque.
     */
    bank: {
        type: Number,
        default: 0,
        min: 0,
    },
    /*
     * Dernière utilisation de /work.
     */
    lastWork: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    /*
     * Collection explicite afin de garder
     * une structure MongoDB stable.
     */
    collection: 'economy',
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * UN compte économique par utilisateur
 * et par serveur.
 *
 * Guild A + User X
 * Guild B + User X
 *
 * = deux comptes totalement indépendants.
 */
EconomySchema.index({
    guildId: 1,
    userId: 1,
}, {
    unique: true,
});
/*
 * Optimise les recherches des membres
 * d'un serveur.
 */
EconomySchema.index({
    guildId: 1,
    wallet: -1,
});
/*
 * Optimise les recherches liées
 * aux cooldowns / /work.
 */
EconomySchema.index({
    guildId: 1,
    lastWork: 1,
});
/* =========================================================
   MODEL
========================================================= */
/*
 * Évite :
 *
 * OverwriteModelError:
 * Cannot overwrite `Economy` model once compiled.
 *
 * Important avec tsx / hot reload / Render.
 */
const Economy = mongoose_1.default.models.Economy ??
    mongoose_1.default.model('Economy', EconomySchema);
exports.Economy = Economy;
exports.default = Economy;
