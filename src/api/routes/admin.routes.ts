import express from "express";
import type {
  Request,
  Response,
  NextFunction
} from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import PricingPlan from "../../models/PricingPlan";
import PricingOffer from "../../models/PricingOffer";
import AiLog from "../../models/AiLog";
import StaffAuditLog from "../../models/StaffAuditLog";
import PlatformEvent from "../../models/PlatformEvent";
import Payment from "../../models/Payment";
import License from "../../models/License";
import PromoCode from "../../models/PromoCode";
import { GuildConfig } from "../../models/GuildConfig";
import User from "../../models/User";
import { isOwner } from "./auth.routes";
import { sendEmail, emailConfig } from '../../services/email.service';
import { client as discordClient } from "../../bot/client";
import SiteSettings, { type BotActivityType } from "../../models/SiteSettings";
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
function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const id = getUserId(req);
  if (!id || !isOwner(id)) return res.status(403).json({ success:false, error:'Action réservée au Founder / Owner.' });
  next();
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
      | "staff"
      | "premium";
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
    if (emailEnabled && autoEmailOnCreate) {
      void (async () => {
        try {
          const users = await User.find({email:{$exists:true,$ne:null}}).select('email').lean();
          const recipients=Array.from(new Set(users.map((u:any)=>String(u.email||'').trim().toLowerCase()).filter((e:string)=>e.includes('@')))) as string[];
          if (recipients.length && emailConfig().sendConfigured) {
            const promoText = emailBody || `Profitez de notre code promo ${code} avant le ${expiresAt.toLocaleDateString('fr-FR')}.`;
            const safe = promoText.replace(/\{CODE\}/g, code);
            await sendEmail({to:recipients,subject:emailSubject || `Promotion OMNIX — ${code}`,text:safe,html:`<div style=\"font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px\"><h2 style=\"margin-top:0\">OMNIX</h2><p>${safe.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</p><p style=\"font-size:24px;font-weight:800;letter-spacing:2px\">${code}</p><p style=\"color:#64748b\">L’équipe d’OMNIX</p></div>`});
          }
        } catch (mailError) { console.error('[ADMIN PROMO EMAIL]', mailError); }
      })();
    }
    return res.status(201).json({success:true,data:promo,emailQueued:Boolean(emailEnabled&&autoEmailOnCreate)});
  } catch (error) { console.error('[OMNIX][ADMIN] Promo create:',error); return res.status(500).json({success:false,error:'Impossible de créer le code promo.'}); }
});

router.patch('/promos/:code', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try { const code=String(req.params.code||'').toUpperCase(); const promo=await PromoCode.findOne({code}); if(!promo)return res.status(404).json({success:false,error:'Code promo introuvable.'}); if(typeof req.body?.isActive==='boolean') promo.isActive=req.body.isActive; if(req.body?.expiresAt){const d=normalizeDate(req.body.expiresAt);if(!d)return res.status(400).json({success:false,error:'Date invalide.'});promo.expiresAt=d;} await promo.save(); await writeAudit(req,{action:promo.isActive?'enable':'disable',category:'pricing',description:`Code promo ${code} ${promo.isActive?'activé':'désactivé'}`,targetType:'PromoCode',targetId:String(promo._id),targetName:code}); return res.json({success:true,data:promo}); } catch(error){console.error('[OMNIX][ADMIN] Promo update:',error);return res.status(500).json({success:false,error:'Impossible de modifier le code promo.'});}
});

