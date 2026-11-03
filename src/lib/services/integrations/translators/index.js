import { allAiServices } from '$lib/services/integrations/ai';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createDerivedState } from '$lib/services/utils/state.svelte';

import anthropic from './anthropic';
import deepseek from './deepseek';
import google from './google';
import googleAi from './google-ai';
import mistral from './mistral';
import openai from './openai';

/**
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * List of all the supported translation services. Alphabetical order by service name.
 * @type {Record<string, TranslationService>}
 */
export const allTranslationServices = {
  anthropic,
  deepseek,
  google,
  'google-ai': googleAi,
  mistral,
  openai,
};

/**
 * Dedicated machine translation services, whose API keys are managed on the Internationalization
 * settings panel. The others are backed by a generic AI service, whose API key is managed on the AI
 * settings panel.
 * @type {Record<string, TranslationService>}
 */
export const machineTranslationServices = Object.fromEntries(
  Object.entries(allTranslationServices).filter(([serviceId]) => !(serviceId in allAiServices)),
);

/**
 * Translation service selected in the user preferences.
 * @type {{ readonly current: TranslationService }}
 */
export const translator = createDerivedState(() => {
  const { defaultTranslationService = 'google' } = prefs;

  return allTranslationServices[defaultTranslationService] ?? google;
});
