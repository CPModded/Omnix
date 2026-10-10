import express from 'express';
import type { Request, Response } from 'express';
import { User } from '../../models/User';
import AiLog from '../../models/AiLog';
import AiSession from '../../models/AiSession';
import PlatformEvent from '../../models/PlatformEvent';
import { getRequestToken, verifyJwt } from './auth.routes';

const router = express.Router();
const client = () => (globalThis as any).omnixDiscordClient;

function range(req: Request) {
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();
  const start = req.query.start ? new Date(String(req.query.start)) : new Date(end.getTime() - 30 * 86400000);
  return { start, end };
}
function currentUser(req: Request) {
  const t = getRequestToken(req);
  return t ? verifyJwt(t) : null;
}
function safePing(c: any) {
  return Number.isFinite(c?.ws?.ping) && c.ws.ping >= 0 ? Math.round(c.ws.ping) : null;
}
function accessibleGuildIds(userDoc: any): string[] {
  return Array.isArray(userDoc?.guilds) ? userDoc.guilds.map((g:any) => String(g?.id || '')).filter(Boolean) : [];
}
function liveGuilds(ids: string[]) {
  const c = client();
  return ids.map(id => c?.guilds?.cache?.get?.(id)).filter(Boolean);
}

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const c = client();
    const payload = currentUser(req);
    const botGuilds = c?.guilds?.cache ? [...c.guilds.cache.values()] : [];
    const globalMembers = botGuilds.reduce((n:number,g:any) => n + Number(g?.memberCount || 0), 0);
    const globalGuildCount = botGuilds.length;
    const commandCount = Number(c?.commands?.size || 0);

    if (!payload?.discordId) {
      return res.json({
        success: true,
        bot: { ready: Boolean(c?.isReady?.()), ping: safePing(c), guildsCount: globalGuildCount, membersCount: globalMembers, commandsCount: commandCount, uptimeSeconds: Math.floor(process.uptime()) },
        servers: 0, guilds: 0, members: 0, commands: commandCount, ping: safePing(c),
        database: { totalUsers: await User.countDocuments() }, user: null,
        uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString()
      });
    }

    const [userDoc, aiRequests, aiErrors, aiSessionStats] = await Promise.all([
      User.findOne({ discordId: payload.discordId }).select('guilds isPremium email username globalName').lean(),
      AiLog.countDocuments({ userId: payload.discordId }),
      AiLog.countDocuments({ userId: payload.discordId, status: 'error' }),
      AiSession.aggregate([{ $match: { userId: payload.discordId } }, { $group: { _id: null, requests: { $sum: '$totalRequests' }, tokens: { $sum: '$totalTokens' } } }])
    ]);

    const ids = accessibleGuildIds(userDoc);
    const live = liveGuilds(ids);
    const members = live.reduce((n:number,g:any) => n + Number(g?.memberCount || 0), 0);
    const perGuild = ids.map(id => {
      const source = (userDoc?.guilds || []).find((g:any) => String(g.id) === id);
      const lg = c?.guilds?.cache?.get?.(id);
      return { id, name: lg?.name || source?.name || 'Serveur Discord', memberCount: Number(lg?.memberCount ?? source?.memberCount ?? 0) };
    });

    const recentAi = await AiLog.aggregate([
      { $match: { userId: payload.discordId, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, requests: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$status','error'] }, 1, 0] } }, tokens: { $sum: '$totalTokens' } } },
      { $sort: { _id: 1 } }
    ]);

    const recentActivity = await PlatformEvent.find({
      $or: [{ userId: payload.discordId }, { guildId: { $in: ids } }],
      createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
    }).sort({ createdAt: -1 }).limit(100).lean();

    return res.json({
      success: true,
      bot: { ready: Boolean(c?.isReady?.()), ping: safePing(c), guildsCount: globalGuildCount, membersCount: globalMembers, commandsCount: commandCount, uptimeSeconds: Math.floor(process.uptime()) },
      servers: ids.length,
      guilds: ids.length,
      members,
      commands: commandCount,
      ping: safePing(c),
      database: { totalUsers: await User.countDocuments() },
      user: {
        discordId: payload.discordId,
        username: userDoc?.globalName || userDoc?.username || payload.username,
        guildsCount: ids.length,
        isPremium: Boolean(userDoc?.isPremium),
        plan: userDoc?.isPremium ? 'premium' : 'free',
        aiRequests: Number(aiSessionStats?.[0]?.requests ?? aiRequests),
        aiErrors,
        guilds: perGuild,
        aiActivity: recentAi.map((x:any) => ({ date: x._id, requests: Number(x.requests||0), errors: Number(x.errors||0), tokens: Number(x.tokens||0) })),
        activity: recentActivity
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[STATS] /stats', error);
    return res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/stats/timeline', async (req: Request, res: Response) => {
  try {
    const { start, end } = range(req);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return res.status(400).json({ success:false, error:'Période invalide.' });
    const payload = currentUser(req);
    const userFilter = payload?.discordId ? { userId: payload.discordId } : {};
    const [users, guilds, ai] = await Promise.all([
      User.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format:'%Y-%m-%d', date:'$createdAt' } }, count:{ $sum:1 } } }, { $sort:{ _id:1 } }]),
      PlatformEvent.aggregate([{ $match: { type:'guild_added', ...userFilter, createdAt:{ $gte:start, $lte:end } } }, { $group:{ _id:{ $dateToString:{format:'%Y-%m-%d',date:'$createdAt'} }, count:{ $sum:1 } } }, { $sort:{_id:1} }]),
      AiLog.aggregate([{ $match: { ...userFilter, createdAt:{ $gte:start, $lte:end } } }, { $group:{ _id:{ $dateToString:{format:'%Y-%m-%d',date:'$createdAt'} }, requests:{ $sum:1 }, errors:{ $sum:{ $cond:[{$eq:['$status','error']},1,0] } }, tokens:{ $sum:'$totalTokens' } } }, { $sort:{_id:1} }])
    ]);
    return res.json({ success:true, period:{start,end}, users:users.map((x:any)=>({date:x._id,count:Number(x.count||0)})), guilds:guilds.map((x:any)=>({date:x._id,count:Number(x.count||0)})), ai:ai.map((x:any)=>({date:x._id,requests:Number(x.requests||0),errors:Number(x.errors||0),tokens:Number(x.tokens||0)})) });
  } catch (e) { return res.status(500).json({ success:false, error:'Impossible de charger la timeline.' }); }
});

router.get('/stats/health', async (_req,res) => {
  const c = client();
  const discord = Boolean(c?.isReady?.());
  const mongo = await User.exists({}).then(()=>true).catch(()=>false);
  return res.status(discord && mongo ? 200 : 503).json({ success:discord&&mongo, service:'OMNIX', status:discord&&mongo?'online':'degraded', discord:discord?'connected':'disconnected', database:mongo?'connected':'unavailable', timestamp:new Date().toISOString() });
});

export default router;