router.delete('/promos/:code', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const promo = await PromoCode.findOne({ code });
    if (!promo) return res.status(404).json({ success: false, error: 'Code promo introuvable.' });
    await PromoCode.deleteOne({ _id: promo._id });
    await writeAudit(req, {
      action: 'delete',
      category: 'pricing',
      description: `Suppression du code promo ${code}`,
      targetType: 'PromoCode',
      targetId: String(promo._id),
      targetName: code,
    });
    return res.json({ success: true, deleted: code });
  } catch (error) {
    console.error('[OMNIX][ADMIN] Promo delete:', error);
    return res.status(500).json({ success: false, error: 'Impossible de supprimer le code promo.' });
  }
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
        blacklistedUsers,
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
        User.countDocuments({ isBlacklisted: true }),
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
      let liveMembers = 0;
      let liveChannels = 0;
      let liveRoles = 0;
      for (const guild of discordClient?.guilds?.cache?.values?.() || []) {
        liveMembers += Number(guild.memberCount || 0);
        liveChannels += Number(guild.channels?.cache?.size || 0);
        liveRoles += Number(guild.roles?.cache?.size || 0);
      }
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
            safeNumber(premiumUsers),
          blacklisted:
            safeNumber(blacklistedUsers)
        },
        payments: {
          revenue
        },
        guilds: {
          total:
            safeNumber(
              totalGuilds
            ),
          members: liveMembers,
          channels: liveChannels,
          roles: liveRoles,
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
          discordReady: Boolean(discordClient?.isReady?.()),
          discordPing: Number.isFinite(discordClient?.ws?.ping) ? Math.round(discordClient.ws.ping) : null,
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
function fillDaily(start: Date, end: Date, rows: Array<{date:string,count?:number,requests?:number,errors?:number,tokens?:number}>) {
  const map=new Map(rows.map(r=>[r.date,r])); const out:any[]=[]; const d=new Date(start); d.setUTCHours(0,0,0,0); const last=new Date(end); last.setUTCHours(0,0,0,0);
  for(;d<=last;d.setUTCDate(d.getUTCDate()+1)){const date=d.toISOString().slice(0,10); const r:any=map.get(date)||{}; out.push({date,count:Number(r.count||0),requests:Number(r.requests||0),errors:Number(r.errors||0),tokens:Number(r.tokens||0)});} return out;
}

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
        data: fillDaily(start,end,rows.map((row:any)=>({date:row._id,count:safeNumber(row.count)})))
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
      return res.json({ success: true, period: { start, end }, data: fillDaily(start,end,[...merged.entries()].map(([date,count])=>({date,count}))) });
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
        period: { start, end },
        data: fillDaily(start,end,rows.map((row:any)=>({
          date: row._id,
          requests: safeNumber(row.requests),
          tokens: safeNumber(row.tokens),
          errors: safeNumber(row.errors)
        })))
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
      const live = (discordClient as any)?.guilds?.cache;
      const data = guilds.map((g:any) => {
        const id = String(g.guildId);
        const lg = live?.get?.(id);
        return {
          ...g,
          name: lg?.name || g.name || 'Serveur Discord',
          icon: lg?.iconURL?.({extension:'png',size:128}) || g.icon || null,
          memberCount: Number(lg?.memberCount ?? g.memberCount ?? 0),
          botPresent: Boolean(lg),
          ownerId: lg?.ownerId || g.ownerId || null,
          blacklisted: Boolean(g.blacklisted)
        };
      });
      return res.json({ success:true, pagination:{ page, limit, total, pages:Math.ceil(total/limit) }, data });
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
      const liveGuild = (discordClient as any)?.guilds?.cache?.get?.(guildId);
      const [aiRequests, aiErrors, aiTokens, events] = await Promise.all([
        AiLog.countDocuments({ guildId }),
        AiLog.countDocuments({ guildId, status:'error' }),
        AiLog.aggregate([{ $match:{guildId} }, { $group:{_id:null,total:{$sum:'$totalTokens'}} }]),
        PlatformEvent.find({ guildId }).sort({createdAt:-1}).limit(100).lean()
      ]);
      let membersSnapshot:any[] = [];
      if (liveGuild) {
        membersSnapshot = [...liveGuild.members.cache.values()].slice(0,100).map((m:any)=>({
          id:m.id, username:m.user?.username||m.displayName||'Utilisateur', displayName:m.displayName,
          avatar:m.user?.displayAvatarURL?.({extension:'png',size:64})||null, bot:Boolean(m.user?.bot),
          owner:m.id===liveGuild.ownerId, administrator:Boolean(m.permissions?.has?.('Administrator')),
          joinedAt:m.joinedAt || null, roles:[...m.roles.cache.values()].filter((r:any)=>r.id!==liveGuild.id).slice(0,20).map((r:any)=>({id:r.id,name:r.name,color:r.hexColor}))
        }));
      }
      const channels = liveGuild ? [...liveGuild.channels.cache.values()].map((c:any)=>({id:c.id,name:c.name,type:c.type,parentId:c.parentId||null,position:c.position})) .slice(0,200) : [];
      const roles = liveGuild ? [...liveGuild.roles.cache.values()].filter((r:any)=>r.id!==liveGuild.id).sort((a:any,b:any)=>b.position-a.position).slice(0,200).map((r:any)=>({id:r.id,name:r.name,color:r.hexColor,position:r.position,managed:Boolean(r.managed),mentionable:Boolean(r.mentionable)})) : [];
      const administrators = membersSnapshot.filter((m:any)=>!m.bot && (m.administrator || m.owner));
      const resultGuild = { ...config, description: liveGuild?.description || null, name: liveGuild?.name || config.name || 'Serveur Discord', icon: liveGuild?.iconURL?.({extension:'png',size:256}) || config.icon || null, memberCount:Number(liveGuild?.memberCount ?? (config as any).memberCount ?? 0), ownerId: liveGuild?.ownerId || (config as any).ownerId || null, botPresent:Boolean(liveGuild), blacklisted:Boolean((config as any).blacklisted), administrators, membersSnapshot, channels, roles,
        verification: {
          ownerTag: liveGuild?.members?.cache?.get?.(liveGuild?.ownerId)?.user?.tag || null,
          vanityUrl: liveGuild?.vanityURL || null,
          boostLevel: liveGuild?.premiumTier || null,
          boosts: Number(liveGuild?.premiumSubscriptionCount || 0),
          features: Array.isArray(liveGuild?.features) ? liveGuild.features : []
        }
      };
      return res.json({ success:true, guild:resultGuild, ai:{requests:aiRequests,errors:aiErrors,tokens:safeNumber(aiTokens?.[0]?.total)}, events });
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

      const userDiscordId = String((user as any).discordId || userId);
      const [
        aiRequests,
        aiErrors,
        aiTokens,
        aiSessions,
        payments,
        licenses,
        events
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
          { userId: userDiscordId, sessionId: { $exists: true, $ne: null } }
        ),
        Payment.find({ userId: userDiscordId }).sort({ createdAt: -1 }).limit(50).lean(),
        License.find({ buyerId: userDiscordId }).sort({ createdAt: -1 }).limit(50).lean(),
        PlatformEvent.find({ userId: userDiscordId }).sort({ createdAt: -1 }).limit(100).lean()
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
        },
        payments,
        licenses,
        events
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
   AI CONVERSATIONS — grouped per person/session
