import * as ai from '$lib/services/integrations/ai/anthropic';

import { createAiTranslationService } from './shared.js';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * Translation service using Anthropic Claude Haiku. Supports markdown content and preserves
 * formatting.
 * @type {TranslationService}
 * @see https://docs.claude.com/en/docs/about-claude/models/overview
 * @see https://docs.claude.com/en/api/messages
 */
export default createAiTranslationService({
  ai,
  serviceId: 'anthropic',
  serviceLabel: 'Anthropic Claude',
  model: 'claude-haiku-4-5',
});
