import express, { Request, Response, NextFunction } from 'express';
import { getRequestToken, verifyJwt, isOwner } from './auth.routes';
import User from '../../models/User';
import SupportTicket from '../../models/SupportTicket';
import Sequence from '../../models/Sequence';

const router = express.Router();
const STAFF_ROLES = new Set(['admin','super_admin','owner']);

type SessionRequest = Request & { user?: any; dbUser?: any };

async function supportAuth(req: SessionRequest, res: Response, next: NextFunction) {
  try {
    const token = getRequestToken(req);
    const payload = token ? verifyJwt(token) : null;
    if (!payload?.discordId) return res.status(401).json({ success:false, error:'Authentification requise.', code:'AUTH_REQUIRED' });
    const dbUser = await User.findOne({ discordId: String(payload.discordId) }).lean();
    if (!dbUser) return res.status(401).json({ success:false, error:'Utilisateur introuvable.' });
    req.user = payload;
    req.dbUser = dbUser;
    next();
  } catch (e) {
    console.error('[Support] Auth', e);
    return res.status(401).json({ success:false, error:'Session invalide.' });
  }
}

function isStaff(req: SessionRequest) {
  const role = String(req.dbUser?.role || '');
  return isOwner(String(req.user?.discordId || '')) || STAFF_ROLES.has(role);
}

async function nextNumber() {
  let sequence = await Sequence.findById('platform-support-ticket');
  if (!sequence) {
    const latest = await SupportTicket.findOne().sort({ ticketNumber: -1 }).select('ticketNumber').lean();
    const seed = Number(latest?.ticketNumber || 0);
    try {
      sequence = await Sequence.create({ _id: 'platform-support-ticket', value: seed });
    } catch (error: any) {
      // Another request initialized the sequence concurrently. Re-read it.
      if (Number(error?.code) !== 11000) throw error;
      sequence = await Sequence.findById('platform-support-ticket');
    }
  }
  const updated = await Sequence.findOneAndUpdate(
    { _id: 'platform-support-ticket' },
    { $inc: { value: 1 } },
    { new: true, runValidators: true },
  );
  return Number(updated?.value || sequence?.value || 0);
}

router.get('/tickets', supportAuth, async (req: SessionRequest, res: Response) => {
  try {
    const filter = isStaff(req) ? {} : { userId: String(req.user.discordId) };
    const data = await SupportTicket.find(filter).sort({ updatedAt:-1 }).lean();
    return res.json({ success:true, data });
  } catch (e) { console.error('[Support] list', e); return res.status(500).json({success:false,error:'Impossible de charger les tickets.'}); }
});

router.post('/tickets', supportAuth, async (req: SessionRequest, res: Response) => {
  try {
    const subject = String(req.body?.subject || '').trim().slice(0,160);
    const content = String(req.body?.content || '').trim().slice(0,4000);
    if (!subject || !content) return res.status(400).json({success:false,error:'Sujet et message obligatoires.'});
    const userId = String(req.user.discordId);
    const open = await SupportTicket.countDocuments({ userId, status:'open' });
    if (open >= 5) return res.status(429).json({success:false,error:'Vous avez atteint la limite de 5 tickets ouverts.'});
    const ticket = await SupportTicket.create({ ticketNumber: await nextNumber(), userId, username: String(req.dbUser.globalName || req.dbUser.username || userId), subject, messages:[{authorId:userId,authorName:String(req.dbUser.globalName || req.dbUser.username || userId),authorRole:String(req.dbUser.role || 'user'),content,createdAt:new Date()}] });
    return res.status(201).json({success:true,data:ticket});
  } catch (e) { console.error('[Support] create', e); return res.status(500).json({success:false,error:'Impossible de créer le ticket.'}); }
});

router.get('/tickets/:id', supportAuth, async (req: SessionRequest, res: Response) => {
  try {
    const ticket = await SupportTicket.findOne({ ticketNumber:Number(req.params.id) }).lean();
    if (!ticket) return res.status(404).json({success:false,error:'Ticket introuvable.'});
    if (!isStaff(req) && ticket.userId !== String(req.user.discordId)) return res.status(403).json({success:false,error:'Accès refusé.'});
    return res.json({success:true,data:ticket});
  } catch (e) { return res.status(500).json({success:false,error:'Impossible de charger le ticket.'}); }
});

router.post('/tickets/:id/messages', supportAuth, async (req: SessionRequest, res: Response) => {
  try {
    const content = String(req.body?.content || '').trim().slice(0,4000);
    if (!content) return res.status(400).json({success:false,error:'Message obligatoire.'});
    const ticket = await SupportTicket.findOne({ ticketNumber:Number(req.params.id) });
    if (!ticket) return res.status(404).json({success:false,error:'Ticket introuvable.'});
    if (!isStaff(req) && ticket.userId !== String(req.user.discordId)) return res.status(403).json({success:false,error:'Accès refusé.'});
    if (ticket.status === 'closed') return res.status(409).json({success:false,error:'Ce ticket est fermé.'});
    const name = String(req.dbUser.globalName || req.dbUser.username || req.user.discordId);
    ticket.messages.push({ authorId:String(req.user.discordId), authorName:name, authorRole:(String(req.dbUser.role || 'user') as any), content, createdAt:new Date() });
    await ticket.save();
    return res.json({success:true,data:ticket});
  } catch (e) { console.error('[Support] message', e); return res.status(500).json({success:false,error:'Impossible d’envoyer le message.'}); }
});

router.patch('/tickets/:id/status', supportAuth, async (req: SessionRequest, res: Response) => {
  try {
    if (!isStaff(req)) return res.status(403).json({success:false,error:'Accès réservé au haut gradé OMNIX.'});
    const status = req.body?.status === 'closed' ? 'closed' : 'open';
    const ticket = await SupportTicket.findOne({ ticketNumber:Number(req.params.id) });
    if (!ticket) return res.status(404).json({success:false,error:'Ticket introuvable.'});
    ticket.status = status;
    ticket.closedAt = status === 'closed' ? new Date() : null;
    ticket.closedBy = status === 'closed' ? String(req.user.discordId) : null;
    await ticket.save();
    return res.json({success:true,data:ticket});
  } catch (e) { return res.status(500).json({success:false,error:'Impossible de modifier le ticket.'}); }
});

export default router;
