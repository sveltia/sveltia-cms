import { IndexedDB } from '@sveltia/utils/storage';
import { derived, get, toStore, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';

/**
 * The IndexedDB instance for storing UI settings.
 * @type {IndexedDB | undefined}
 */
let uiSettingsDB;

export const canShowMobileSignInDialog = derived(
  [
    toStore(() => env.isLargeScreen),
    toStore(() => env.hasMouse),
    toStore(() => env.isLocalHost),
    backend,
    toStore(() => user.account),
  ],
  ([_isLargeScreen, _hasMouse, _isLocalHost, _backend, _user]) =>
    _isLargeScreen && _hasMouse && !_isLocalHost && !!_backend?.isGit && !!_user?.token,
);

export const showMobileSignInDialog = writable(false);

/**
 * Get the IndexedDB instance for storing UI settings.
 * @returns {IndexedDB | undefined} The IndexedDB instance, or `undefined` if not available.
 */
const getDatabase = () => {
  if (uiSettingsDB) {
    return uiSettingsDB;
  }

  const { databaseName } = get(backend)?.repository ?? {};

  if (!databaseName) {
    return undefined;
  }

  uiSettingsDB = new IndexedDB(databaseName, 'ui-settings');

  return uiSettingsDB;
};

/**
 * Get a state value from the UI settings database.
 * @param {string} name State name to get from the UI settings database.
 * @returns {Promise<any>} The state value, or `undefined` if not found.
 */
export const getState = async (name) => {
  uiSettingsDB = getDatabase();

  if (!uiSettingsDB) {
    return undefined;
  }

  const onboardingState = (await uiSettingsDB.get('onboarding')) ?? {};

  return onboardingState[name];
};

/**
 * Set a state value in the UI settings database.
 * @param {string} name State name to set in the UI settings database.
 * @param {any} value State value to set in the UI settings database.
 * @returns {Promise<void>}
 */
export const setState = async (name, value) => {
  uiSettingsDB = getDatabase();

  if (!uiSettingsDB) {
    return;
  }

  const onboardingState = (await uiSettingsDB.get('onboarding')) ?? {};

  await uiSettingsDB.set('onboarding', { ...onboardingState, [name]: value });
};
