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
exports.Partner = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PartnerSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    discordUrl: { type: String, required: true, trim: true, maxlength: 500 },
    // Legacy URL kept only for backward compatibility with old partner records.
    imageUrl: { type: String, default: '', trim: true, maxlength: 2000 },
    imageData: { type: String, default: '', trim: true, maxlength: 1550000 },
    featured: { type: Boolean, default: false, index: true },
    founderName: { type: String, default: '', trim: true, maxlength: 120 },
    founderDiscordId: { type: String, default: '', trim: true, maxlength: 30 },
    founderRole: { type: String, default: 'Founder', trim: true, maxlength: 120 },
    founderNote: { type: String, default: '', trim: true, maxlength: 500 },
    adEnabled: { type: Boolean, default: false, index: true },
    adTitle: { type: String, default: '', trim: true, maxlength: 160 },
    adText: { type: String, default: '', trim: true, maxlength: 1000 },
    // Legacy URL kept only for backward compatibility with old partner ads.
    adImageUrl: { type: String, default: '', trim: true, maxlength: 2000 },
    adImageData: { type: String, default: '', trim: true, maxlength: 1550000 },
    adUrl: { type: String, default: '', trim: true, maxlength: 2000 },
    adButtonText: { type: String, default: 'Découvrir', trim: true, maxlength: 80 },
    adExpiresAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });
PartnerSchema.index({ featured: -1, createdAt: -1 });
exports.Partner = mongoose_1.default.models.Partner || mongoose_1.default.model('Partner', PartnerSchema);
exports.default = exports.Partner;
