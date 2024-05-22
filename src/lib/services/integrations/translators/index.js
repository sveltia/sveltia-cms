import { writable } from 'svelte/store';
import deepl from './deepl';

/**
 * List of all the supported translation services.
 * @type {Record<string, TranslationService>}
 */
export const allTranslationServices = {
  deepl,
};
/**
 * @type {import('svelte/store').Writable<TranslationService>}
 */
export const translator = writable(deepl);
