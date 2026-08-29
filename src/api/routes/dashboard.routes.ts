import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';
import { User } from '../../models/User';

const router=Router();

router.get('/dashboard',isAuthenticated as any,(req,res)=>res.render('dashboard',{user:(req as any).user??null,title:'OMNIX — Dashboard'}));

// IMPORTANT: static preferences route must be declared before /dashboard/:guildId.
router.get('/dashboard/preferences', isAuthenticated as any, async (req:any,res)=>{
  try {
    const user=await User.findOne({discordId:String(req.user.discordId)}).select('dashboardPreferences').lean();
    return res.json({success:true,preferences:user?.dashboardPreferences||{}});
  } catch(e){ console.error('[Dashboard Preferences] GET',e); return res.status(500).json({success:false,error:'Impossible de charger les préférences.'}); }
});

router.patch('/dashboard/preferences', isAuthenticated as any, async (req:any,res)=>{
  try {
    const body=req.body||{};
    const preferences={
      compactMode:Boolean(body.compactMode),
      sidebarCollapsed:Boolean(body.sidebarCollapsed),
      animations:body.animations!==false,
      showStats:body.showStats!==false,
      showServers:body.showServers!==false,
      showActivity:body.showActivity!==false,
      showStatistics:body.showStatistics!==false,
      density:body.density==='compact'?'compact':'comfortable'
    };
    const user=await User.findOneAndUpdate({discordId:String(req.user.discordId)},{$set:{dashboardPreferences:preferences}},{new:true,runValidators:true}).select('dashboardPreferences').lean();
    return res.json({success:true,preferences:user?.dashboardPreferences||preferences});
  } catch(e){ console.error('[Dashboard Preferences] PATCH',e); return res.status(500).json({success:false,error:'Impossible d’enregistrer les préférences.'}); }
});

router.get('/dashboard/:guildId',isAuthenticated as any,canManageGuild as any,(req,res)=>{const id=String(req.params.guildId||'');if(!/^\d{17,20}$/.test(id))return res.redirect('/dashboard');return res.render('dashboard',{user:(req as any).user??null,guildId:id,title:'OMNIX — Dashboard'});});

export default router;
