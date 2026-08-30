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

router.get('/', async (_req: Request, res: Response) => {
  try {
    const partners = await Partner.find().sort({ featured: -1, createdAt: -1 }).lean();
    return res.json({ success: true, data: partners });
  } catch (e) {
    console.error('[Partners] GET', e);
    return res.status(500).json({ success: false, error: 'Impossible de charger les partenaires.' });
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
    const imageUrl = String(req.body?.imageUrl || '').trim();
    const featured = Boolean(req.body?.featured);
    if (!title || !description || !discordUrl || !imageUrl) return res.status(400).json({ success:false, error:'Titre, description, lien Discord et image sont obligatoires.' });
    if (!/^https?:\/\//i.test(discordUrl)) return res.status(400).json({ success:false, error:'Lien Discord invalide.' });
    if (!/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ success:false, error:'URL de photo invalide.' });
    if (featured) await Partner.updateMany({}, { $set: { featured: false } });
    const partner = await Partner.create({ title, description, discordUrl, imageUrl, featured });
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
    if (typeof req.body?.imageUrl === 'string') partner.imageUrl = req.body.imageUrl.trim().slice(0,2000);
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
