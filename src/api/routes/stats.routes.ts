import express from 'express';
import type { Request, Response } from 'express';
import { User } from '../../models/User';
const router=express.Router();
const client=()=> (globalThis as any).omnixDiscordClient;
router.get('/stats',async(_req:Request,res:Response)=>{try{const c=client(),guilds=Number(c?.guilds?.cache?.size??0);let members=0;for(const g of c?.guilds?.cache?.values?.()??[])members+=Number(g?.memberCount??0);const p=Number(c?.ws?.ping),ping=Number.isFinite(p)&&p>=0?Math.round(p):null;const commands=Number(c?.commands?.size??0),totalUsers=await User.countDocuments().catch(()=>0);return res.json({success:true,bot:{ready:Boolean(c?.isReady?.()),ping,guildsCount:guilds,membersCount:members,totalMembers:members,commandsCount:commands,uptimeSeconds:Math.floor(process.uptime())},servers:guilds,guilds,members,commands,ping,database:{totalUsers,totalMembers:members},uptime:Math.floor(process.uptime())});}catch(e){console.error('[STATS]',e);return res.status(500).json({success:false,error:'INTERNAL_SERVER_ERROR'});}});
router.get('/stats/health',async(_req,res)=>{const c=client(),discord=Boolean(c?.isReady?.());const mongo=await User.exists({}).then(()=>true).catch(()=>false);return res.status(discord&&mongo?200:503).json({success:discord&&mongo,service:'OMNIX',status:discord&&mongo?'online':'degraded',discord:discord?'connected':'disconnected',database:mongo?'connected':'unavailable',timestamp:new Date().toISOString()});});
export default router;
