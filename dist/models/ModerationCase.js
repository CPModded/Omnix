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
exports.ModerationCase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const ModerationCaseSchema = new mongoose_1.Schema({
    guildId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    caseId: {
        type: Number,
        required: true,
        min: 1,
    },
    type: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    caseNumber: { type: Number, required: true, min: 1, index: true },
    action: { type: String, required: true, index: true, trim: true },
    userId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    moderatorId: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    reason: {
        type: String,
        default: 'Aucune raison fournie',
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    active: {
        type: Boolean,
        default: true,
        index: true,
    },
    duration: {
        type: Number,
        default: null,
        min: 0,
    },
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
}, {
    collection: 'moderation_cases',
    /*
     * createdAt est géré explicitement
     * car le modèle possède déjà son propre champ.
     */
    timestamps: false,
    versionKey: false,
});
/* =========================================================
   INDEXES
========================================================= */
/*
 * CRITIQUE :
 *
 * Un caseId doit être unique PAR SERVEUR,
 * pas globalement.
 *
 * Exemple :
 *
 * Guild A → Case #1
 * Guild B → Case #1
 *
 * sont parfaitement valides.
 */
ModerationCaseSchema.index({
    guildId: 1,
    caseId: 1,
}, {
    unique: true,
});
/*
 * Recherche rapide des sanctions
 * d'un membre sur un serveur.
 */
ModerationCaseSchema.index({
    guildId: 1,
    userId: 1,
    createdAt: -1,
});
/*
 * Historique de modération d'un serveur.
 */
ModerationCaseSchema.index({
    guildId: 1,
    createdAt: -1,
});
/*
 * Recherche des sanctions actives
 * pouvant nécessiter une expiration automatique.
 */
ModerationCaseSchema.index({
    guildId: 1,
    active: 1,
    expiresAt: 1,
});
/* =========================================================
   MODEL
========================================================= */
const ModerationCase = mongoose_1.default.models.ModerationCase ??
    mongoose_1.default.model('ModerationCase', ModerationCaseSchema);
exports.ModerationCase = ModerationCase;
exports.default = ModerationCase;
