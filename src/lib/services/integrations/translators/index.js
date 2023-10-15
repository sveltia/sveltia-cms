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

/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showTranslatorApiKeyDialog = writable(false);

/**
 * @type {import('svelte/store').Writable<[string, string, string, boolean] | undefined>}
 */
export const pendingTranslatorRequest = writable();
