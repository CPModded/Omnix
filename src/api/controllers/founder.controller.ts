import { Request, Response } from 'express';

export class FounderController {
  // Renvoie les données brutes de présentation de la plateforme
  static getFounderInfo(req: Request, res: Response) {
    return res.json({
      name: 'OMNIX',
      description: 'Créateur et développeur de la plateforme OMNIX.',
      officialServer: 'https://discord.gg/naBuatEBJ5'
    });
  }

  // Effectue le rendu HTML de la page founder.ejs
  static renderFounderPage(req: Request, res: Response) {
    return res.render('founder', {
      founder: {
        name: 'OMNIX',
        description: 'Créateur et développeur de la plateforme OMNIX.',
        officialServer: 'https://discord.gg/naBuatEBJ5'
      }
    });
  }
}