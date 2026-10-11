"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const openrouter_1 = require("../ai/openrouter");
async function main() {
    try {
        const response = await (0, openrouter_1.askOpenRouter)('Explique-moi en quelques phrases ce qu’est OMNIX.');
        console.log('\n===== RÉPONSE OMNIX AI =====\n');
        console.log(response);
    }
    catch (error) {
        console.error('Erreur OpenRouter:', error);
    }
}
main();
