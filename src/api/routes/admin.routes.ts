import express from "express";
import type {
  Request,
  Response,
  NextFunction
} from "express";
import mongoose from "mongoose";
import PricingPlan from "../../models/PricingPlan.ts";
import AiLog from "../../models/AiLog.ts";
import StaffAuditLog from "../../models/StaffAuditLog.ts";
import { GuildConfig } from "../../models/GuildConfig.ts";
import User from "../../models/User.ts";
const router = express.Router();
/* =========================================================
   TYPES
========================================================= */
interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
    discordId?: string;
    username?: string;
    tag?: string;
    isAdmin?: boolean;
    isOwner?: boolean;
    isPremium?: boolean;
    [key: string]: unknown;
  };
}
/* =========================================================
   HELPERS
========================================================= */
function getUserId(req: AuthenticatedRequest): string | null {
  const user = req.user;
  if (!user) {
    return null;
  }
  const id =
    user.id ||
    user.userId ||
    user.discordId;
  return id ? String(id) : null;
}
function getUserName(
  req: AuthenticatedRequest
): string {
  const user = req.user;
  if (!user) {
    return "Unknown Staff";
  }
  return String(
    user.username ||
    user.tag ||
    user.id ||
    user.userId ||
    user.discordId ||
    "Unknown Staff"
  );
}
function normalizeDate(
  value: unknown
): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}
function getDateRange(
  req: Request
): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const requestedStart =
    normalizeDate(
      req.query.start
    );
  const requestedEnd =
    normalizeDate(
      req.query.end
    );
  if (requestedStart) {
    const end =
      requestedEnd || now;
    return {
      start: requestedStart,
      end
    };
  }
  /*
   * Par défaut : 30 derniers jours.
   */
  const start =
    new Date(now);
  start.setDate(
    start.getDate() - 30
  );
  return {
    start,
    end: requestedEnd || now
  };
}
function safeNumber(
  value: unknown
): number {
  const number =
    Number(value);
  return Number.isFinite(number)
    ? number
    : 0;
}
/* =========================================================
   AUDIT STAFF
========================================================= */
async function writeAudit(
  req: AuthenticatedRequest,
  data: {
    action:
      | "create"
      | "update"
      | "delete"
      | "enable"
      | "disable"
      | "login"
      | "logout"
      | "grant"
      | "revoke"
      | "refund"
      | "cancel"
      | "restore"
      | "backup"
      | "manual"
      | "system";
    category:
      | "pricing"
      | "payment"
      | "subscription"
      | "user"
      | "guild"
      | "ai"
      | "system"
      | "authentication"
      | "configuration"
      | "staff";
    status?:
      | "success"
      | "failed"
      | "warning";
    description: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    guildId?: string;
    guildName?: string;
    ownerId?: string;
    previousValue?: Record<
      string,
      unknown
    >;
    newValue?: Record<
      string,
      unknown
    >;
    error?: string;
    errorCode?: string;
    metadata?: Record<
      string,
      unknown
    >;
  }
): Promise<void> {
  try {
    const staffId =
      getUserId(req);
    if (!staffId) {
      return;
    }
    await StaffAuditLog.create({
      staffId,
      staffUsername:
        getUserName(req),
      action:
        data.action,
      category:
        data.category,
      status:
        data.status ||
        "success",
      description:
        data.description,
      targetType:
        data.targetType,
      targetId:
        data.targetId,
      targetName:
        data.targetName,
      guildId:
        data.guildId,
      guildName:
        data.guildName,
      ownerId:
        data.ownerId,
      previousValue:
        data.previousValue,
      newValue:
        data.newValue,
      method:
        req.method,
      route:
        req.originalUrl,
      userAgent:
        req.headers[
          "user-agent"
        ],
      error:
        data.error,
      errorCode:
        data.errorCode,
      metadata:
        data.metadata || {}
    });
  } catch (error) {
    /*
     * L'audit ne doit jamais faire
     * échouer une opération Staff.
     */
    console.error(
      "[OMNIX][ADMIN] Erreur audit :",
      error
    );
  }
}
/* =========================================================
   STAFF AUTHENTICATION
========================================================= */
/*
 * IMPORTANT :
 *
 * Cette route suppose que le middleware JWT/authentication
 * existant a déjà placé req.user.
 *
 * On ne crée volontairement PAS une deuxième authentification.
 */
function requireStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const user =
    req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Non authentifié."
    });
  }
  const isAdmin =
    Boolean(
      user.isAdmin ||
      user.isOwner
    );
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error:
        "Accès réservé au Staff OMNIX."
    });
  }
  next();
}
/* =========================================================
   DASHBOARD OVERVIEW
   GET /api/admin/overview
========================================================= */
router.get(
  "/overview",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const {
        start,
        end
      } = getDateRange(req);
      const dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end
        }
      };
      const [
        totalUsers,
        newUsers,
        totalGuilds,
        premiumPlans,
        activePlans,
        aiRequests,
        aiErrors,
        auditCount
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments(
          dateFilter
        ),
        GuildConfig.countDocuments({}),
        PricingPlan.countDocuments({
          active: true
        }),
        PricingPlan.countDocuments({
          active: true
        }),
        AiLog.countDocuments(
          dateFilter
        ),
        AiLog.countDocuments({
          ...dateFilter,
          status: "error"
        }),
        StaffAuditLog.countDocuments(
          dateFilter
        )
      ]);
      /*
       * Les paiements seront branchés
       * dans la partie 2 lorsque le modèle
       * de paiement existant aura été raccordé.
       */
      const [
        premiumGuilds,
        freeGuilds
      ] = await Promise.all([
        GuildConfig.countDocuments({
          "premium.isPremium": true
        }),
        GuildConfig.countDocuments({
          $or: [
            {
              "premium.isPremium": {
                $exists: false
              }
            },
            {
              "premium.isPremium": false
            }
          ]
        })
      ]);
      return res.json({
        success: true,
        period: {
          start,
          end
        },
        users: {
          total:
            safeNumber(
              totalUsers
            ),
          new:
            safeNumber(
              newUsers
            )
        },
        guilds: {
          total:
            safeNumber(
              totalGuilds
            ),
          premium:
            safeNumber(
              premiumGuilds
            ),
          free:
            safeNumber(
              freeGuilds
            )
        },
        pricing: {
          total:
            safeNumber(
              premiumPlans
            ),
          active:
            safeNumber(
              activePlans
            )
        },
        ai: {
          requests:
            safeNumber(
              aiRequests
            ),
          errors:
            safeNumber(
              aiErrors
            )
        },
        staff: {
          auditActions:
            safeNumber(
              auditCount
            )
        },
        system: {
          mongodb:
            mongoose.connection.readyState === 1
              ? "connected"
              : "disconnected",
          uptime:
            process.uptime(),
          memory:
            process.memoryUsage()
        }
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Overview error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les statistiques Staff."
      });
    }
  }
);
/* =========================================================
   USER STATISTICS
   GET /api/admin/statistics/users
========================================================= */
router.get(
  "/statistics/users",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const {
        start,
        end
      } = getDateRange(req);
      const rows =
        await User.aggregate([
          {
            $match: {
              createdAt: {
                $gte: start,
                $lte: end
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",
                  date:
                    "$createdAt"
                }
              },
              count: {
                $sum: 1
              }
            }
          },
          {
            $sort: {
              "_id": 1
            }
          }
        ]);
      return res.json({
        success: true,
        period: {
          start,
          end
        },
        data:
          rows.map(
            (row) => ({
              date:
                row._id,
              count:
                safeNumber(
                  row.count
                )
            })
          )
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] User statistics error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les statistiques utilisateurs."
      });
    }
  }
);
/* =========================================================
   GUILD STATISTICS
   GET /api/admin/statistics/guilds
========================================================= */
router.get(
  "/statistics/guilds",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const {
        start,
        end
      } = getDateRange(req);
      const rows =
        await GuildConfig.aggregate([
          {
            $match: {
              createdAt: {
                $gte: start,
                $lte: end
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",
                  date:
                    "$createdAt"
                }
              },
              count: {
                $sum: 1
              }
            }
          },
          {
            $sort: {
              "_id": 1
            }
          }
        ]);
      return res.json({
        success: true,
        period: {
          start,
          end
        },
        data:
          rows.map(
            (row) => ({
              date:
                row._id,
              count:
                safeNumber(
                  row.count
                )
            })
          )
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guild statistics error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les statistiques serveurs."
      });
    }
  }
);
/* =========================================================
   AI STATISTICS
   GET /api/admin/statistics/ai
========================================================= */
router.get(
  "/statistics/ai",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const {
        start,
        end
      } = getDateRange(req);
      const rows =
        await AiLog.aggregate([
          {
            $match: {
              createdAt: {
                $gte: start,
                $lte: end
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",
                  date:
                    "$createdAt"
                }
              },
              requests: {
                $sum: 1
              },
              tokens: {
                $sum:
                  "$totalTokens"
              },
              errors: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$status",
                        "error"
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $sort: {
              "_id": 1
            }
          }
        ]);
      return res.json({
        success: true,
        period: {
          start,
          end
        },
        data:
          rows.map(
            (row) => ({
              date:
                row._id,
              requests:
                safeNumber(
                  row.requests
                ),
              tokens:
                safeNumber(
                  row.tokens
                ),
              errors:
                safeNumber(
                  row.errors
                )
            })
          )
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] AI statistics error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les statistiques IA."
      });
    }
  }
);
/* =========================================================
   AI LOGS
   GET /api/admin/ai-logs
========================================================= */
router.get(
  "/ai-logs",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page ||
              "1"
            ),
            10
          ) || 1
        );
      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit ||
                "25"
              ),
              10
            ) || 25
          )
        );
      const skip =
        (page - 1) *
        limit;
      const filter: Record<
        string,
        unknown
      > = {};
      if (
        req.query.guildId
      ) {
        filter.guildId =
          String(
            req.query.guildId
          );
      }
      if (
        req.query.ownerId
      ) {
        filter.ownerId =
          String(
            req.query.ownerId
          );
      }
      if (
        req.query.userId
      ) {
        filter.userId =
          String(
            req.query.userId
          );
      }
      if (
        req.query.sessionId
      ) {
        filter.sessionId =
          String(
            req.query.sessionId
          );
      }
      if (
        req.query.source
      ) {
        filter.source =
          String(
            req.query.source
          );
      }
      if (
        req.query.status
      ) {
        filter.status =
          String(
            req.query.status
          );
      }
      if (
        req.query.model
      ) {
        filter.model =
          String(
            req.query.model
          );
      }
      const search =
        String(
          req.query.search ||
          ""
        ).trim();
      if (search) {
        filter.$or = [
          {
            userMessage: {
              $regex:
                search,
              $options:
                "i"
            }
          },
          {
            assistantMessage: {
              $regex:
                search,
              $options:
                "i"
            }
          },
          {
            username: {
              $regex:
                search,
              $options:
                "i"
            }
          },
          {
            guildName: {
              $regex:
                search,
              $options:
                "i"
            }
          }
        ];
      }
      const {
        start,
        end
      } = getDateRange(req);
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
      const [
        logs,
        total
      ] = await Promise.all([
        AiLog.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),
        AiLog.countDocuments(
          filter
        )
      ]);
      return res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total /
              limit
            )
        },
        data:
          logs
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] AI logs error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les logs IA."
      });
    }
  }
);
/* =========================================================
   AI SESSION
   GET /api/admin/ai-logs/:sessionId
========================================================= */
router.get(
  "/ai-logs/:sessionId",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const sessionId =
        String(
          req.params.sessionId
        );
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error:
            "Session IA invalide."
        });
      }
      const logs =
        await AiLog.find({
          sessionId
        })
          .sort({
            createdAt: 1
          })
          .lean();
      return res.json({
        success: true,
        sessionId,
        count:
          logs.length,
        data:
          logs
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] AI session error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger la session IA."
      });
    }
  }
);
/* =========================================================
   USERS
   GET /api/admin/users
========================================================= */
router.get(
  "/users",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page ||
              "1"
            ),
            10
          ) || 1
        );
      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit ||
                "25"
              ),
              10
            ) || 25
          )
        );
      const skip =
        (page - 1) *
        limit;
      const filter: Record<
        string,
        unknown
      > = {};
      const search =
        String(
          req.query.search ||
          ""
        ).trim();
      if (search) {
        filter.$or = [
          {
            discordId: {
              $regex:
                search,
              $options:
                "i"
            }
          },
          {
            username: {
              $regex:
                search,
              $options:
                "i"
            }
          },
          {
            email: {
              $regex:
                search,
              $options:
                "i"
            }
          }
        ];
      }
      const [
        users,
        total
      ] = await Promise.all([
        User.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(
          filter
        )
      ]);
      return res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total /
              limit
            )
        },
        data:
          users
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Users error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les utilisateurs."
      });
    }
  }
);
/* =========================================================
   GUILDS
   GET /api/admin/guilds
========================================================= */
router.get(
  "/guilds",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page ||
              "1"
            ),
            10
          ) || 1
        );
      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit ||
                "25"
              ),
              10
            ) || 25
          )
        );
      const skip =
        (page - 1) *
        limit;
      const search =
        String(
          req.query.search ||
          ""
        ).trim();
      const filter: Record<
        string,
        unknown
      > = {};
      if (search) {
        filter.$or = [
          {
            guildId: {
              $regex:
                search,
              $options:
                "i"
            }
          },
          {
            guildName: {
              $regex:
                search,
              $options:
                "i"
            }
          }
        ];
      }
      const [
        guilds,
        total
      ] = await Promise.all([
        GuildConfig.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),
        GuildConfig.countDocuments(
          filter
        )
      ]);
      return res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total /
              limit
            )
        },
        data:
          guilds
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guilds error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les serveurs."
      });
    }
  }
);
/* =========================================================
   GUILD DETAIL
   GET /api/admin/guilds/:guildId
========================================================= */
router.get(
  "/guilds/:guildId",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId
        );
      const config =
        await GuildConfig.findOne({
          guildId
        }).lean();
      if (!config) {
        return res.status(404).json({
          success: false,
          error:
            "Configuration serveur introuvable."
        });
      }
      const [
        aiRequests,
        aiErrors,
        aiTokens
      ] = await Promise.all([
        AiLog.countDocuments({
          guildId
        }),
        AiLog.countDocuments({
          guildId,
          status: "error"
        }),
        AiLog.aggregate([
          {
            $match: {
              guildId
            }
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  "$totalTokens"
              }
            }
          }
        ])
      ]);
      return res.json({
        success: true,
        guild: config,
        ai: {
          requests:
            aiRequests,
          errors:
            aiErrors,
          tokens:
            safeNumber(
              aiTokens?.[0]?.total
            )
        }
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guild detail error :",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger le serveur."
      });
    }
  }
);
/* =========================================================
   HEALTH
   GET /api/admin/health
========================================================= */
router.get(
  "/health",
  requireStaff,
  async (
    _req: AuthenticatedRequest,
    res: Response
  ) => {
    const memory =
      process.memoryUsage();
    return res.json({
      success: true,
      status: "online",
      uptime:
        process.uptime(),
      node: {
        version:
          process.version,
        platform:
          process.platform,
        architecture:
          process.arch
      },
      memory: {
        rss:
          memory.rss,
        heapTotal:
          memory.heapTotal,
        heapUsed:
          memory.heapUsed,
        external:
          memory.external
      },
      mongodb: {
        state:
          mongoose.connection.readyState,
        connected:
          mongoose.connection.readyState === 1
      },
      timestamp:
        new Date()
          .toISOString()
    });
  }
);
/* =========================================================
   EXPORT
========================================================= */
export default router;

