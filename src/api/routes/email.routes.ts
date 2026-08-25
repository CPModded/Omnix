import express, { type Request, type Response } from 'express';
import { isAuthenticated, type AuthenticatedRequest } from '../middlewares/auth';
import { User } from '../../models/User';
import EmailThread from '../../models/EmailThread';
import EmailMessage from '../../models/EmailMessage';
import { isOwner } from './auth.routes';

const router=express.Router();
function isStaff(req:AuthenticatedRequest){const id=req.user?.discordId;return Boolean(id && (isOwner(id) || req.user?.isAdmin));}
function cleanEmail(v:string){return String(v||'').trim().slice(0,320);}

async function sendResend(input:{from:string;to:string[];subject:string;text:string;html?:string;attachments?:Array<{filename:string;content:string}>}){
 const key=process.env.RESEND_API_KEY||process.env.EMAIL_API_KEY; if(!key)throw new Error('RESEND_API_KEY non configurée.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
 if(!r.ok)throw new Error(`Email provider HTTP ${r.status}`); return await r.json() as any;
}

router.use(isAuthenticated as any);

router.get('/config',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});return res.json({success:true,configured:Boolean(process.env.RESEND_API_KEY||process.env.EMAIL_API_KEY),provider:(process.env.RESEND_API_KEY||process.env.EMAIL_API_KEY)?'Resend':'Non configuré',from:process.env.EMAIL_FROM||'',inboundWebhook:Boolean(process.env.EMAIL_WEBHOOK_SECRET)});});

router.get('/threads',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});const threads=await EmailThread.find({}).sort({updatedAt:-1}).limit(100).lean();return res.json({success:true,data:threads});});
router.get('/threads/:id',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});const thread=await EmailThread.findById(req.params.id).lean();if(!thread)return res.status(404).json({success:false,error:'Conversation introuvable.'});const messages=await EmailMessage.find({threadId:thread._id}).sort({createdAt:1}).lean();return res.json({success:true,thread,messages});});
router.post('/send',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});try{const to=Array.isArray(req.body?.to)?req.body.to.map(cleanEmail).filter(Boolean):[cleanEmail(req.body?.to)].filter(Boolean);const subject=String(req.body?.subject||'').trim().slice(0,500);const text=String(req.body?.text||'').slice(0,200000);const from=cleanEmail(req.body?.from||process.env.EMAIL_FROM||'');if(!to.length||!subject||!text||!from)return res.status(400).json({success:false,error:'Destinataire, expéditeur, sujet et message obligatoires.'});const attachments=Array.isArray(req.body?.attachments)?req.body.attachments.filter((a:any)=>a&&typeof a.contentBase64==='string').slice(0,5).map((a:any)=>({filename:String(a.filename||'attachment').slice(0,255),content:String(a.contentBase64)})):[];const provider=await sendResend({from,to,subject,text,html:req.body?.html,attachments});let thread=await EmailThread.findOne({subject,participants:{$all:to}});if(!thread)thread=await EmailThread.create({subject,participants:to,status:'open',assignedTo:req.user?.discordId});await EmailMessage.create({threadId:thread._id,direction:'outbound',from,to,cc:[],subject,text,html:req.body?.html,attachments:attachments.map(a=>({name:a.filename})),providerId:provider?.id});return res.status(201).json({success:true,providerId:provider?.id,threadId:thread._id});}catch(error){console.error('[EMAIL SEND]',error);return res.status(502).json({success:false,error:'Envoi email impossible.'});}});
router.post('/webhook/inbound',async(req:Request,res:Response)=>{try{const secret=process.env.EMAIL_WEBHOOK_SECRET;if(secret&&req.get('x-omnix-email-secret')!==secret)return res.status(401).json({success:false});const from=cleanEmail(req.body?.from);const to=Array.isArray(req.body?.to)?req.body.to.map(cleanEmail):[cleanEmail(req.body?.to)];const subject=String(req.body?.subject||'(sans objet)').slice(0,500);const text=String(req.body?.text||'').slice(0,200000);if(!from||!to.length)return res.status(400).json({success:false,error:'Message entrant invalide.'});let thread=await EmailThread.findOne({subject,participants:from});if(!thread)thread=await EmailThread.create({subject,participants:[from,...to],status:'open'});await EmailMessage.create({threadId:thread._id,direction:'inbound',from,to,cc:[],subject,text,html:req.body?.html,attachments:Array.isArray(req.body?.attachments)?req.body.attachments.slice(0,10):[]});return res.json({success:true,threadId:thread._id});}catch(error){console.error('[EMAIL INBOUND]',error);return res.status(500).json({success:false,error:'Réception email impossible.'});}});
export default router;
