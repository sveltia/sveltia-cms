import {
  apiKeyPattern,
  apiKeyURL,
  apiLabel,
  complete,
  developerURL,
} from '$lib/services/integrations/ai/deepseek';

import { availability, createAiTranslate } from './shared.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

const serviceId = 'deepseek';
const serviceLabel = 'DeepSeek';
const model = 'deepseek-v4-flash';

/**
 * Translation service using DeepSeek. Supports markdown content and preserves formatting.
 * @type {TranslationService}
 * @see https://api-docs.deepseek.com/api/create-chat-completion
 */
export default {
  serviceId,
  serviceLabel,
  apiLabel,
  developerURL,
  apiKeyURL,
  apiKeyPattern,
  markdownSupported: true,
  availability,
  translate: createAiTranslate(complete, model, apiLabel, { reasoning: false }),
};