========================================================= */
router.get('/ai-conversations', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await AiLog.aggregate([
      { $sort: { createdAt: 1 } },
      { $group: { _id: { userId: '$userId', sessionId: '$sessionId' }, username: { $last: '$username' }, userTag: { $last: '$userTag' }, guildId: { $last: '$guildId' }, guildName: { $last: '$guildName' }, source: { $last: '$source' }, createdAt: { $min: '$createdAt' }, updatedAt: { $max: '$createdAt' }, requests: { $sum: 1 }, errors: { $sum: { $cond: [{ $eq: ['$status','error'] },1,0] } } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 200 }
    ]);
    return res.json({success:true,data:rows.map((r:any)=>({sessionId:r._id.sessionId||r._id.userId,userId:r._id.userId,username:r.username||r.userTag||r._id.userId, guildId:r.guildId,guildName:r.guildName,source:r.source,createdAt:r.createdAt,updatedAt:r.updatedAt,requests:r.requests,errors:r.errors}))});
  } catch(error){return res.status(500).json({success:false,error:'Impossible de charger les conversations IA.'});}
});

router.get('/ai-conversations/:sessionId', requireStaff, async (req: AuthenticatedRequest,res:Response)=>{
  try{const sessionId=String(req.params.sessionId);const rows=await AiLog.find({sessionId}).sort({createdAt:1}).lean();return res.json({success:true,data:rows});}
  catch(error){return res.status(500).json({success:false,error:'Impossible de charger la conversation IA.'});}
});

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
    const filter:any={}; if(req.query.staffId) filter.staffId=String(req.query.staffId); if(req.query.category) filter.category=String(req.query.category); if(req.query.status) filter.status=String(req.query.status); if(req.query.action) filter.action=String(req.query.action); if(req.query.targetId) filter.targetId=String(req.query.targetId); if(req.query.search){ const q=String(req.query.search); filter.$or=[{staffUsername:{$regex:q,$options:'i'}},{description:{$regex:q,$options:'i'}},{targetName:{$regex:q,$options:'i'}},{targetId:{$regex:q,$options:'i'}}]; }
    const {start,end}=getDateRange(req); filter.createdAt={$gte:start,$lte:end};
    const [data,total]=await Promise.all([StaffAuditLog.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),StaffAuditLog.countDocuments(filter)]);
    return res.json({success:true,pagination:{page,limit,total,pages:Math.ceil(total/limit)},data});
  } catch(error){return res.status(500).json({success:false,error:'Impossible de charger les audits.'});}
});


