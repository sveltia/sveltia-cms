import * as ai from '$lib/services/integrations/ai/google';

import { createAiTranslationService } from './ai-translation.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * Translation service using Google Gemini Flash-Lite. Supports markdown content and preserves
 * formatting.
 * @type {TranslationService}
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 * @see https://ai.google.dev/api/generate-content
 */
export default createAiTranslationService({
  ai,
  serviceId: 'google-ai',
  serviceLabel: 'Google Gemini',
  model: 'gemini-3.5-flash-lite',
  extraOptions: { responseFormat: 'application/json' },
});
