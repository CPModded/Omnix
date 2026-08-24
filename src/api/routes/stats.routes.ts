import express from 'express';
import type { Request, Response } from 'express';
import { User } from '../../models/User';
import AiLog from '../../models/AiLog';
import AiSession from '../../models/AiSession';
import GuildConfig from '../../models/GuildConfig';
import License from '../../models/License';
import PlatformEvent from '../../models/PlatformEvent';
import { getRequestToken, verifyJwt } from './auth.routes';

const router = express.Router();
const client=()=> (globalThis as any).omnixDiscordClient;
function range(req:Request){const end=req.query.end?new Date(String(req.query.end)):new Date();const start=req.query.start?new Date(String(req.query.start)):new Date(end.getTime()-30*86400000);return {start,end};}
function valid(d:Date){return !Number.isNaN(d.getTime());}
function currentUser(req:Request){const t=getRequestToken(req);return t?verifyJwt(t):null;}

router.get('/stats',async(req:Request,res:Response)=>{
  try{
    const c=client(), guilds=Number(c?.guilds?.cache?.size??0); let members=0; for(const g of c?.guilds?.cache?.values?.()??[]) members+=Number(g?.memberCount??0);
    const ping=Number(c?.ws?.ping), user=currentUser(req), userId=user?.discordId;
    const [totalUsers, aiLogsRequests, userGuilds, premium, aiSessionStats] = await Promise.all([
      User.countDocuments(),
      userId ? AiLog.countDocuments({userId}) : AiLog.countDocuments(),
      userId ? User.findOne({discordId:userId}).select('guilds').lean() : null,
      userId ? User.findOne({discordId:userId}).select('isPremium').lean() : null,
      userId ? AiSession.aggregate([
        {$match:{userId}},
        {$group:{_id:null,requests:{$sum:'$totalRequests'},tokens:{$sum:'$totalTokens'}}}
      ]) : [],
    ]);
    const aiRequests = Number((aiSessionStats?.[0] as any)?.requests ?? aiLogsRequests ?? 0);
    const [recentAi, recentEvents] = userId ? await Promise.all([
      AiLog.aggregate([{$match:{userId,createdAt:{$gte:new Date(Date.now()-30*86400000)}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},requests:{$sum:1}}},{$sort:{_id:1}}]),
      PlatformEvent.aggregate([{$match:{userId,createdAt:{$gte:new Date(Date.now()-30*86400000)}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}])
    ]) : [[],[]];
    const visibleGuildIds = userId && Array.isArray((userGuilds as any)?.guilds) ? (userGuilds as any).guilds.map((g:any)=>String(g.id)) : [];
    const visibleGuildCount = userId ? visibleGuildIds.length : guilds;
    let visibleMembers = members; if (userId && c?.guilds?.cache) { visibleMembers=0; for(const id of visibleGuildIds){ const g=c.guilds.cache.get(id); if(g) visibleMembers += Number(g.memberCount||0); } }
    return res.json({success:true,bot:{ready:Boolean(c?.isReady?.()),ping:Number.isFinite(ping)&&ping>=0?Math.round(ping):null,guildsCount:guilds,membersCount:members,commandsCount:Number(c?.commands?.size??0),uptimeSeconds:Math.floor(process.uptime())},servers:visibleGuildCount,guilds:visibleGuildCount,members:visibleMembers,commands:Number(c?.commands?.size??0),ping,database:{totalUsers,totalMembers:members},user:userId?{discordId:userId,guildsCount:visibleGuildCount,aiRequests,isPremium:Boolean((premium as any)?.isPremium),plan:Boolean((premium as any)?.isPremium)?'premium':'free',aiActivity:recentAi,activity:recentEvents}:null,uptime:Math.floor(process.uptime()),timestamp:new Date().toISOString()});
  }catch(e){console.error('[STATS]',e);return res.status(500).json({success:false,error:'INTERNAL_SERVER_ERROR'});}
});

router.get('/stats/timeline',async(req,res)=>{try{const {start,end}=range(req);if(!valid(start)||!valid(end))return res.status(400).json({success:false,error:'Période invalide.'});const [users,guilds,ai]=await Promise.all([
 User.aggregate([{$match:{createdAt:{$gte:start,$lte:end}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}]),
 PlatformEvent.aggregate([{$match:{type:'guild_added',createdAt:{$gte:start,$lte:end}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}]),
 AiLog.aggregate([{$match:{createdAt:{$gte:start,$lte:end}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},requests:{$sum:1},errors:{$sum:{$cond:[{$eq:['$status','error']},1,0]}}}},{$sort:{_id:1}}])
]);return res.json({success:true,period:{start,end},users:users.map(x=>({date:x._id,count:x.count})),guilds:guilds.map(x=>({date:x._id,count:x.count})),ai:ai.map(x=>({date:x._id,requests:x.requests,errors:x.errors}))});}catch(e){return res.status(500).json({success:false,error:'Impossible de charger la timeline.'});}});

router.get('/stats/health',async(_req,res)=>{const c=client(),discord=Boolean(c?.isReady?.());const mongo=await User.exists({}).then(()=>true).catch(()=>false);return res.status(discord&&mongo?200:503).json({success:discord&&mongo,service:'OMNIX',status:discord&&mongo?'online':'degraded',discord:discord?'connected':'disconnected',database:mongo?'connected':'unavailable',timestamp:new Date().toISOString()});});
export default router;