router.patch('/guilds/:guildId/blacklist', requireStaff, async (req: AuthenticatedRequest,res:Response)=>{ try { const guildId=String(req.params.guildId); const enabled=req.body?.enabled!==false; const reason=String(req.body?.reason||'').slice(0,500)||null; const config=await GuildConfig.findOneAndUpdate({guildId},{$set:{blacklisted:enabled,blacklistReason:enabled?reason:null,blacklistedAt:enabled?new Date():null},$setOnInsert:{guildId}},{new:true,upsert:true}); await writeAudit(req,{action:enabled?'enable':'disable',category:'guild',description:`Blacklist serveur ${guildId}: ${enabled?'activée':'désactivée'}`,targetType:'Guild',targetId:guildId,newValue:{blacklisted:enabled,reason}}); return res.json({success:true,blacklisted:enabled}); } catch(error){return res.status(500).json({success:false,error:'Impossible de modifier la blacklist du serveur.'});} });

router.get('/staff', requireStaff, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await User.find({ $or: [{ isAdmin: true }, { role: { $in: ['support','moderator','admin','super_admin','owner'] } }] }).select('discordId username globalName avatar role permissions isAdmin isPremium lastLogin createdAt').sort({ role: 1, username: 1 }).lean();
    return res.json({ success: true, data: staff });
  } catch (error) { return res.status(500).json({ success:false,error:'Impossible de charger les administrateurs.'}); }
});

router.patch('/users/:discordId/premium', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id=String(req.params.discordId);
    const target=await User.findOne({discordId:id});
    if(!target)return res.status(404).json({success:false,error:'Utilisateur introuvable.'});
    const value=Boolean(req.body?.isPremium);
    const days=Math.max(0, Number(req.body?.durationDays ?? 30));
    await License.updateMany({buyerId:id,status:'active'},{$set:{status:'suspended'}});
    let expiresAt:null|Date=null;
    if(value){
      if(!Number.isInteger(days) || days<0 || days>3650)return res.status(400).json({success:false,error:'Durée Premium invalide.'});
      expiresAt=days===0?null:new Date(Date.now()+days*86400000);
      await License.create({key:`OMNIX-ADMIN-${crypto.randomBytes(10).toString('hex').toUpperCase()}`,tier:days===0?'lifetime':'premium',status:'active',buyerId:id,activatedGuildId:null,activatedAt:null,expiresAt,durationInDays:days});
    }
    const previous=target.isPremium; target.isPremium=value; await target.save();
    await writeAudit(req,{action:value?'grant':'revoke',category:'premium',description:`Premium ${id}: ${previous} → ${value} (${days} jours)`,targetType:'User',targetId:id,newValue:{isPremium:value,durationDays:days,expiresAt}});
    return res.json({success:true,user:{discordId:id,isPremium:value,expiresAt}});
  } catch(error){return res.status(500).json({success:false,error:'Impossible de modifier Premium.'});}
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

