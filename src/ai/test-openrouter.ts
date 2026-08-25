import { askOpenRouter } from './openrouter';

async function main() {
  try {
    const response = await askOpenRouter(
      'Explique-moi en quelques phrases ce qu’est OMNIX.'
    );

    console.log('\n===== RÉPONSE OMNIX AI =====\n');
    console.log(response);
  } catch (error) {
    console.error('Erreur OpenRouter:', error);
  }
}

main();