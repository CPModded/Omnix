module.exports = {
  preset: 'ts-jest',                             // Utilise ts-jest pour compiler à la volée durant les tests
  testEnvironment: 'node',                      // Environnement d'exécution adapté pour Node.js
  testMatch: ['**/tests/**/*.test.ts'],          // Cherche les fichiers finissant par .test.ts dans le dossier tests/
  verbose: true,                                 // Affiche le détail de chaque test exécuté
  forceExit: true,                               // Force l'arrêt de Jest après la fin des tests (ferme les connexions MongoDB résiduelles)
  clearMocks: true                              // Nettoie automatiquement les mocks après chaque test
};