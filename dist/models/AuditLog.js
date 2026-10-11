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
exports.AuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/* =========================================================
   SCHEMA
========================================================= */
const AuditLogSchema = new mongoose_1.Schema({
    /*
     * ---------------------------------------------------
     * CREATED AT
     * ---------------------------------------------------
     */
    createdAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true,
        immutable: true,
    },
    /*
     * ---------------------------------------------------
     * ACTOR ID
     * ---------------------------------------------------
     */
    actorId: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 128,
    },
    /*
     * ---------------------------------------------------
     * ACTOR TAG
     * ---------------------------------------------------
     */
    actorTag: {
        type: String,
        default: null,
        trim: true,
        maxlength: 200,
    },
    /*
     * ---------------------------------------------------
     * IP ADDRESS
     * ---------------------------------------------------
     *
     * La valeur peut être IPv4, IPv6 ou une valeur
     * fournie par le reverse proxy.
     *
     * La validation stricte est volontairement laissée
     * aux middleware/routes afin de ne pas casser
     * Render ou d'autres reverse proxies.
     */
    ipAddress: {
        type: String,
        default: null,
        trim: true,
        maxlength: 128,
    },
    /*
     * ---------------------------------------------------
     * MODULE
     * ---------------------------------------------------
     *
     * Exemples :
     *
     * AUTH
     * ADMIN
     * GUILD
     * PREMIUM
     * PAYMENTS
     * DISCORD
     * SECURITY
     */
    module: {
        type: String,
        required: true,
        index: true,
        trim: true,
        maxlength: 100,
    },
    /*
     * ---------------------------------------------------
     * ACTION
     * ---------------------------------------------------
     *
     * Exemples :
     *
     * LOGIN
     * LOGOUT
     * GUILD_UPDATE
     * LICENSE_ACTIVATE
     * PAYMENT_SUCCESS
     */
    action: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150,
    },
    /*
     * ---------------------------------------------------
     * SEVERITY
     * ---------------------------------------------------
     */
    severity: {
        type: String,
        enum: [
            'INFO',
            'WARNING',
            'ERROR',
            'CRITICAL',
        ],
        default: 'INFO',
        required: true,
        index: true,
    },
    /*
     * ---------------------------------------------------
     * SERVER ID
     * ---------------------------------------------------
     *
     * null = action globale.
     */
    serverId: {
        type: String,
        default: null,
        index: true,
        trim: true,
        maxlength: 64,
    },
    /*
     * ---------------------------------------------------
     * STATUS
     * ---------------------------------------------------
     */
    status: {
        type: String,
        enum: [
            'SUCCESS',
            'FAILURE',
        ],
        required: true,
        index: true,
    },
    /*
     * ---------------------------------------------------
     * ERROR MESSAGE
     * ---------------------------------------------------
     */
    errorMessage: {
        type: String,
        default: null,
        trim: true,
        maxlength: 2000,
    },
    /*
     * ---------------------------------------------------
     * DETAILS
     * ---------------------------------------------------
     *
     * Flexible volontairement :
     *
     * {
     *   before: {...},
     *   after: {...},
     *   guildName: "...",
     *   route: "...",
     *   reason: "..."
     * }
     */
    details: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
}, {
    collection: 'audit_logs',
    /*
     * Les logs d'audit ne doivent pas recevoir
     * automatiquement __v.
     */
    versionKey: false,
    /*
     * On conserve les objets vides dans details.
     */
    minimize: false,
    /*
     * Pas de timestamps automatiques.
     *
     * createdAt est contrôlé explicitement.
     */
    timestamps: false,
});
/* =========================================================
   IMMUTABILITY
========================================================= */
/*
 * Un AuditLog ne doit pas être modifié après création.
 *
 * Cette règle est surtout à respecter dans les routes :
 *
 * AuditLog.create(...)
 *
 * plutôt que :
 *
 * AuditLog.findByIdAndUpdate(...)
 *
 * ou delete.
 *
 * Le schema marque déjà createdAt comme immutable.
 */
/* =========================================================
   INDEXES
========================================================= */
/*
 * ---------------------------------------------------------
 * DASHBOARD — LOGS RÉCENTS
 * ---------------------------------------------------------
 */
AuditLogSchema.index({
    createdAt: -1,
    severity: 1,
});
/*
 * ---------------------------------------------------------
 * AUDIT PAR UTILISATEUR
 * ---------------------------------------------------------
 */
AuditLogSchema.index({
    actorId: 1,
    createdAt: -1,
});
/*
 * ---------------------------------------------------------
 * AUDIT PAR SERVEUR
 * ---------------------------------------------------------
 */
AuditLogSchema.index({
    serverId: 1,
    createdAt: -1,
});
/*
 * ---------------------------------------------------------
 * RECHERCHE PAR MODULE / ACTION
 * ---------------------------------------------------------
 */
AuditLogSchema.index({
    module: 1,
    action: 1,
    createdAt: -1,
});
/*
 * ---------------------------------------------------------
 * FILTRE STATUS
 * ---------------------------------------------------------
 */
AuditLogSchema.index({
    status: 1,
    createdAt: -1,
});
/* =========================================================
   MODEL
========================================================= */
const AuditLog = mongoose_1.default.models.AuditLog ??
    mongoose_1.default.model('AuditLog', AuditLogSchema);
exports.AuditLog = AuditLog;
exports.default = AuditLog;
