import { writable } from 'svelte/store';
import deepl from './deepl';

export const allTranslationServices = {
  deepl,
};

export const translator = writable(deepl);

export const showTranslatorApiKeyDialog = writable(false);

export const pendingTranslatorRequest = writable();