/* =========================================================
   PRICING - LIST
   GET /api/admin/pricing
========================================================= */

router.get(
  "/pricing",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const includeInactive =
        String(
          req.query.includeInactive || "false"
        ) === "true";

      const filter: Record<string, unknown> = {};

      if (!includeInactive) {
        filter.active = true;
      }

      const plans =
        await PricingPlan.find(filter)
          .sort({
            featured: -1,
            sortOrder: 1,
            createdAt: -1
          })
          .lean();

      return res.json({
        success: true,
        count: plans.length,
        data: plans
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing list error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les offres."
      });
    }
  }
);


/* =========================================================
   PRICING - DETAIL
   GET /api/admin/pricing/:id
========================================================= */

router.get(
  "/pricing/:id",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const id =
        String(req.params.id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: "Identifiant d'offre invalide."
        });
      }

      const plan =
        await PricingPlan.findById(id).lean();

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: "Offre introuvable."
        });
      }

      return res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing detail error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger cette offre."
      });
    }
  }
);


/* =========================================================
   PRICING - CREATE
   POST /api/admin/pricing
========================================================= */

router.post(
  "/pricing",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const body =
        req.body || {};

      const name =
        String(
          body.name ||
          body.title ||
          ""
        ).trim();

      const description =
        String(
          body.description ||
          ""
        ).trim();

      const stripeUrl =
        String(
          body.stripeUrl ||
          body.stripeLink ||
          body.stripe ||
          ""
        ).trim();

      const duration =
        safeNumber(
          body.duration ||
          body.durationDays
        );

      const price =
        safeNumber(
          body.price
        );

      const sortOrder =
        safeNumber(
          body.sortOrder
        );

      const active =
        body.active !== false;

      const featured =
        body.featured === true;

      if (!name) {
        return res.status(400).json({
          success: false,
          error:
            "Le nom de l'offre est obligatoire."
        });
      }

      if (price < 0) {
        return res.status(400).json({
          success: false,
          error:
            "Le prix ne peut pas être négatif."
        });
      }

      if (!duration || duration <= 0) {
        return res.status(400).json({
          success: false,
          error:
            "La durée de l'offre est obligatoire."
        });
      }

      if (!stripeUrl) {
        return res.status(400).json({
          success: false,
          error:
            "Le lien Stripe est obligatoire."
        });
      }

      const plan =
        await PricingPlan.create({
          name,
          description,
          price,
          duration,
          durationDays:
            body.durationDays !== undefined
              ? safeNumber(
                  body.durationDays
                )
              : undefined,
          stripeUrl,
          stripeLink:
            body.stripeLink !== undefined
              ? stripeUrl
              : undefined,
          active,
          featured,
          sortOrder
        });

      await writeAudit(
        req,
        {
          action: "create",
          category: "pricing",
          description:
            `Création de l'offre "${name}".`,
          targetType:
            "PricingPlan",
          targetId:
            String(plan._id),
          targetName:
            name,
          newValue: {
            name,
            description,
            price,
            duration,
            stripeUrl,
            active,
            featured,
            sortOrder
          }
        }
      );

      return res.status(201).json({
        success: true,
        message:
          "Offre créée avec succès.",
        data: plan
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing create error :",
        error
      );

      await writeAudit(
        req,
        {
          action: "create",
          category: "pricing",
          status: "failed",
          description:
            "Échec de création d'une offre.",
          error:
            error instanceof Error
              ? error.message
              : String(error)
        }
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de créer l'offre."
      });
    }
  }
);


