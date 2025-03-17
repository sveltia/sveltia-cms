import { writable } from 'svelte/store';
import deepl from './deepl';

/**
 * List of all the supported translation services.
 * @type {Record<string, import('$lib/typedefs').TranslationService>}
 */
export const allTranslationServices = {
  deepl,
};
/**
 * @type {import('svelte/store').Writable<import('$lib/typedefs').TranslationService>}
 */
export const translator = writable(deepl);
