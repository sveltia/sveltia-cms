import * as ai from '$lib/services/integrations/ai/openai';

import { createAiTranslationService } from './ai-translation.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * Translation service using GPT-6 Luna. Supports markdown content and preserves formatting.
 * @type {TranslationService}
 * @see https://developers.openai.com/api/reference/resources/responses/methods/create
 */
export default createAiTranslationService({
  ai,
  serviceId: 'openai',
  serviceLabel: 'OpenAI GPT',
  model: 'gpt-6-luna',
  // Keep the reasoning short, as its tokens are taken from the output budget the translation needs
  extraOptions: { reasoning: 'low' },
});