/* =========================================================
   PRICING - UPDATE
   PATCH /api/admin/pricing/:id
========================================================= */

router.patch(
  "/pricing/:id",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const id =
        String(req.params.id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error:
            "Identifiant d'offre invalide."
        });
      }

      const plan =
        await PricingPlan.findById(id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error:
            "Offre introuvable."
        });
      }

      const previousValue =
        plan.toObject();

      const body =
        req.body || {};

      const allowedFields = [
        "name",
        "title",
        "description",
        "price",
        "duration",
        "durationDays",
        "stripeUrl",
        "stripeLink",
        "active",
        "featured",
        "sortOrder"
      ];

      for (const field of allowedFields) {
        if (
          body[field] === undefined
        ) {
          continue;
        }

        if (
          field === "title"
        ) {
          plan.set(
            "name",
            String(body[field]).trim()
          );
          continue;
        }

        if (
          [
            "price",
            "duration",
            "durationDays",
            "sortOrder"
          ].includes(field)
        ) {
          plan.set(
            field,
            safeNumber(body[field])
          );
          continue;
        }

        if (
          field === "stripeLink"
        ) {
          plan.set(
            "stripeUrl",
            String(body[field]).trim()
          );
          continue;
        }

        if (
          field === "name" ||
          field === "description" ||
          field === "stripeUrl"
        ) {
          plan.set(
            field,
            String(body[field]).trim()
          );
          continue;
        }

        plan.set(
          field,
          body[field]
        );
      }

      if (
        safeNumber(plan.get("price")) < 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Le prix ne peut pas être négatif."
        });
      }

      if (
        safeNumber(
          plan.get("duration")
        ) <= 0 &&
        safeNumber(
          plan.get("durationDays")
        ) <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "La durée doit être supérieure à zéro."
        });
      }

      await plan.save();

      await writeAudit(
        req,
        {
          action: "update",
          category: "pricing",
          description:
            `Modification de l'offre "${String(
              plan.get("name") || ""
            )}".`,
          targetType:
            "PricingPlan",
          targetId:
            id,
          targetName:
            String(
              plan.get("name") || ""
            ),
          previousValue,
          newValue:
            plan.toObject()
        }
      );

      return res.json({
        success: true,
        message:
          "Offre modifiée avec succès.",
        data:
          plan.toObject()
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing update error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de modifier l'offre."
      });
    }
  }
);


