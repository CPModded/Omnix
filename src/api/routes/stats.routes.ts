import {
  Router,
} from 'express';

import {
  client as botClient,
} from '../../bot/client';

import {
  User,
} from '../../models/User';


const router =
  Router();


const startedAt =
  Date.now();


/* =========================================================
   COMMAND COUNT
========================================================= */

function getCommandCount(): number {

  const client =
    botClient as any;

  if (
    client.commands &&
    typeof client.commands.size ===
      'number'
  ) {

    return client.commands.size;

  }


  const globalValue =
    (
      globalThis as typeof globalThis & {
        __OMNIX_COMMAND_COUNT?:
          number;
      }
    ).__OMNIX_COMMAND_COUNT;


  if (
    typeof globalValue ===
      'number' &&
    Number.isFinite(
      globalValue,
    )
  ) {

    return Math.max(
      0,
      Math.floor(
        globalValue,
      ),
    );

  }


  return 0;
}


/* =========================================================
   GET /api/stats
========================================================= */

router.get(
  '/',
  async (
    req,
    res,
  ) => {

    const requestStarted =
      Date.now();


    try {

      const connected =
        botClient.isReady();


      const guildsCount =
        connected
          ? botClient.guilds.cache.size
          : 0;


      const membersCount =
        connected
          ? botClient.guilds.cache.reduce(
              (
                total,
                guild,
              ) =>
                total +
                (
                  Number(
                    guild.memberCount ||
                    0,
                  )
                ),
              0,
            )
          : 0;


      const rawPing =
        connected
          ? Number(
              botClient.ws.ping,
            )
          : 0;


      const ping =
        Number.isFinite(
          rawPing,
        ) &&
        rawPing >= 0
          ? Math.round(
              rawPing,
            )
          : 0;


      let totalUsers =
        0;


      try {

        totalUsers =
          await User.countDocuments();

      } catch (error) {

        console.warn(
          '[Stats] MongoDB indisponible.',
          error,
        );

      }


      const latency =
        Date.now() -
        requestStarted;


      return res.json({

        success:
          true,

        bot: {

          connected,

          guildsCount,

          membersCount,

          ping,

          uptime:
            Math.floor(
              (
                Date.now() -
                startedAt
              ) / 1000,
            ),

        },

        database: {

          totalUsers,

          latency,

        },

        commands:
          getCommandCount(),

        api: {

          latency,

        },

        timestamp:
          new Date().toISOString(),

      });

    } catch (error) {

      console.error(
        '[Stats] ❌',
        error,
      );


      return res.status(200).json({

        success:
          false,

        bot: {

          connected:
            false,

          guildsCount:
            0,

          membersCount:
            0,

          ping:
            0,

          uptime:
            0,

        },

        database: {

          totalUsers:
            0,

          latency:
            0,

        },

        commands:
          0,

        api: {

          latency:
            Date.now() -
            requestStarted,

        },

        timestamp:
          new Date().toISOString(),

      });

    }

  },
);


/* =========================================================
   GET /api/stats/health
========================================================= */

router.get(
  '/health',
  (
    req,
    res,
  ) => {

    return res.json({

      success:
        true,

      service:
        'OMNIX',

      status:
        botClient.isReady()
          ? 'online'
          : 'degraded',

      discord:
        botClient.isReady()
          ? 'connected'
          : 'disconnected',

      timestamp:
        new Date().toISOString(),

    });

  },
);


export default router;