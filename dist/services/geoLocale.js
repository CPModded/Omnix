"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectWebLocale = detectWebLocale;
const axios_1 = __importDefault(require("axios"));
const User_1 = require("../models/User");
const localization_1 = require("./localization");
const GEO_CACHE = new Map();
const GEO_CACHE_TTL = 10 * 60 * 1000;
function getClientIp(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || '';
    if (!ip)
        return null;
    return ip.replace(/^::ffff:/, '');
}
async function detectWebLocale(req, discordId) {
    const browser = String(req.headers?.['accept-language'] || '').split(',')[0].split(';')[0];
    let locale = (0, localization_1.normalizeLocale)(browser || 'fr');
    let country = null;
    let vpn = false;
    const ip = getClientIp(req);
    const cached = ip ? GEO_CACHE.get(ip) : undefined;
    if (cached && cached.expiresAt > Date.now()) {
        if (discordId) {
            await User_1.User.updateOne({ discordId }, { $set: { detectedLocale: cached.locale, detectedCountry: cached.country, vpnDetected: cached.vpn, localeDetectedAt: new Date() } }).catch(() => null);
        }
        return { locale: cached.locale, country: cached.country, vpn: cached.vpn };
    }
    try {
        if (ip && !['127.0.0.1', '::1'].includes(ip)) {
            const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
            const response = await axios_1.default.get(url, { timeout: 1800, validateStatus: s => s >= 200 && s < 300 });
            country = String(response.data?.country_code || '').toUpperCase() || null;
            locale = (0, localization_1.localeFromCountry)(country) || locale;
        }
    }
    catch { /* Browser locale remains the safe fallback. */ }
    // VPN/proxy detection is deliberately optional: IP geolocation alone cannot
    // reliably identify a VPN. Configure IPQUALITYSCORE_API_KEY to enable it.
    const key = process.env.IPQUALITYSCORE_API_KEY;
    if (key && ip && !['127.0.0.1', '::1'].includes(ip)) {
        try {
            const r = await axios_1.default.get(`https://ipqualityscore.com/api/json/ip/${key}/${encodeURIComponent(ip)}`, { timeout: 1800 });
            vpn = Boolean(r.data?.vpn || r.data?.proxy || r.data?.tor || r.data?.active_vpn);
        }
        catch { /* keep false when provider unavailable */ }
    }
    if (ip && !['127.0.0.1', '::1'].includes(ip)) {
        GEO_CACHE.set(ip, { expiresAt: Date.now() + GEO_CACHE_TTL, locale, country, vpn });
    }
    if (discordId) {
        await User_1.User.updateOne({ discordId }, { $set: { detectedLocale: locale, detectedCountry: country, vpnDetected: vpn, localeDetectedAt: new Date() } }).catch(() => null);
    }
    return { locale, country, vpn };
}