/* =========================================================
   PRICING - ENABLE
   POST /api/admin/pricing/:id/enable
========================================================= */

router.post(
  "/pricing/:id/enable",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const id =
        String(req.params.id);

      const plan =
        await PricingPlan.findById(id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error:
            "Offre introuvable."
        });
      }

      const previousValue = {
        active:
          plan.get("active")
      };

      plan.set(
        "active",
        true
      );

      await plan.save();

      await writeAudit(
        req,
        {
          action: "enable",
          category: "pricing",
          description:
            `Activation de l'offre "${String(
              plan.get("name") || ""
            )}".`,
          targetType:
            "PricingPlan",
          targetId:
            id,
          targetName:
            String(
              plan.get("name") || ""
            ),
          previousValue,
          newValue: {
            active: true
          }
        }
      );

      return res.json({
        success: true,
        message:
          "Offre activée.",
        data:
          plan.toObject()
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing enable error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible d'activer l'offre."
      });
    }
  }
);


/* =========================================================
   PRICING - DISABLE
   POST /api/admin/pricing/:id/disable
========================================================= */

router.post(
  "/pricing/:id/disable",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const id =
        String(req.params.id);

      const plan =
        await PricingPlan.findById(id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error:
            "Offre introuvable."
        });
      }

      const previousValue = {
        active:
          plan.get("active")
      };

      plan.set(
        "active",
        false
      );

      await plan.save();

      await writeAudit(
        req,
        {
          action: "disable",
          category: "pricing",
          description:
            `Désactivation de l'offre "${String(
              plan.get("name") || ""
            )}".`,
          targetType:
            "PricingPlan",
          targetId:
            id,
          targetName:
            String(
              plan.get("name") || ""
            ),
          previousValue,
          newValue: {
            active: false
          }
        }
      );

      return res.json({
        success: true,
        message:
          "Offre désactivée.",
        data:
          plan.toObject()
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing disable error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de désactiver l'offre."
      });
    }
  }
);


/* =========================================================
   PRICING - DELETE
   DELETE /api/admin/pricing/:id
========================================================= */

router.delete(
  "/pricing/:id",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const id =
        String(req.params.id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error:
            "Identifiant d'offre invalide."
        });
      }

      const plan =
        await PricingPlan.findById(id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error:
            "Offre introuvable."
        });
      }

      const previousValue =
        plan.toObject();

      await PricingPlan.deleteOne({
        _id: id
      });

      await writeAudit(
        req,
        {
          action: "delete",
          category: "pricing",
          description:
            `Suppression de l'offre "${String(
              plan.get("name") || ""
            )}".`,
          targetType:
            "PricingPlan",
          targetId:
            id,
          targetName:
            String(
              plan.get("name") || ""
            ),
          previousValue
        }
      );

      return res.json({
        success: true,
        message:
          "Offre supprimée."
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Pricing delete error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de supprimer l'offre."
      });
    }
  }
);


