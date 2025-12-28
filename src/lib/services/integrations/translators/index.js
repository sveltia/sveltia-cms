import { derived } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs';

import anthropic from './anthropic';
import gemini from './gemini';
import google from './google';
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
  gemini,
  anthropic,
  openai,
};

/**
 * @type {Readable<TranslationService>}
 */
export const translator = derived([prefs], ([$prefs]) => {
  const { defaultTranslationService = 'google' } = $prefs;

  return allTranslationServices[defaultTranslationService] ?? google;
});
