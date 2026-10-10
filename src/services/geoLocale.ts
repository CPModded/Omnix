import axios from 'axios';
import { User } from '../models/User';
import { localeFromCountry, normalizeLocale } from './localization';

const GEO_CACHE = new Map<string, { expiresAt: number; locale: string; country: string | null; vpn: boolean }>();
const GEO_CACHE_TTL = 10 * 60 * 1000;

function getClientIp(req: any): string | null {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || '';
  if (!ip) return null;
  return ip.replace(/^::ffff:/, '');
}

export async function detectWebLocale(req: any, discordId?: string): Promise<{ locale: string; country: string | null; vpn: boolean }> {
  const browser = String(req.headers?.['accept-language'] || '').split(',')[0].split(';')[0];
  let locale = normalizeLocale(browser || 'fr');
  let country: string | null = null;
  let vpn = false;
  const ip = getClientIp(req);
  const cached = ip ? GEO_CACHE.get(ip) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    if (discordId) {
      await User.updateOne({ discordId }, { $set: { detectedLocale: cached.locale, detectedCountry: cached.country, vpnDetected: cached.vpn, localeDetectedAt: new Date() } }).catch(() => null);
    }
    return { locale: cached.locale, country: cached.country, vpn: cached.vpn };
  }
  try {
    if (ip && !['127.0.0.1','::1'].includes(ip)) {
      const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
      const response = await axios.get(url, { timeout: 1800, validateStatus: s => s >= 200 && s < 300 });
      country = String(response.data?.country_code || '').toUpperCase() || null;
      locale = localeFromCountry(country) || locale;
    }
  } catch { /* Browser locale remains the safe fallback. */ }

  // VPN/proxy detection is deliberately optional: IP geolocation alone cannot
  // reliably identify a VPN. Configure IPQUALITYSCORE_API_KEY to enable it.
  const key = process.env.IPQUALITYSCORE_API_KEY;
  if (key && ip && !['127.0.0.1','::1'].includes(ip)) {
    try {
      const r = await axios.get(`https://ipqualityscore.com/api/json/ip/${key}/${encodeURIComponent(ip)}`, { timeout: 1800 });
      vpn = Boolean(r.data?.vpn || r.data?.proxy || r.data?.tor || r.data?.active_vpn);
    } catch { /* keep false when provider unavailable */ }
  }

  if (ip && !['127.0.0.1','::1'].includes(ip)) {
    GEO_CACHE.set(ip, { expiresAt: Date.now() + GEO_CACHE_TTL, locale, country, vpn });
  }
  if (discordId) {
    await User.updateOne({ discordId }, { $set: { detectedLocale: locale, detectedCountry: country, vpnDetected: vpn, localeDetectedAt: new Date() } }).catch(() => null);
  }
  return { locale, country, vpn };
}