/* =========================================================
   STAFF AUDIT LOGS
   GET /api/admin/audit-logs
========================================================= */

router.get(
  "/audit-logs",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page || "1"
            ),
            10
          ) || 1
        );

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit || "50"
              ),
              10
            ) || 50
          )
        );

      const skip =
        (page - 1) * limit;

      const filter: Record<
        string,
        unknown
      > = {};

      if (req.query.staffId) {
        filter.staffId =
          String(
            req.query.staffId
          );
      }

      if (req.query.category) {
        filter.category =
          String(
            req.query.category
          );
      }

      if (req.query.action) {
        filter.action =
          String(
            req.query.action
          );
      }

      if (req.query.status) {
        filter.status =
          String(
            req.query.status
          );
      }

      if (req.query.guildId) {
        filter.guildId =
          String(
            req.query.guildId
          );
      }

      if (req.query.targetId) {
        filter.targetId =
          String(
            req.query.targetId
          );
      }

      const search =
        String(
          req.query.search || ""
        ).trim();

      if (search) {
        filter.$or = [
          {
            description: {
              $regex: search,
              $options: "i"
            }
          },
          {
            staffUsername: {
              $regex: search,
              $options: "i"
            }
          },
          {
            guildName: {
              $regex: search,
              $options: "i"
            }
          },
          {
            targetName: {
              $regex: search,
              $options: "i"
            }
          }
        ];
      }

      const {
        start,
        end
      } = getDateRange(req);

      filter.createdAt = {
        $gte: start,
        $lte: end
      };

      const [
        logs,
        total
      ] = await Promise.all([
        StaffAuditLog.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        StaffAuditLog.countDocuments(
          filter
        )
      ]);

      return res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total / limit
            )
        },
        data: logs
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Audit logs error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les logs Staff."
      });
    }
  }
);


/* =========================================================
   USER DETAIL
   GET /api/admin/users/:userId
========================================================= */

router.get(
  "/users/:userId",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        String(
          req.params.userId
        );

      const user =
        await User.findOne({
          $or: [
            {
              discordId:
                userId
            },
            ...(mongoose.Types.ObjectId.isValid(
              userId
            )
              ? [
                  {
                    _id:
                      userId
                  }
                ]
              : [])
          ]
        }).lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          error:
            "Utilisateur introuvable."
        });
      }

      const [
        aiRequests,
        aiErrors,
        aiTokens,
        aiSessions
      ] = await Promise.all([
        AiLog.countDocuments({
          userId:
            String(
              (user as any).discordId ||
              userId
            )
        }),

        AiLog.countDocuments({
          userId:
            String(
              (user as any).discordId ||
              userId
            ),
          status: "error"
        }),

        AiLog.aggregate([
          {
            $match: {
              userId:
                String(
                  (user as any).discordId ||
                  userId
                )
            }
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  "$totalTokens"
              }
            }
          }
        ]),

        AiLog.distinct(
          "sessionId",
          {
            userId:
              String(
                (user as any).discordId ||
                userId
              ),
            sessionId: {
              $exists: true,
              $ne: null
            }
          }
        )
      ]);

      return res.json({
        success: true,
        user,
        ai: {
          requests:
            aiRequests,
          errors:
            aiErrors,
          tokens:
            safeNumber(
              aiTokens?.[0]?.total
            ),
          sessions:
            aiSessions.length
        }
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] User detail error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger l'utilisateur."
      });
    }
  }
);


/* =========================================================
   USER AI LOGS
   GET /api/admin/users/:userId/ai-logs
========================================================= */

router.get(
  "/users/:userId/ai-logs",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        String(
          req.params.userId
        );

      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page || "1"
            ),
            10
          ) || 1
        );

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit || "50"
              ),
              10
            ) || 50
          )
        );

      const skip =
        (page - 1) * limit;

      const filter: Record<
        string,
        unknown
      > = {
        userId
      };

      const {
        start,
        end
      } = getDateRange(req);

      filter.createdAt = {
        $gte: start,
        $lte: end
      };

      const [
        logs,
        total
      ] = await Promise.all([
        AiLog.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        AiLog.countDocuments(
          filter
        )
      ]);

      return res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total / limit
            )
        },
        data: logs
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] User AI logs error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les conversations IA."
      });
    }
  }
);


/* =========================================================
   GUILD AI LOGS
   GET /api/admin/guilds/:guildId/ai-logs
========================================================= */

