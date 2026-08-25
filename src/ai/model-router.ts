export const AI_MODELS = {
  FREE: 'nvidia/nemotron-3-ultra-550b-a55b:free',

  ROUTER: 'openrouter/free',
} as const;

export type AIModel =
  typeof AI_MODELS[keyof typeof AI_MODELS];

export function getAIModel(
  preferred?: AIModel
): AIModel {

  return preferred ?? AI_MODELS.FREE;
}