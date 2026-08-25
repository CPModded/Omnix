import express from "express";
import type {
  Request,
  Response,
  NextFunction
} from "express";
import mongoose from "mongoose";
import PricingPlan from "../../models/PricingPlan";
import AiLog from "../../models/AiLog";
import StaffAuditLog from "../../models/StaffAuditLog";
import PlatformEvent from "../../models/PlatformEvent";
import Payment from "../../models/Payment";
import License from "../../models/License";
import PromoCode from "../../models/PromoCode";
import { GuildConfig } from "../../models/GuildConfig";
import User from "../../models/User";
import { isOwner } from "./auth.routes";
import { client as discordClient } from "../../bot/client";
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
async function requireStaff(req: AuthenticatedRequest,res: Response,next: NextFunction){const id=req.user?.discordId||req.user?.id||req.user?.userId;if(!id)return res.status(401).json({success:false,error:'Non authentifié.',code:'AUTH_REQUIRED'});try{if(isOwner(String(id)))return next();const u=await User.findOne({discordId:String(id)}).select('isAdmin role isBlacklisted').lean();if(u?.isBlacklisted)return res.status(403).json({success:false,error:'Compte suspendu.',code:'ACCOUNT_BLACKLISTED'});const role=String((u as any)?.role||'');if(!u?.isAdmin&&!['admin','super_admin','owner'].includes(role))return res.status(403).json({success:false,error:'Accès réservé au Staff OMNIX.',code:'ADMIN_ACCESS_DENIED'});return next();}catch(e){console.error('[ADMIN] Staff check',e);return res.status(500).json({success:false,error:'Erreur interne.',code:'ADMIN_CHECK_ERROR'});}}
/* =========================================================
   PROMO CODES
   GET /api/admin/promos
========================================================= */
router.get('/promos', requireStaff, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await PromoCode.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[OMNIX][ADMIN] Promo list:', error);
    return res.status(500).json({ success:false, error:'Impossible de charger les codes promo.' });
  }
});

router.post('/promos', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const discountType = String(req.body?.discountType || 'percentage');
    const discountValue = Number(req.body?.discountValue);
    const maxUses = Math.max(0, Number(req.body?.maxUses || 0));
    const expiresAt = normalizeDate(req.body?.expiresAt);
    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) return res.status(400).json({success:false,error:'Code promo invalide.'});
    if (!['percentage','fixed'].includes(discountType)) return res.status(400).json({success:false,error:'Type de remise invalide.'});
    if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType==='percentage' && discountValue>100)) return res.status(400).json({success:false,error:'Valeur de remise invalide.'});
    if (!expiresAt || expiresAt <= new Date()) return res.status(400).json({success:false,error:'La date d’expiration doit être future.'});
    const exists = await PromoCode.findOne({code}).lean();
    if (exists) return res.status(409).json({success:false,error:'Ce code promo existe déjà.'});
    const emailEnabled=Boolean(req.body?.emailEnabled); const emailSubject=String(req.body?.emailSubject||'Promotion OMNIX').slice(0,300); const emailBody=String(req.body?.emailBody||'').slice(0,10000); const autoEmailOnCreate=Boolean(req.body?.autoEmailOnCreate);
    const promo = await PromoCode.create({code,discountType,discountValue,maxUses,usesCount:0,expiresAt,isActive:true,emailEnabled,emailSubject,emailBody,autoEmailOnCreate});
    await writeAudit(req,{action:'create',category:'pricing',description:`Création du code promo ${code}`,targetType:'PromoCode',targetId:String(promo._id),targetName:code,newValue:{discountType,discountValue,maxUses,expiresAt}});
    return res.status(201).json({success:true,data:promo});
  } catch (error) { console.error('[OMNIX][ADMIN] Promo create:',error); return res.status(500).json({success:false,error:'Impossible de créer le code promo.'}); }
});