router.get('/health/full', requireStaff, async (_req:AuthenticatedRequest,res:Response)=>{ const c:any=discordClient; const db=mongoose.connection.readyState===1; const memory=process.memoryUsage(); const email=emailConfig(); return res.json({success:true,services:{api:true,discord:Boolean(c?.isReady?.()),mongodb:db,stripe:Boolean(process.env.STRIPE_SECRET_KEY||process.env.PAYMENTS_STRIPE_SECRET_KEY),email:email.sendConfigured||email.receiveConfigured},system:{node:process.version,platform:process.platform,architecture:process.arch,uptime:process.uptime(),memory},email:{provider:email.provider,send:email.sendConfigured,receive:email.receiveConfigured,from:email.from},timestamp:new Date().toISOString()}); });

router.get('/analytics', requireStaff, async (req:AuthenticatedRequest,res:Response)=>{ try { const {start,end}=getDateRange(req); const filter={createdAt:{$gte:start,$lte:end}}; const [events,payments,aiErrors]=await Promise.all([PlatformEvent.aggregate([{$match:filter},{$group:{_id:'$type',count:{$sum:1}}}]),Payment.aggregate([{$match:{...filter,status:'paid'}},{$group:{_id:'$currency',amount:{$sum:'$amount'},count:{$sum:1}}}]),AiLog.countDocuments({...filter,status:'error'})]); const [totalUsers,totalGuilds,totalAiRequests,totalAiTokens]=await Promise.all([User.countDocuments(),GuildConfig.countDocuments(),AiLog.countDocuments({createdAt:{$gte:start,$lte:end}}),AiLog.aggregate([{$match:filter},{$group:{_id:null,tokens:{$sum:'$totalTokens'}}}])]); return res.json({success:true,period:{start,end},events,payments,aiErrors,totalUsers,totalGuilds,totalAiRequests,totalAiTokens:Number(totalAiTokens?.[0]?.tokens||0)}); }catch(error){return res.status(500).json({success:false,error:'Impossible de charger les analytics.'});} });


