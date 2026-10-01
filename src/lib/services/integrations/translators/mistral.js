import * as ai from '$lib/services/integrations/ai/mistral';

import { createAiTranslationService } from './ai-translation.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * Translation service using Mistral Small. Supports markdown content and preserves formatting.
 * @type {TranslationService}
 * @see https://docs.mistral.ai/api
 */
export default createAiTranslationService({
  ai,
  serviceId: 'mistral',
  serviceLabel: 'Mistral',
  model: 'mistral-small-latest',
  extraOptions: { reasoning: 'none' },
});