router.patch('/promos/:code', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try { const code=String(req.params.code||'').toUpperCase(); const promo=await PromoCode.findOne({code}); if(!promo)return res.status(404).json({success:false,error:'Code promo introuvable.'}); if(typeof req.body?.isActive==='boolean') promo.isActive=req.body.isActive; if(req.body?.expiresAt){const d=normalizeDate(req.body.expiresAt);if(!d)return res.status(400).json({success:false,error:'Date invalide.'});promo.expiresAt=d;} await promo.save(); await writeAudit(req,{action:promo.isActive?'enable':'disable',category:'pricing',description:`Code promo ${code} ${promo.isActive?'activé':'désactivé'}`,targetType:'PromoCode',targetId:String(promo._id),targetName:code}); return res.json({success:true,data:promo}); } catch(error){console.error('[OMNIX][ADMIN] Promo update:',error);return res.status(500).json({success:false,error:'Impossible de modifier le code promo.'});}
});

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
        auditCount,
        premiumUsers,
        revenue
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments(
          dateFilter
        ),
        Promise.resolve(Math.max(Number(discordClient?.guilds?.cache?.size ?? 0), await GuildConfig.countDocuments({}))),
        PricingPlan.countDocuments({}),
        License.countDocuments({ status: { $in: ['active','used'] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
        AiLog.countDocuments(
          dateFilter
        ),
        AiLog.countDocuments({
          ...dateFilter,
          status: "error"
        }),
        StaffAuditLog.countDocuments(
          dateFilter
        ),
        User.countDocuments({ isPremium: true }),
        Payment.aggregate([
          { $match: { ...dateFilter, status: 'paid' } },
          { $group: { _id: '$currency', amount: { $sum: '$amount' }, count: { $sum: 1 } } }
        ])
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
      const staffUser = req.user ? {
        discordId: String(req.user.discordId || req.user.id || req.user.userId || ''),
        username: String(req.user.username || req.user.tag || req.user.discordId || 'Staff OMNIX'),
        role: String(req.user.isOwner ? 'owner' : 'staff')
      } : null;
      return res.json({
        success: true,
        user: staffUser,
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
            ),
          premium:
            safeNumber(premiumUsers)
        },
        payments: {
          revenue
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
            safeNumber(premiumPlans),
          active:
            safeNumber(activePlans)
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { start, end } = getDateRange(req);
      const [events, legacy] = await Promise.all([
        PlatformEvent.aggregate([
          { $match: { type: 'guild_added', createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        GuildConfig.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ])
      ]);
      const merged = new Map<string, number>();
      for (const row of legacy) merged.set(row._id, safeNumber(row.count));
      for (const row of events) merged.set(row._id, Math.max(merged.get(row._id) || 0, safeNumber(row.count)));
      return res.json({ success: true, period: { start, end }, data: [...merged.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date,count]) => ({date,count})) });
    } catch (error) {
      console.error('[OMNIX][ADMIN] Guild statistics error:', error);
      return res.status(500).json({ success: false, error: 'Impossible de charger les statistiques serveurs.' });
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
            name: {
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
            name: {
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
========================================================= *

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
            name: {
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
            String((config as any).name || guildId),
          guildId,
          guildName:
            String((config as any).name || guildId),
          ownerId:
            String((config as any).ownerId || ""),
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
        "name",
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
   EXTENDED ADMIN CONTROL API
========================================================= */
router.get('/events', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter: any = {};
    if (req.query.type) filter.type = String(req.query.type);
    const { start, end } = getDateRange(req); filter.createdAt = { $gte: start, $lte: end };
    const [data,total] = await Promise.all([PlatformEvent.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(), PlatformEvent.countDocuments(filter)]);
    return res.json({ success:true, pagination:{page,limit,total,pages:Math.ceil(total/limit)}, data });
  } catch (error) { console.error('[ADMIN] events', error); return res.status(500).json({success:false,error:'Impossible de charger les événements.'}); }
});

router.get('/audit-logs', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page=Math.max(1,Number(req.query.page)||1), limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
    const filter:any={}; if(req.query.staffId) filter.staffId=String(req.query.staffId); if(req.query.category) filter.category=String(req.query.category); if(req.query.status) filter.status=String(req.query.status);
    const {start,end}=getDateRange(req); filter.createdAt={$gte:start,$lte:end};
    const [data,total]=await Promise.all([StaffAuditLog.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),StaffAuditLog.countDocuments(filter)]);
    return res.json({success:true,pagination:{page,limit,total,pages:Math.ceil(total/limit)},data});
  } catch(error){return res.status(500).json({success:false,error:'Impossible de charger les audits.'});}
});


router.get('/staff', requireStaff, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await User.find({ $or: [{ isAdmin: true }, { role: { $in: ['support','moderator','admin','super_admin','owner'] } }] }).select('discordId username globalName avatar role permissions isAdmin isPremium lastLogin createdAt').sort({ role: 1, username: 1 }).lean();
    return res.json({ success: true, data: staff });
  } catch (error) { return res.status(500).json({ success:false,error:'Impossible de charger les administrateurs.'}); }
});