router.get(
  "/guilds/:guildId/ai-logs",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId
        );

      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page || "1"
            ),
            10
          ) || 1
        );

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit || "50"
              ),
              10
            ) || 50
          )
        );

      const skip =
        (page - 1) * limit;

      const filter: Record<
        string,
        unknown
      > = {
        guildId
      };

      if (req.query.ownerId) {
        filter.ownerId =
          String(
            req.query.ownerId
          );
      }

      if (req.query.userId) {
        filter.userId =
          String(
            req.query.userId
          );
      }

      if (req.query.status) {
        filter.status =
          String(
            req.query.status
          );
      }

      const {
        start,
        end
      } = getDateRange(req);

      filter.createdAt = {
        $gte: start,
        $lte: end
      };

      const [
        logs,
        total
      ] = await Promise.all([
        AiLog.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        AiLog.countDocuments(
          filter
        )
      ]);

      return res.json({
        success: true,
        guildId,
        ownerId:
          req.query.ownerId
            ? String(
                req.query.ownerId
              )
            : null,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total / limit
            )
        },
        data: logs
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guild AI logs error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les logs IA du serveur."
      });
    }
  }
);


/* =========================================================
   GUILD AI STATISTICS
   GET /api/admin/guilds/:guildId/ai-statistics
========================================================= */

router.get(
  "/guilds/:guildId/ai-statistics",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId
        );

      const {
        start,
        end
      } = getDateRange(req);

      const rows =
        await AiLog.aggregate([
          {
            $match: {
              guildId,
              createdAt: {
                $gte: start,
                $lte: end
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format:
                    "%Y-%m-%d",
                  date:
                    "$createdAt"
                }
              },
              requests: {
                $sum: 1
              },
              errors: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$status",
                        "error"
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              tokens: {
                $sum:
                  "$totalTokens"
              }
            }
          },
          {
            $sort: {
              "_id": 1
            }
          }
        ]);

      return res.json({
        success: true,
        guildId,
        period: {
          start,
          end
        },
        data:
          rows.map(
            (row) => ({
              date:
                row._id,
              requests:
                safeNumber(
                  row.requests
                ),
              errors:
                safeNumber(
                  row.errors
                ),
              tokens:
                safeNumber(
                  row.tokens
                )
            })
          )
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guild AI statistics error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les statistiques IA du serveur."
      });
    }
  }
);


/* =========================================================
   GUILD PREMIUM - GRANT
   POST /api/admin/guilds/:guildId/premium
========================================================= */

router.post(
  "/guilds/:guildId/premium",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId
        );

      const config =
        await GuildConfig.findOne({
          guildId
        });

      if (!config) {
        return res.status(404).json({
          success: false,
          error:
            "Serveur introuvable."
        });
      }

      const body =
        req.body || {};

      const enabled =
        body.enabled !== false;

      const previousValue = {
        premium:
          (config as any).premium
      };

      /*
       * On utilise ici la structure
       * premium existante du GuildConfig.
       *
       * Les champs inconnus sont évités
       * afin de ne pas casser le modèle.
       */
      const currentPremium =
        (config as any).premium || {};

      (config as any).premium = {
        ...currentPremium,
        isPremium:
          enabled,
        grantedBy:
          getUserId(req),
        grantedAt:
          enabled
            ? new Date()
            : currentPremium.grantedAt
      };

      await config.save();

      await writeAudit(
        req,
        {
          action:
            enabled
              ? "grant"
              : "revoke",
          category:
            "subscription",
          description:
            enabled
              ? `Premium accordé au serveur ${guildId}.`
              : `Premium retiré du serveur ${guildId}.`,
          targetType:
            "GuildConfig",
          targetId:
            guildId,
          targetName:
            String(
              (config as any).guildName ||
              guildId
            ),
          guildId,
          guildName:
            String(
              (config as any).guildName ||
              guildId
            ),
          ownerId:
            String(
              (config as any).ownerId ||
              ""
            ),
          previousValue,
          newValue: {
            premium:
              (config as any).premium
          }
        }
      );

      return res.json({
        success: true,
        message:
          enabled
            ? "Premium accordé au serveur."
            : "Premium retiré du serveur.",
        data: config
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guild premium error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de modifier le Premium du serveur."
      });
    }
  }
);


/* =========================================================
   GUILD CONFIGURATION SUMMARY
   GET /api/admin/guilds/:guildId/modules
========================================================= */

router.get(
  "/guilds/:guildId/modules",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const guildId =
        String(
          req.params.guildId
        );

      const config =
        await GuildConfig.findOne({
          guildId
        }).lean();

      if (!config) {
        return res.status(404).json({
          success: false,
          error:
            "Serveur introuvable."
        });
      }

      const configData =
        config as any;

      const ignoredKeys = new Set([
        "_id",
        "__v",
        "guildId",
        "guildName",
        "ownerId",
        "createdAt",
        "updatedAt"
      ]);

      const modules: Record<
        string,
        unknown
      > = {};

      for (
        const [
          key,
          value
        ] of Object.entries(
          configData
        )
      ) {
        if (
          ignoredKeys.has(key)
        ) {
          continue;
        }

        modules[key] =
          value;
      }

      return res.json({
        success: true,
        guildId,
        modules
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Guild modules error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les modules du serveur."
      });
    }
  }
);


