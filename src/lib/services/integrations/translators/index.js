import { writable } from 'svelte/store';
import deepl from './deepl';

/**
 * List of all the supported translation services.
 * @type {{ [name: string]: TranslationService }}
 */
export const allTranslationServices = {
  deepl,
};

/**
 * @type {import('svelte/store').Writable<TranslationService>}
 */
export const translator = writable(deepl);

export const showTranslatorApiKeyDialog = writable(false);

export const pendingTranslatorRequest = writable();