router.patch('/users/:discordId/premium', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try { const id=String(req.params.discordId); const target=await User.findOne({discordId:id}); if(!target)return res.status(404).json({success:false,error:'Utilisateur introuvable.'}); const value=Boolean(req.body?.isPremium); const previous=target.isPremium; target.isPremium=value; await target.save(); await writeAudit(req,{action:'update',category:'premium',description:`Premium ${id}: ${previous} → ${value}`,targetType:'User',targetId:id,newValue:{isPremium:value}}); return res.json({success:true,user:{discordId:id,isPremium:value}}); } catch(error){return res.status(500).json({success:false,error:'Impossible de modifier Premium.'});}
});
router.get('/users/:discordId', requireStaff, async (req: AuthenticatedRequest,res:Response)=>{
  try { const id=String(req.params.discordId); const user=await User.findOne({discordId:id}).select('-accessToken -refreshToken -tokenExpiresAt').lean(); if(!user)return res.status(404).json({success:false,error:'Utilisateur introuvable.'}); const [ai,payments,licenses]=await Promise.all([AiLog.find({userId:id}).sort({createdAt:-1}).limit(50).lean(),Payment.find({userId:id}).sort({createdAt:-1}).limit(50).lean(),License.find({buyerId:id}).sort({createdAt:-1}).limit(50).lean()]); return res.json({success:true,user,ai,payments,licenses}); }
  catch(error){return res.status(500).json({success:false,error:'Impossible de charger l’utilisateur.'});}
});

router.patch('/users/:discordId/role', requireStaff, async (req: AuthenticatedRequest,res:Response)=>{
  try { const id=String(req.params.discordId), role=String(req.body?.role||'user'); const allowed=['user','support','moderator','admin','super_admin','owner']; if(!allowed.includes(role))return res.status(400).json({success:false,error:'Rôle invalide.'}); if(role==='owner'&&!isOwner(id)) return res.status(403).json({success:false,error:'Un Owner doit être défini par OWNER_IDS.'}); const target=await User.findOne({discordId:id}); if(!target)return res.status(404).json({success:false,error:'Utilisateur introuvable.'}); const actor=getUserId(req); if(role==='owner'&&actor!==id&&!isOwner(actor||''))return res.status(403).json({success:false,error:'Action Owner réservée au Owner.'}); const previous=target.role; target.role=role as any; target.isAdmin=['admin','super_admin','owner'].includes(role)||isOwner(id); await target.save(); await writeAudit(req,{action:'update',category:'staff',description:`Rôle ${id}: ${previous} → ${role}`,targetType:'User',targetId:id,previousValue:{role:previous},newValue:{role}}); return res.json({success:true,user:{discordId:id,role:target.role,isAdmin:target.isAdmin}}); }
  catch(error){return res.status(500).json({success:false,error:'Impossible de modifier le rôle.'});}
});

router.get('/payments', requireStaff, async (req: AuthenticatedRequest,res:Response)=>{
  try { const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||50)); const {start,end}=getDateRange(req); const filter:any={createdAt:{$gte:start,$lte:end}}; if(req.query.userId)filter.userId=String(req.query.userId); if(req.query.status)filter.status=String(req.query.status); const [data,total,revenue]=await Promise.all([Payment.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Payment.countDocuments(filter),Payment.aggregate([{$match:filter},{$match:{status:'paid'}},{$group:{_id:'$currency',amount:{$sum:'$amount'}}}])]); return res.json({success:true,pagination:{page,limit,total,pages:Math.ceil(total/limit)},revenue,data}); }
  catch(error){return res.status(500).json({success:false,error:'Impossible de charger les paiements.'});}
});

