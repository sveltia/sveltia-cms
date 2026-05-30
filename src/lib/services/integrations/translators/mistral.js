import {
  apiKeyPattern,
  apiKeyURL,
  apiLabel,
  complete,
  developerURL,
} from '$lib/services/integrations/ai/mistral';

import { availability, createAiTranslate } from './shared.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

const serviceId = 'mistral';
const serviceLabel = 'Mistral';
const model = 'mistral-small-latest';

/**
 * Translation service using Mistral Small. Supports markdown content and preserves formatting.
 * @type {TranslationService}
 * @see https://docs.mistral.ai/api
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
