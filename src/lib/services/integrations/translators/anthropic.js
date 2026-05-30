import {
  apiKeyPattern,
  apiKeyURL,
  apiLabel,
  complete,
  developerURL,
} from '$lib/services/integrations/ai/anthropic';

import { availability, createAiTranslate } from './shared.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

const serviceId = 'anthropic';
const serviceLabel = 'Anthropic Claude';
const model = 'claude-haiku-4-5';

/**
 * Translation service using Anthropic Claude Haiku. Supports markdown content and preserves
 * formatting.
 * @type {TranslationService}
 * @see https://docs.claude.com/en/docs/about-claude/models/overview
 * @see https://docs.claude.com/en/api/messages
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
