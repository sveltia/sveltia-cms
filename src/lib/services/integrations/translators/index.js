import { writable } from 'svelte/store';

import google from './google';

/**
 * @import { Writable } from 'svelte/store';
 * @import { TranslationService } from '$lib/types/private';
 */

/**
 * List of all the supported translation services.
 * @type {Record<string, TranslationService>}
 */
export const allTranslationServices = {
  google,
};
/**
 * @type {Writable<TranslationService>}
 */
export const translator = writable(google);
