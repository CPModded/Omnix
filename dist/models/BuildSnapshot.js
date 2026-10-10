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
const ChannelSchema = new mongoose_1.Schema({
    sourceId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: Number, required: true },
    parentSourceId: { type: String, default: null },
    position: { type: Number, default: 0 },
    topic: { type: String, default: null },
    nsfw: { type: Boolean, default: false },
    rateLimitPerUser: { type: Number, default: 0 },
    bitrate: { type: Number },
    userLimit: { type: Number },
    permissionOverwrites: [{
            id: String,
            allow: String,
            deny: String,
        }],
}, { _id: false });
const RoleSchema = new mongoose_1.Schema({
    sourceId: String,
    name: String,
    color: Number,
    hoist: Boolean,
    mentionable: Boolean,
    position: Number,
    managed: Boolean,
}, { _id: false });
const BuildSnapshotSchema = new mongoose_1.Schema({
    ownerId: { type: String, required: true, index: true },
    sourceGuildId: { type: String, required: true },
    sourceGuildName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
    includeStaff: { type: Boolean, default: false },
    roles: { type: [RoleSchema], default: [] },
    channels: { type: [ChannelSchema], default: [] },
});
exports.default = mongoose_1.default.models.BuildSnapshot || mongoose_1.default.model('BuildSnapshot', BuildSnapshotSchema);