router.get('/pricing', requireStaff, async (_req: AuthenticatedRequest,res: Response)=>{ try { const offers=await PricingOffer.find().sort({sortOrder:1,price:1,createdAt:1}).lean(); return res.json({success:true,data:offers}); } catch(e){ return res.status(500).json({success:false,error:'Impossible de charger les offres.'}); }});
router.post('/pricing', requireStaff, async (req: AuthenticatedRequest,res: Response)=>{ try { const name=String(req.body?.name||'').trim(); const durationDays=Number(req.body?.durationDays); const price=Number(req.body?.price); const stripeUrl=String(req.body?.stripeUrl||'').trim(); const stripePriceId=req.body?.stripePriceId?String(req.body.stripePriceId).trim():null; if(!name||!Number.isInteger(durationDays)||durationDays<1||!Number.isFinite(price)||price<0)return res.status(400).json({success:false,error:'Nom, durée et prix invalides.'}); if(!stripeUrl || !/^https:\/\/(buy\.stripe\.com|[A-Za-z0-9.-]+\.stripe\.com)\//i.test(stripeUrl))return res.status(400).json({success:false,error:'Lien Stripe invalide.'}); const base=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||`offer-${Date.now()}`; const slug=(await PricingOffer.exists({slug:base}))?`${base}-${Date.now()}`:base; if(req.body?.featured)await PricingOffer.updateMany({},{$set:{featured:false}}); const offer=await PricingOffer.create({name,slug,type:'premium',duration:String(req.body?.duration||`${durationDays} jours`),durationDays,price,currency:String(req.body?.currency||'EUR').toUpperCase(),stripeUrl,stripePriceId,buttonText:String(req.body?.buttonText||"S'abonner"),description:String(req.body?.description||''),featured:Boolean(req.body?.featured),active:req.body?.active!==false,sortOrder:Number(req.body?.sortOrder||0),features:Array.isArray(req.body?.features)?req.body.features:[]}); await writeAudit(req,{action:'create',category:'pricing',description:`Création de l'offre ${name}`,targetType:'PricingOffer',targetId:String(offer._id),targetName:name}); return res.status(201).json({success:true,data:offer}); } catch(e){ return res.status(500).json({success:false,error:'Impossible de créer l’offre.'}); }});
router.patch('/pricing/:id', requireStaff, async (req: AuthenticatedRequest,res: Response)=>{ try { const offer=await PricingOffer.findById(req.params.id); if(!offer)return res.status(404).json({success:false,error:'Offre introuvable.'}); if(typeof req.body?.active==='boolean')offer.active=req.body.active; if(typeof req.body?.featured==='boolean'){offer.featured=req.body.featured;if(offer.featured)await PricingOffer.updateMany({_id:{$ne:offer._id}},{$set:{featured:false}});} await offer.save(); return res.json({success:true,data:offer}); } catch(e){return res.status(500).json({success:false,error:'Impossible de modifier l’offre.'}); }});

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
   BLACKLIST / SECURITY CENTER
========================================================= */
router.get('/blacklist/users', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter:any = { isBlacklisted: true };
    if (search) filter.$or = [
      { discordId: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { globalName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    const data = await User.find(filter).select('-accessToken -refreshToken -tokenExpiresAt').sort({ updatedAt: -1 }).limit(200).lean();
    return res.json({ success:true, total:data.length, data });
  } catch (error) { return res.status(500).json({success:false,error:'Impossible de charger la blacklist.'}); }
});

router.patch('/users/:discordId/blacklist', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.discordId);
    const enabled = req.body?.enabled !== false;
    const reason = String(req.body?.reason || '').trim().slice(0,500);
    const target = await User.findOne({ discordId:id });
    if (!target) return res.status(404).json({success:false,error:'Utilisateur introuvable.'});
    if (enabled && (target.isAdmin || isOwner(id))) return res.status(403).json({success:false,error:'Un membre du Staff/Owner ne peut pas être blacklisté ici.'});
    const previous = Boolean(target.isBlacklisted);
    target.isBlacklisted = enabled;
    await target.save();
    await writeAudit(req,{action:enabled?'enable':'disable',category:'user',description:`Blacklist utilisateur ${id}: ${enabled?'activée':'désactivée'}${reason?` — ${reason}`:''}`,targetType:'User',targetId:id,previousValue:{isBlacklisted:previous},newValue:{isBlacklisted:enabled,reason}});
    return res.json({success:true,isBlacklisted:enabled});
  } catch(error){ return res.status(500).json({success:false,error:'Impossible de modifier la blacklist utilisateur.'}); }
});

router.get('/bot/details', requireStaff, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const c:any = discordClient;
    let members = 0, channels = 0, roles = 0, users = 0;
    const guilds:any[] = [];
    for (const g of c?.guilds?.cache?.values?.() || []) {
      members += Number(g.memberCount || 0);
      channels += Number(g.channels?.cache?.size || 0);
      roles += Number(g.roles?.cache?.size || 0);
      users += Number(g.members?.cache?.size || 0);
      guilds.push({id:g.id,name:g.name,memberCount:Number(g.memberCount||0),channels:Number(g.channels?.cache?.size||0),roles:Number(g.roles?.cache?.size||0),ownerId:g.ownerId,icon:g.iconURL?.({extension:'png',size:128})||null});
    }
    return res.json({success:true, bot:{ready:Boolean(c?.isReady?.()),tag:c?.user?.tag||null,id:c?.user?.id||null,username:c?.user?.username||null,avatar:c?.user?.displayAvatarURL?.({extension:'png',size:128})||null,ping:Number.isFinite(c?.ws?.ping)?Math.round(c.ws.ping):null,uptime:process.uptime(),guilds:guilds.length,members,channels,roles,cachedUsers:users,commands:Number(c?.commands?.size||0),node:process.version,platform:process.platform,architecture:process.arch,memory:process.memoryUsage()}});
  } catch(error){ return res.status(500).json({success:false,error:'Impossible de charger les détails du bot.'}); }
});

