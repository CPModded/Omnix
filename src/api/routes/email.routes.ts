import express, { type Response } from 'express';
import { isAuthenticated, type AuthenticatedRequest } from '../middlewares/auth';
import EmailThread from '../../models/EmailThread';
import EmailMessage from '../../models/EmailMessage';
import User from '../../models/User';
import { isOwner } from './auth.routes';
import { emailConfig, sendEmail, listInbox } from '../../services/email.service';

const router = express.Router();
function isStaff(req: AuthenticatedRequest) {
  const id = req.user?.discordId;
  return Boolean(id && (isOwner(id) || req.user?.isAdmin));
}
function cleanEmail(v: string) { return String(v || '').trim().slice(0,320).toLowerCase(); }
function htmlEscape(v:string){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));}

router.use(isAuthenticated as any);

router.get('/config', async (req:AuthenticatedRequest,res:Response)=>{
  if(!isStaff(req)) return res.status(403).json({success:false,error:'Accès Staff requis.'});
  const c=emailConfig();
  return res.json({success:true,provider:c.provider,from:c.from,fromName:c.fromName,sendConfigured:c.sendConfigured,receiveConfigured:c.receiveConfigured,configured:c.sendConfigured||c.receiveConfigured});
});

router.get('/inbox', async (req:AuthenticatedRequest,res:Response)=>{
  if(!isStaff(req)) return res.status(403).json({success:false,error:'Accès Staff requis.'});
  try { return res.json({success:true,data:await listInbox(Math.min(100,Math.max(1,Number(req.query.limit)||50)))}); }
  catch(error){ return res.status(502).json({success:false,error:error instanceof Error?error.message:'Réception Gmail indisponible.'}); }
});

router.get('/threads',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});const threads=await EmailThread.find({}).sort({updatedAt:-1}).limit(100).lean();return res.json({success:true,data:threads});});
router.get('/threads/:id',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});const thread=await EmailThread.findById(req.params.id).lean();if(!thread)return res.status(404).json({success:false,error:'Conversation introuvable.'});const messages=await EmailMessage.find({threadId:thread._id}).sort({createdAt:1}).lean();return res.json({success:true,thread,messages});});

router.post('/send',async(req:AuthenticatedRequest,res:Response)=>{
  if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});
  try{
    const to=Array.isArray(req.body?.to)?req.body.to.map(cleanEmail).filter((x:string)=>x.includes('@')):[cleanEmail(req.body?.to)].filter((x:string)=>x.includes('@'));
    const subject=String(req.body?.subject||'').trim().slice(0,500);
    const text=String(req.body?.text||'').slice(0,200000);
    const html=typeof req.body?.html==='string'?req.body.html.slice(0,300000):undefined;
    if(!to.length||!subject||!text)return res.status(400).json({success:false,error:'Destinataire, sujet et message obligatoires.'});
    const attachments=Array.isArray(req.body?.attachments)?req.body.attachments.filter((a:any)=>a&&typeof a.contentBase64==='string').slice(0,5).map((a:any)=>({filename:String(a.filename||'attachment').slice(0,255),contentBase64:String(a.contentBase64),contentType:a.contentType})):[];
    const result=await sendEmail({to,subject,text,html,attachments,replyTo:process.env.EMAIL_FROM||emailConfig().from});
    let thread=await EmailThread.findOne({subject,participants:{$all:to}}); if(!thread)thread=await EmailThread.create({subject,participants:to,status:'open',assignedTo:req.user?.discordId});
    await EmailMessage.create({threadId:thread._id,direction:'outbound',from:emailConfig().from,to,cc:[],subject,text,html,attachments:attachments.map(a=>({name:a.filename})),providerId:result.messageId});
    return res.status(201).json({success:true,providerId:result.messageId,threadId:thread._id});
  }catch(error){console.error('[EMAIL SEND]',error);return res.status(502).json({success:false,error:error instanceof Error?error.message:'Envoi Gmail impossible.'});}
});

router.post('/broadcast',async(req:AuthenticatedRequest,res:Response)=>{
  if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});
  try{
    const subject=String(req.body?.subject||'').trim().slice(0,500);
    const text=String(req.body?.text||'').slice(0,200000);
    const html=typeof req.body?.html==='string'?req.body.html.slice(0,300000):undefined;
    if(!subject||!text)return res.status(400).json({success:false,error:'Sujet et message obligatoires.'});
    const users=await User.find({email:{$exists:true,$ne:null}}).select('email username globalName').lean();
    const recipients=Array.from(new Set(users.map((u:any)=>cleanEmail(u.email)).filter((x:string)=>x.includes('@')))) as string[];
    const origin=process.env.CLIENT_URL||process.env.DOMAIN||''; const logo=origin ? `${origin.replace(/\/$/,'')}/logo.png` : ''; const professionalHtml=(html||`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0f172a"><div style="padding:28px;border-radius:18px;background:#0b1220;color:#fff"><h1 style="margin:0">OMNIX</h1></div><div style="padding:28px;border:1px solid #e2e8f0;border-top:0"><div style="white-space:pre-wrap">${htmlEscape(text)}</div>${logo?`<div style="text-align:center;margin-top:30px"><img src="${logo}" alt="OMNIX" style="width:72px;height:72px;border-radius:16px"></div>`:''}<p style="margin-top:18px;color:#64748b">L’équipe d’OMNIX</p></div></div>`); const chunkSize=20; let sent=0; const failures:any[]=[];
    for(let i=0;i<recipients.length;i+=chunkSize){const chunk=recipients.slice(i,i+chunkSize);try{await sendEmail({to:chunk,subject,text,html:professionalHtml,replyTo:emailConfig().from});sent+=chunk.length;}catch(error){failures.push({recipients:chunk,error:error instanceof Error?error.message:'Erreur'});}}
    return res.json({success:true,totalRecipients:recipients.length,sent,failures});
  }catch(error){return res.status(502).json({success:false,error:error instanceof Error?error.message:'Diffusion Gmail impossible.'});}
});

router.get('/recipients',async(req:AuthenticatedRequest,res:Response)=>{if(!isStaff(req))return res.status(403).json({success:false,error:'Accès Staff requis.'});const users=await User.find({email:{$exists:true,$ne:null}}).select('discordId username globalName email').sort({createdAt:-1}).limit(5000).lean();return res.json({success:true,count:users.length,data:users});});

export default router;
