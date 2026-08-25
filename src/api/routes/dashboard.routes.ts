import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';
const router=Router();
router.get('/dashboard',isAuthenticated as any,(req,res)=>res.render('dashboard',{user:(req as any).user??null,title:'OMNIX — Dashboard'}));
router.get('/dashboard/:guildId',isAuthenticated as any,canManageGuild as any,(req,res)=>{const id=String(req.params.guildId||'');if(!/^\d{17,20}$/.test(id))return res.redirect('/dashboard');return res.render('dashboard',{user:(req as any).user??null,guildId:id,title:'OMNIX — Dashboard'});});
export default router;
