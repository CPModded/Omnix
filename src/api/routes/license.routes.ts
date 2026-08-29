import { Router } from 'express';
import { LicenseController } from '../controllers/license.controller';
import { isAuthenticated } from '../middlewares/auth';
import { canManageGuild } from '../middlewares/guildAuth';
import License from '../../models/License';
const router=Router();
router.get('/me', isAuthenticated as any, async (req:any,res)=>{
  try {
    const guildId=String(req.query.guildId||'').trim();
    const now=new Date();
    const q:any={buyerId:String(req.user.discordId),status:{$in:['active','used']},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]};
    if(/^\d{17,20}$/.test(guildId)) q.$and=[{$or:[{activatedGuildId:guildId},{activatedGuildId:null}]}];
    const license=await License.findOne(q).sort({createdAt:-1}).lean();
    return res.json({success:true,license:license?{key:license.key,tier:license.tier,status:license.status,expiresAt:license.expiresAt,activatedGuildId:license.activatedGuildId}:null});
  } catch(e){ console.error('[Licensing] /me',e); return res.status(500).json({success:false,error:'Impossible de vérifier la licence.'}); }
});

router.post('/activate',isAuthenticated as any,canManageGuild as any,LicenseController.activateLicense);
export default router;
