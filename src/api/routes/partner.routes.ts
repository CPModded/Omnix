import express, { Request, Response } from 'express';
import Partner from '../../models/Partner';
import { isAuthenticated } from '../middlewares/auth';
import { isOwner } from './auth.routes';
import User from '../../models/User';

const router = express.Router();

function isAdmin(req: Request): boolean {
  const u: any = (req as any).user;
  if (!u) return false;
  if (u.discordId && isOwner(String(u.discordId))) return true;
  return Boolean(u.isAdmin) || ['support','moderator','admin','super_admin','owner'].includes(String(u.role || ''));
}

function cleanUrl(value: unknown): string {
  const v = String(value || '').trim();
  return /^https?:\/\//i.test(v) ? v.slice(0, 2000) : '';
}

const MAX_IMAGE_DATA_LENGTH = 2000000;
const IMAGE_DATA_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function cleanImageData(value: unknown): string {
  const v = String(value || '').trim();
  if (!v || v.length > MAX_IMAGE_DATA_LENGTH) return '';
  return IMAGE_DATA_RE.test(v) ? v : '';
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const partners = await Partner.find().sort({ featured: -1, createdAt: -1 }).lean();
    return res.json({ success: true, data: partners });
  } catch (e) {
    console.error('[Partners] GET', e);
    return res.status(500).json({ success: false, error: 'Impossible de charger les partenaires.' });
  }
});


router.get('/:id/pub', async (req: Request, res: Response) => {
  try {
    const partner = await Partner.findById(req.params.id).lean();
    if (!partner || !partner.adEnabled) return res.status(404).json({ success:false, error:'Publicité partenaire indisponible.' });
    if (partner.adExpiresAt && new Date(partner.adExpiresAt).getTime() <= Date.now()) return res.status(410).json({ success:false, error:'Cette publicité a expiré.' });
    return res.json({ success:true, data:partner });
  } catch (e) {
    return res.status(500).json({ success:false, error:'Impossible de charger la publicité.' });
  }
});

router.get('/admin', isAuthenticated as any, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès administrateur refusé.' });
  const data = await Partner.find().sort({ featured: -1, createdAt: -1 }).lean();
  return res.json({ success: true, data });
});

router.post('/admin', isAuthenticated as any, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès administrateur refusé.' });
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const discordUrl = String(req.body?.discordUrl || '').trim();
    const imageData = cleanImageData(req.body?.imageData);
    const featured = Boolean(req.body?.featured);
    const founderName = String(req.body?.founderName || '').trim().slice(0,120);
    const founderDiscordId = String(req.body?.founderDiscordId || '').trim().slice(0,30);
    const founderRole = String(req.body?.founderRole || 'Founder').trim().slice(0,120);
    const founderNote = String(req.body?.founderNote || '').trim().slice(0,500);
    const adEnabled = Boolean(req.body?.adEnabled);
    const adTitle = String(req.body?.adTitle || '').trim().slice(0,160);
    const adText = String(req.body?.adText || '').trim().slice(0,1000);
    const adImageData = cleanImageData(req.body?.adImageData);
    const adUrl = cleanUrl(req.body?.adUrl);
    const adButtonText = String(req.body?.adButtonText || 'Découvrir').trim().slice(0,80);
    const adExpiresAt = req.body?.adExpiresAt ? new Date(String(req.body.adExpiresAt)) : null;
    if (!title || !description || !discordUrl || !imageData) return res.status(400).json({ success:false, error:'Titre, description, lien Discord et image depuis l’appareil sont obligatoires.' });
    if (!/^https?:\/\//i.test(discordUrl)) return res.status(400).json({ success:false, error:'Lien Discord invalide.' });
    if (adEnabled && (!adTitle || !adText || !adUrl)) return res.status(400).json({ success:false, error:'Titre, texte et lien sont obligatoires pour une publicité active.' });
    if (adExpiresAt && Number.isNaN(adExpiresAt.getTime())) return res.status(400).json({ success:false, error:'Date d’expiration de publicité invalide.' });
    if (featured) await Partner.updateMany({}, { $set: { featured: false } });
    const partner = await Partner.create({ title, description, discordUrl, imageData, featured, founderName, founderDiscordId, founderRole, founderNote, adEnabled, adTitle, adText, adImageData, adUrl, adButtonText, adExpiresAt });
    return res.status(201).json({ success:true, data:partner });
  } catch (e) {
    console.error('[Partners] POST', e);
    return res.status(500).json({ success:false, error:'Impossible de créer le partenaire.' });
  }
});

