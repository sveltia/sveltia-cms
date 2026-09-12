import { backend } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';
import { getRepositoryDatabase } from '$lib/services/utils/database';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 */

/**
 * The IndexedDB instance for storing UI settings.
 * @type {IndexedDB | undefined}
 */
let uiSettingsDB;

/**
 * Whether the dialog offering to sign in on a mobile device can be shown.
 */
export const canShowMobileSignInDialog = createDerivedState(
  () =>
    env.isLargeScreen &&
    env.hasMouse &&
    !env.isLocalHost &&
    !!backend.current?.isGit &&
    !!user.account?.token,
);

/**
 * Whether to show the dialog offering to sign in on a mobile device.
 */
export const showMobileSignInDialog = createRawState(false);

/**
 * Get the IndexedDB instance for storing UI settings.
 * @returns {IndexedDB | undefined} The IndexedDB instance, or `undefined` if not available.
 */
const getDatabase = () => {
  if (uiSettingsDB) {
    return uiSettingsDB;
  }

  uiSettingsDB = getRepositoryDatabase(backend.current?.repository, 'ui-settings');

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
