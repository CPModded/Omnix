"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FounderController = void 0;
class FounderController {
    // Renvoie les données brutes de présentation de la plateforme
    static getFounderInfo(req, res) {
        return res.json({
            name: 'OMNIX',
            description: 'Créateur et développeur de la plateforme OMNIX.',
            officialServer: 'https://discord.gg/naBuatEBJ5'
        });
    }
    // Effectue le rendu HTML de la page founder.ejs
    static renderFounderPage(req, res) {
        return res.render('founder', {
            founder: {
                name: 'OMNIX',
                description: 'Créateur et développeur de la plateforme OMNIX.',
                officialServer: 'https://discord.gg/naBuatEBJ5'
            }
        });
    }
}
exports.FounderController = FounderController;
