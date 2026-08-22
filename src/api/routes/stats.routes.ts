import express from 'express';
import type {
  Request,
  Response,
  NextFunction
} from 'express';

const router = express.Router();

/* =========================================================
   AUTH
========================================================= */

function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user =
    (req as any).user ??
    (req as any).auth;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED'
    });
  }

  next();
}

/* =========================================================
   GET /api/stats
========================================================= */

router.get(
  '/stats',
  requireAuthenticated,
  async (_req: Request, res: Response) => {
    try {
      const startTime =
        process.hrtime.bigint();

      const app = (globalThis as any);

      const client =
        app.omnixDiscordClient ??
        app.discordClient ??
        app.client;

      const ping =
        Number(
          client?.ws?.ping
        );

      const guildsCount =
        Number(
          client?.guilds?.cache?.size
        );

      let totalUsers = 0;

      if (
        client?.guilds?.cache
      ) {
        for (
          const guild of
          client.guilds.cache.values()
        ) {
          totalUsers +=
            Number(
              guild?.memberCount ?? 0
            );
        }
      }

      const uptimeSeconds =
        Number(
          process.uptime()
        );

      const uptimePercent =
        100;

      const elapsed =
        Number(
          process.hrtime.bigint() -
          startTime
        ) / 1_000_000;

      return res.json({
        success: true,

        bot: {
          ping:
            Number.isFinite(ping)
              ? ping
              : null,

          guildsCount:
            Number.isFinite(
              guildsCount
            )
              ? guildsCount
              : 0,

          totalMembers:
            totalUsers,

          uptime:
            uptimePercent,

          uptimeSeconds,

          ready:
            Boolean(
              client?.isReady?.()
            )
        },

        database: {
          totalUsers
        },

        uptime:
          uptimePercent,

        responseTime:
          Math.round(elapsed)
      });
    } catch (error) {
      console.error(
        '[STATS] GET /stats:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
);

export default router;