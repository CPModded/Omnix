import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getRequestToken, verifyJwt } from './auth.routes.ts';

const router = express.Router();

function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const token = getRequestToken(req);
  const payload = token ? verifyJwt(token) : null;
  if (!payload) {
    return res.status(401).json({ success:false, error:'UNAUTHORIZED', code:'AUTH_REQUIRED' });
  }
  (req as any).user = payload;
  next();
}

router.get('/stats', requireAuthenticated, async (_req: Request, res: Response) => {
  try {
    const client: any = (globalThis as any).omnixDiscordClient;
    const ready = Boolean(client?.isReady?.());
    const guildsCount = Number(client?.guilds?.cache?.size ?? 0);
    let totalMembers = 0;
    if (client?.guilds?.cache) {
      for (const guild of client.guilds.cache.values()) totalMembers += Number(guild?.memberCount ?? 0);
    }
    const ping = Number(client?.ws?.ping);
    const commandsCount = Number(client?.commands?.size ?? 0);
    const uptimeSeconds = Number(process.uptime());
    return res.json({
      success:true,
      bot:{
        ready,
        ping:Number.isFinite(ping) ? ping : null,
        guildsCount:Number.isFinite(guildsCount) ? guildsCount : 0,
        membersCount:totalMembers,
        totalMembers,
        commandsCount:Number.isFinite(commandsCount) ? commandsCount : 0,
        uptimeSeconds
      },
      servers:guildsCount,
      guilds:guildsCount,
      members:totalMembers,
      commands:commandsCount,
      ping:Number.isFinite(ping) ? ping : null,
      database:{ totalUsers:totalMembers, totalMembers },
      uptime:uptimeSeconds
    });
  } catch (error) {
    console.error('[STATS] GET /stats:', error);
    return res.status(500).json({ success:false, error:'INTERNAL_SERVER_ERROR' });
  }
});

export default router;
