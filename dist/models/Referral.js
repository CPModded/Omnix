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
exports.Referral = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ReferralSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    referrerId: { type: String, required: true, index: true },
    referredId: { type: String, default: null, index: true, sparse: true },
    status: { type: String, enum: ['pending', 'validated', 'rejected'], default: 'pending', index: true },
    source: { type: String, default: 'web' },
    rewardDays: { type: Number, default: 7, min: 1, max: 365 },
    rewardGranted: { type: Boolean, default: false, index: true },
    joinedAt: { type: Date, default: null },
    validatedAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
}, { timestamps: true });
ReferralSchema.index({ referrerId: 1, referredId: 1 }, { unique: true, sparse: true });
const Referral = mongoose_1.default.models.Referral || mongoose_1.default.model('Referral', ReferralSchema);
exports.Referral = Referral;
exports.default = Referral;