/* =========================================================
   OMNIX CONTROL CENTER — BOT PRESENCE / MAINTENANCE
========================================================= */
router.get('/control', requireStaff, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await SiteSettings.findOneAndUpdate({ key:'global' }, { $setOnInsert:{ key:'global' } }, { upsert:true, new:true, setDefaultsOnInsert:true }).lean();
    return res.json({ success:true, data:settings });
  } catch { return res.status(500).json({ success:false,error:'Impossible de charger les paramètres du robot.' }); }
});

router.patch('/control/activity', requireStaff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allowed = ['Playing','Watching','Listening','Competing'];
    const type = String(req.body?.activityType || 'Playing') as BotActivityType;
    const message = String(req.body?.activityMessage || '').trim().slice(0,128);
    const enabled = req.body?.activityEnabled !== false;
    const status = ['online','idle','dnd','invisible'].includes(String(req.body?.botStatus)) ? String(req.body.botStatus) : 'online';
    if (!allowed.includes(type) || (enabled && !message)) return res.status(400).json({success:false,error:'Activité ou message invalide.'});
    const settings = await SiteSettings.findOneAndUpdate({key:'global'},{$set:{activityEnabled:enabled,activityType:type,activityMessage:message,botStatus:status,updatedBy:getUserId(req)}},{upsert:true,new:true,setDefaultsOnInsert:true});
    const c:any = discordClient;
    if (c?.user) c.user.setPresence({ status, activities: enabled && message ? [{ name:message, type: type === 'Playing' ? 0 : type === 'Watching' ? 3 : type === 'Listening' ? 2 : 5 }] : [] });
    await writeAudit(req,{action:'update',category:'bot',description:`Activité du robot modifiée: ${type} ${message}`,targetType:'SiteSettings',targetId:String(settings._id)});
    return res.json({success:true,data:settings});
  } catch { return res.status(500).json({success:false,error:'Impossible de modifier l’activité du robot.'}); }
});

router.patch('/control/maintenance', requireOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const enabled = req.body?.enabled === true;
    const message = String(req.body?.message || 'OMNIX est actuellement en maintenance. Merci de patienter.').trim().slice(0,500);
    const settings = await SiteSettings.findOneAndUpdate({key:'global'},{$set:{maintenance:enabled,maintenanceMessage:message,updatedBy:getUserId(req)}},{upsert:true,new:true,setDefaultsOnInsert:true});
    await writeAudit(req,{action:enabled?'enable':'disable',category:'system',description:`Mode maintenance ${enabled?'activé':'désactivé'}`,targetType:'SiteSettings',targetId:String(settings._id),newValue:{maintenance:enabled,message}});
    return res.json({success:true,data:{maintenance:settings.maintenance,maintenanceMessage:settings.maintenanceMessage}});
  } catch { return res.status(500).json({success:false,error:'Impossible de modifier le mode maintenance.'}); }
});

/* =========================================================
   FINAL EXPORT
========================================================= */

export default router;