/* =========================================================
   OWNER AI LOGS
   GET /api/admin/owners/:ownerId/ai-logs
========================================================= */

router.get(
  "/owners/:ownerId/ai-logs",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const ownerId =
        String(
          req.params.ownerId
        );

      const page =
        Math.max(
          1,
          parseInt(
            String(
              req.query.page || "1"
            ),
            10
          ) || 1
        );

      const limit =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(
              String(
                req.query.limit || "50"
              ),
              10
            ) || 50
          )
        );

      const skip =
        (page - 1) * limit;

      const filter: Record<
        string,
        unknown
      > = {
        ownerId
      };

      const {
        start,
        end
      } = getDateRange(req);

      filter.createdAt = {
        $gte: start,
        $lte: end
      };

      if (req.query.guildId) {
        filter.guildId =
          String(
            req.query.guildId
          );
      }

      if (req.query.userId) {
        filter.userId =
          String(
            req.query.userId
          );
      }

      const [
        logs,
        total
      ] = await Promise.all([
        AiLog.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        AiLog.countDocuments(
          filter
        )
      ]);

      return res.json({
        success: true,
        ownerId,
        pagination: {
          page,
          limit,
          total,
          pages:
            Math.ceil(
              total / limit
            )
        },
        data: logs
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Owner AI logs error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les logs IA du propriétaire."
      });
    }
  }
);


/* =========================================================
   AI LOG SUMMARY
   GET /api/admin/ai-summary
========================================================= */

router.get(
  "/ai-summary",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const {
        start,
        end
      } = getDateRange(req);

      const filter = {
        createdAt: {
          $gte: start,
          $lte: end
        }
      };

      const [
        totalRequests,
        totalErrors,
        totalTokens,
        uniqueUsers,
        uniqueGuilds,
        uniqueOwners,
        uniqueSessions
      ] = await Promise.all([
        AiLog.countDocuments(
          filter
        ),

        AiLog.countDocuments({
          ...filter,
          status: "error"
        }),

        AiLog.aggregate([
          {
            $match:
              filter
          },
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  "$totalTokens"
              }
            }
          }
        ]),

        AiLog.distinct(
          "userId",
          filter
        ),

        AiLog.distinct(
          "guildId",
          filter
        ),

        AiLog.distinct(
          "ownerId",
          filter
        ),

        AiLog.distinct(
          "sessionId",
          filter
        )
      ]);

      return res.json({
        success: true,
        period: {
          start,
          end
        },
        requests:
          totalRequests,
        errors:
          totalErrors,
        tokens:
          safeNumber(
            totalTokens?.[0]?.total
          ),
        users:
          uniqueUsers.filter(
            Boolean
          ).length,
        guilds:
          uniqueGuilds.filter(
            Boolean
          ).length,
        owners:
          uniqueOwners.filter(
            Boolean
          ).length,
        sessions:
          uniqueSessions.filter(
            Boolean
          ).length
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] AI summary error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de calculer le résumé IA."
      });
    }
  }
);


/* =========================================================
   SYSTEM INFORMATION
   GET /api/admin/system
========================================================= */

router.get(
  "/system",
  requireStaff,
  async (
    _req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const memory =
        process.memoryUsage();

      const dbState =
        mongoose.connection
          .readyState;

      return res.json({
        success: true,

        application: {
          environment:
            process.env.NODE_ENV ||
            "development",
          nodeVersion:
            process.version,
          platform:
            process.platform,
          architecture:
            process.arch,
          pid:
            process.pid,
          uptime:
            process.uptime()
        },

        memory: {
          rss:
            memory.rss,
          heapTotal:
            memory.heapTotal,
          heapUsed:
            memory.heapUsed,
          external:
            memory.external,
          arrayBuffers:
            memory.arrayBuffers
        },

        database: {
          state:
            dbState,
          connected:
            dbState === 1,
          host:
            mongoose.connection
              .host || null,
          name:
            mongoose.connection
              .name || null
        },

        timestamp:
          new Date()
            .toISOString()
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] System error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de charger les informations système."
      });
    }
  }
);


/* =========================================================
   STAFF ME
   GET /api/admin/me
========================================================= */

router.get(
  "/me",
  requireStaff,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      return res.json({
        success: true,
        staff: {
          id:
            getUserId(req),
          username:
            getUserName(req),
          isAdmin:
            Boolean(
              req.user?.isAdmin
            ),
          isOwner:
            Boolean(
              req.user?.isOwner
            )
        }
      });
    } catch (error) {
      console.error(
        "[OMNIX][ADMIN] Staff me error :",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Impossible de récupérer le profil Staff."
      });
    }
  }
);


/* =========================================================
   FINAL EXPORT
========================================================= */

export default router;