router.patch('/admin/:id', isAuthenticated as any, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès administrateur refusé.' });
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success:false, error:'Partenaire introuvable.' });
    if (typeof req.body?.title === 'string') partner.title = req.body.title.trim().slice(0,120);
    if (typeof req.body?.description === 'string') partner.description = req.body.description.trim().slice(0,1000);
    if (typeof req.body?.discordUrl === 'string') partner.discordUrl = req.body.discordUrl.trim().slice(0,500);
    if (req.body?.imageData !== undefined) {
      const imageData = cleanImageData(req.body.imageData);
      if (!imageData) return res.status(400).json({success:false,error:'Image principale invalide ou trop volumineuse.'});
      partner.imageData = imageData;
    }
    if (typeof req.body?.founderName === 'string') partner.founderName = req.body.founderName.trim().slice(0,120);
    if (typeof req.body?.founderDiscordId === 'string') partner.founderDiscordId = req.body.founderDiscordId.trim().slice(0,30);
    if (typeof req.body?.founderRole === 'string') partner.founderRole = req.body.founderRole.trim().slice(0,120);
    if (typeof req.body?.founderNote === 'string') partner.founderNote = req.body.founderNote.trim().slice(0,500);
    if (typeof req.body?.adEnabled === 'boolean') partner.adEnabled = req.body.adEnabled;
    if (typeof req.body?.adTitle === 'string') partner.adTitle = req.body.adTitle.trim().slice(0,160);
    if (typeof req.body?.adText === 'string') partner.adText = req.body.adText.trim().slice(0,1000);
    if (req.body?.adImageData !== undefined) {
      const adImageData = cleanImageData(req.body.adImageData);
      if (req.body.adImageData && !adImageData) return res.status(400).json({success:false,error:'Image publicitaire invalide ou trop volumineuse.'});
      partner.adImageData = adImageData;
    }
    if (typeof req.body?.adUrl === 'string') partner.adUrl = cleanUrl(req.body.adUrl);
    if (typeof req.body?.adButtonText === 'string') partner.adButtonText = req.body.adButtonText.trim().slice(0,80);
    if (req.body?.adExpiresAt !== undefined) { const d = req.body.adExpiresAt ? new Date(String(req.body.adExpiresAt)) : null; if (d && Number.isNaN(d.getTime())) return res.status(400).json({success:false,error:'Date d’expiration de publicité invalide.'}); partner.adExpiresAt = d; }
    if (partner.adEnabled && (!partner.adTitle || !partner.adText || !partner.adUrl)) return res.status(400).json({success:false,error:'Titre, texte et lien sont obligatoires pour une publicité active.'});
    if (typeof req.body?.featured === 'boolean') {
      partner.featured = req.body.featured;
      if (partner.featured) await Partner.updateMany({ _id: { $ne: partner._id } }, { $set: { featured:false } });
    }
    await partner.save();
    return res.json({ success:true, data:partner });
  } catch (e) {
    console.error('[Partners] PATCH', e);
    return res.status(500).json({ success:false, error:'Impossible de modifier le partenaire.' });
  }
});

router.delete('/admin/:id', isAuthenticated as any, async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès administrateur refusé.' });
  try {
    const deleted = await Partner.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success:false, error:'Partenaire introuvable.' });
    return res.json({ success:true });
  } catch (e) {
    console.error('[Partners] DELETE', e);
    return res.status(500).json({ success:false, error:'Impossible de supprimer le partenaire.' });
  }
});

export default router;
