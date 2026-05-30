import {
  apiKeyPattern,
  apiKeyURL,
  apiLabel,
  complete,
  developerURL,
} from '$lib/services/integrations/ai/openai';

import { availability, createAiTranslate } from './shared.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

const serviceId = 'openai';
const serviceLabel = 'OpenAI GPT';
const model = 'gpt-5.4-nano';

/**
 * Translation service using OpenAI GPT Nano. Supports markdown content and preserves formatting.
 * @type {TranslationService}
 * @see https://developers.openai.com/api/reference/resources/responses/methods/create
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
  translate: createAiTranslate(complete, model, apiLabel),
};
