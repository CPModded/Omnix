"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_MODELS = void 0;
exports.getAIModel = getAIModel;
exports.AI_MODELS = {
    FREE: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    ROUTER: 'openrouter/free',
};
function getAIModel(preferred) {
    return preferred ?? exports.AI_MODELS.ROUTER;
}