router.get('/bot', requireStaff, async (_req:AuthenticatedRequest,res:Response)=>{ const c:any=discordClient; let members=0; for(const g of c?.guilds?.cache?.values?.()||[])members+=Number(g.memberCount||0); return res.json({success:true,ready:Boolean(c?.isReady?.()),uptime:process.uptime(),ping:Number.isFinite(c?.ws?.ping)?Math.round(c.ws.ping):null,guilds:Number(c?.guilds?.cache?.size||0),members,commands:Number(c?.commands?.size||0)}); });

router.get('/health/full', requireStaff, async (_req:AuthenticatedRequest,res:Response)=>{ const c:any=discordClient; const db=mongoose.connection.readyState===1; const memory=process.memoryUsage(); return res.json({success:true,services:{api:true,discord:Boolean(c?.isReady?.()),mongodb:db,stripe:Boolean(process.env.STRIPE_SECRET_KEY||process.env.PAYMENTS_STRIPE_SECRET_KEY),email:Boolean(process.env.RESEND_API_KEY||process.env.EMAIL_API_KEY)},system:{node:process.version,platform:process.platform,uptime:process.uptime(),memory},timestamp:new Date().toISOString()}); });

router.get('/analytics', requireStaff, async (req:AuthenticatedRequest,res:Response)=>{ try { const {start,end}=getDateRange(req); const filter={createdAt:{$gte:start,$lte:end}}; const [events,payments,aiErrors]=await Promise.all([PlatformEvent.aggregate([{$match:filter},{$group:{_id:'$type',count:{$sum:1}}}]),Payment.aggregate([{$match:{...filter,status:'paid'}},{$group:{_id:'$currency',amount:{$sum:'$amount'},count:{$sum:1}}}]),AiLog.countDocuments({...filter,status:'error'})]); const [totalUsers,totalGuilds,totalAiRequests,totalAiTokens]=await Promise.all([User.countDocuments(),GuildConfig.countDocuments(),AiLog.countDocuments({createdAt:{$gte:start,$lte:end}}),AiLog.aggregate([{$match:filter},{$group:{_id:null,tokens:{$sum:'$totalTokens'}}}])]); return res.json({success:true,period:{start,end},events,payments,aiErrors,totalUsers,totalGuilds,totalAiRequests,totalAiTokens:Number(totalAiTokens?.[0]?.tokens||0)}); }catch(error){return res.status(500).json({success:false,error:'Impossible de charger les analytics.'});} });


router.post('/pricing/seed', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const defaults = [
      {name:'Premium Mensuel',slug:'premium-mensuel',description:'OMNIX Premium pendant 30 jours.',price:8.99,currency:'EUR',durationDays:30,durationLabel:'30 jours',active:true,featured:true,sortOrder:1,features:[{name:'Fonctionnalités Premium',enabled:true},{name:'Statistiques avancées',enabled:true},{name:'IA étendue',enabled:true}]},
      {name:'Premium 90 jours',slug:'premium-90-jours',description:'OMNIX Premium pendant 90 jours.',price:23.99,currency:'EUR',durationDays:90,durationLabel:'90 jours',active:true,featured:false,sortOrder:2,features:[{name:'Fonctionnalités Premium',enabled:true},{name:'Statistiques avancées',enabled:true},{name:'IA étendue',enabled:true}]},
      {name:'Premium 6 mois',slug:'premium-6-mois',description:'OMNIX Premium pendant 6 mois.',price:44.99,currency:'EUR',durationDays:180,durationLabel:'6 mois',active:true,featured:false,sortOrder:3,features:[{name:'Toutes les fonctionnalités Premium',enabled:true},{name:'IA étendue',enabled:true}]},
      {name:'Premium Annuel',slug:'premium-annuel',description:'OMNIX Premium pendant 365 jours.',price:79.99,currency:'EUR',durationDays:365,durationLabel:'365 jours',active:true,featured:false,sortOrder:4,features:[{name:'Toutes les fonctionnalités Premium',enabled:true},{name:'Support prioritaire',enabled:true}]}
    ];
    const created=[]; for(const plan of defaults){ const exists=await PricingPlan.findOne({slug:plan.slug}); if(!exists) created.push(await PricingPlan.create(plan)); }
    return res.json({success:true,created:created.length,data:created});
  } catch(error){return res.status(500).json({success:false,error:'Impossible d’initialiser les abonnements.'});}
});

/* =========================================================
   FINAL EXPORT
========================================================= */

export default router;