import * as ai from '$lib/services/integrations/ai/deepseek';

import { createAiTranslationService } from './ai-translation.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * Translation service using DeepSeek. Supports markdown content and preserves formatting.
 * @type {TranslationService}
 * @see https://api-docs.deepseek.com/api/create-chat-completion
 */
export default createAiTranslationService({
  ai,
  serviceId: 'deepseek',
  serviceLabel: 'DeepSeek',
  model: 'deepseek-flash',
  extraOptions: { reasoning: 'none' },
});
