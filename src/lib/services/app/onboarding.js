import { backend } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';
import { getRepositoryDatabase } from '$lib/services/utils/database';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 */

/**
 * The IndexedDB instance for storing UI settings, along with the name of the repository database it
 * belongs to, so another one is opened once the user signs in to another repository.
 * @type {{ databaseName: string, db: IndexedDB } | undefined}
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
  const repository = backend.current?.repository;
  const databaseName = repository?.databaseName;

  if (!databaseName) {
    return undefined;
  }

  if (uiSettingsDB?.databaseName !== databaseName) {
    uiSettingsDB = {
      databaseName,
      db: /** @type {IndexedDB} */ (getRepositoryDatabase(repository, 'ui-settings')),
    };
  }

  return uiSettingsDB.db;
};

/**
 * Get a state value from the UI settings database.
 * @param {string} name State name to get from the UI settings database.
 * @returns {Promise<any>} The state value, or `undefined` if not found.
 */
export const getState = async (name) => {
  const db = getDatabase();

  if (!db) {
    return undefined;
  }

  const onboardingState = (await db.get('onboarding')) ?? {};

  return onboardingState[name];
};

/**
 * Set a state value in the UI settings database.
 * @param {string} name State name to set in the UI settings database.
 * @param {any} value State value to set in the UI settings database.
 * @returns {Promise<void>}
 */
export const setState = async (name, value) => {
  const db = getDatabase();

  if (!db) {
    return;
  }

  const onboardingState = (await db.get('onboarding')) ?? {};

  await db.set('onboarding', { ...onboardingState, [name]: value });
};

/**
 * @typedef {object} OneOffNotice
 * @property {{ current: boolean }} show Whether the notice is shown.
 * @property {() => Promise<void>} showIfNeeded Show the notice unless it has been dismissed.
 * @property {() => void} hide Hide the notice and remember it, so it doesn’t come back.
 */

/**
 * Create the state of a one-off notice, such as an infobar, that stays hidden once dismissed. The
 * dismissal is stored in the UI settings database under the given name.
 * @param {string} name State name to store the dismissal under.
 * @returns {OneOffNotice} Notice state.
 */
export const createOneOffNotice = (name) => {
  const show = createRawState(false);

  return {
    show,
    /**
     * Show the notice unless it has been dismissed.
     */
    showIfNeeded: async () => {
      show.current = !(await getState(name));
    },
    /**
     * Hide the notice and remember it, so it doesn’t come back.
     */
    hide: () => {
      show.current = false;
      setState(name, true);
    },
  };
};
