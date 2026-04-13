import { derived } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs';

import anthropic from './anthropic';
import deepseek from './deepseek';
import google from './google';
import googleAi from './google-ai';
import openai from './openai';

/**
 * @import { Readable } from 'svelte/store';
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * List of all the supported translation services.
 * @type {Record<string, TranslationService>}
 */
export const allTranslationServices = {
  google,
  'google-ai': googleAi,
  anthropic,
  deepseek,
  openai,
};

/**
 * @type {Readable<TranslationService>}
 */
export const translator = derived([prefs], ([$prefs]) => {
  const { defaultTranslationService = 'google' } = $prefs;

  return allTranslationServices[defaultTranslationService] ?? google;
});
