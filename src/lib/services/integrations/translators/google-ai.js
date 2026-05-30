import {
  apiKeyPattern,
  apiKeyURL,
  apiLabel,
  complete,
  developerURL,
} from '$lib/services/integrations/ai/google';

import { availability, createAiTranslate } from './shared.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

const serviceId = 'google-ai';
const serviceLabel = 'Google Gemini';
const model = 'gemini-3.1-flash-lite';

/**
 * Translation service using Google Gemini Flash-Lite. Supports markdown content and preserves
 * formatting.
 * @type {TranslationService}
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 * @see https://ai.google.dev/api/generate-content
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
  translate: createAiTranslate(complete, model, apiLabel, { responseFormat: 'application/json' }),
};
