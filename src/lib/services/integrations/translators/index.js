import { writable } from 'svelte/store';
import deepl from './deepl';

/**
 * @import { Writable } from 'svelte/store';
 * @import { TranslationService } from '$lib/typedefs/private';
 */

/**
 * List of all the supported translation services.
 * @type {Record<string, TranslationService>}
 */
export const allTranslationServices = {
  deepl,
};
/**
 * @type {Writable<TranslationService>}
 */
export const translator = writable(deepl);
