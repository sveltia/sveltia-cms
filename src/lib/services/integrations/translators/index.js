import { toStore } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs.svelte';

import anthropic from './anthropic';
import deepseek from './deepseek';
import google from './google';
import googleAi from './google-ai';
import mistral from './mistral';
import openai from './openai';

/**
 * @import { Readable } from 'svelte/store';
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
 * @type {Readable<TranslationService>}
 */
export const translator = toStore(() => {
  const { defaultTranslationService = 'google' } = prefs;

  return allTranslationServices[defaultTranslationService] ?? google;
});
