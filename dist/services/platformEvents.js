"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPlatformEvent = recordPlatformEvent;
const PlatformEvent_1 = __importDefault(require("../models/PlatformEvent"));
async function recordPlatformEvent(type, data = {}) {
    try {
        await PlatformEvent_1.default.create({ type, ...data });
    }
    catch (error) {
        console.error('[PlatformEvent] unable to record event:', error);
    }
}
