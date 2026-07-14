import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { GuildConfig } from '../../models/GuildConfig';

// Fonction d'aide pour aplatir les objets imbriqués en chemin par points (dotted paths)
function flattenObject(ob: any, prefix = ''): any {
  const toReturn: any = {};
  for (const i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if ((typeof ob[i]) === 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
      const flatObject = flattenObject(ob[i], prefix + i + '.');
      for (const x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[x] = flatObject[x];
      }
    } else {
      toReturn[prefix + i] = ob[i];
    }
  }
  return toReturn;
}

export class GuildConfigController {
  // 1. Récupération de la configuration d'un serveur (avec autoguérison)
  static async getConfig(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;

    console.log(`[Config API] 📥 Requête de configuration reçue pour le serveur : ${guildId}`);

    try {
      let config = await GuildConfig.findOne({ guildId });
      
      if (!config) {
        console.log(`[Config API] 🆕 Aucune configuration trouvée pour ${guildId}. Création par défaut...`);
        config = new GuildConfig({ guildId });
        await config.save();
        console.log(`[Config API] ✅ Nouvelle configuration enregistrée en base pour ${guildId}`);
      } else {
        // AUTOGUÉRISON / MIGRATION AUTOMATIQUE :
        let modified = false;
        const defaultDoc = new GuildConfig({ guildId });
        const defaultModules = defaultDoc.modules.toObject ? defaultDoc.modules.toObject() : defaultDoc.modules;

        for (const key of Object.keys(defaultModules)) {
          if (config.modules[key as keyof typeof config.modules] === undefined) {
            (config.modules as any)[key] = defaultModules[key];
            config.markModified(`modules.${key}`);
            modified = true;
            console.log(`[Config Migration] 🔧 Réparation automatique du module manquant : modules.${key} pour ${guildId}`);
          }
        }

        if (modified) {
          await config.save();
          console.log(`[Config Migration] ✅ Document réparé et sauvegardé pour ${guildId}`);
        } else {
          console.log(`[Config API] ✅ Configuration existante chargée pour ${guildId}`);
        }
      }
      
      return res.json(config);
    } catch (error: any) {
      console.error(`[Config API] ❌ Erreur critique lors de l'accès à la configuration de ${guildId} :`);
      console.error(error.stack || error);
      
      return res.status(500).json({ 
        error: 'Erreur lors de la récupération de la configuration.',
        details: error.message 
      });
    }
  }

  // 2. Mise à jour sécurisée de la configuration
  static async updateConfig(req: AuthenticatedRequest, res: Response) {
    const { guildId } = req.params;
    const updates = req.body;

    console.log(`[Config API] 📤 Tentative de mise à jour pour le serveur : ${guildId}`);

    try {
      delete updates.guildId;

      // Aplatissement du payload reçu
      const flattenedUpdates = flattenObject(updates);

      const config = await GuildConfig.findOneAndUpdate(
        { guildId },
        { $set: flattenedUpdates },
        { new: true, runValidators: true }
      );

      if (!config) {
        console.warn(`[Config API] ⚠️ Serveur ${guildId} introuvable.`);
        return res.status(404).json({ error: 'Configuration introuvable.' });
      }

      console.log(`[Config API] ✅ Paramètres enregistrés avec succès pour ${guildId}`);
      return res.json({ message: 'Paramètres enregistrés.', config });
    } catch (error: any) {
      console.error(`[Config API] ❌ Échec de mise à jour pour ${guildId} :`);
      console.error(error.stack || error);
      
      return res.status(400).json({ 
        error: 'Données d\'ajustement non conformes.', 
        details: error.message 
      });
    }
  }
}