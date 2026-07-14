import { Request, Response } from 'express';

export class FounderController {
  static getFounderInfo(req: Request, res: Response) {
    return res.json({
      name: 'OMNIX',
      description: 'Créateur et développeur de la plateforme OMNIX.',
      officialServer: 'https://discord.gg/naBuatEBJ5'
    });
  }

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