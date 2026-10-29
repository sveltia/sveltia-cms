import { LocalStorage } from '@sveltia/utils/storage';

import { LOCAL_STORAGE_KEY_PREFIX } from '$lib/services/app/cache';
import { getUISettingsDB } from '$lib/services/app/ui-settings';
import { backend } from '$lib/services/backends';
import { isDemoSite } from '$lib/services/backends/fs/seed';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

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
 * Get a state value from the UI settings database.
 * @param {string} name State name to get from the UI settings database.
 * @returns {Promise<any>} The state value, or `undefined` if not found.
 */
export const getState = async (name) => {
  const db = getUISettingsDB();

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
  const db = getUISettingsDB();

  if (!db) {
    return;
  }

  const onboardingState = (await db.get('onboarding')) ?? {};

  await db.set('onboarding', { ...onboardingState, [name]: value });
};

/**
 * @typedef {object} OneOffNoticeStorage
 * @property {(name: string) => Promise<any>} get Function to read the stored dismissal.
 * @property {(name: string, value: boolean) => Promise<void>} set Function to store the dismissal.
 */

/**
 * @typedef {object} OneOffNotice
 * @property {{ current: boolean }} show Whether the notice is shown.
 * @property {() => Promise<void>} showIfNeeded Show the notice unless it has been dismissed.
 * @property {() => void} hide Hide the notice and remember it, so it doesn’t come back.
 */

/**
 * Storage keeping the dismissal of a one-off notice in the UI settings database.
 * @type {OneOffNoticeStorage}
 */
const uiSettingsNoticeStorage = { get: getState, set: setState };

/**
 * Create the state of a one-off notice, such as an infobar, that stays hidden once dismissed.
 * @param {string} name State name to store the dismissal under.
 * @param {OneOffNoticeStorage} [storage] Storage to keep the dismissal in. The UI settings database
 * by default.
 * @returns {OneOffNotice} Notice state.
 */
export const createOneOffNotice = (name, storage = uiSettingsNoticeStorage) => {
  const show = createRawState(false);

  return {
    show,
    /**
     * Show the notice unless it has been dismissed.
     */
    showIfNeeded: async () => {
      show.current = !(await storage.get(name));
    },
    /**
     * Hide the notice and remember it, so it doesn’t come back.
     */
    hide: () => {
      show.current = false;
      storage.set(name, true);
    },
  };
};

/**
 * Local storage key remembering that the user has seen the demo welcome dialog. The test backend
 * has no repository database to keep it in, unlike the notices above. The Erase All Data option
 * deletes it along with the demo repository, so the dialog greets the user again when the demo
 * starts over.
 */
export const DEMO_WELCOME_STORAGE_KEY = `${LOCAL_STORAGE_KEY_PREFIX}demo-welcome-seen`;

/**
 * Storage keeping the dismissal of a one-off notice in local storage.
 * @type {OneOffNoticeStorage}
 */
const localNoticeStorage = {
  /**
   * Read the stored dismissal.
   * @param {string} key Local storage key.
   * @returns {Promise<any>} Stored value, or `undefined` if the storage can’t be read.
   */
  get: async (key) => {
    try {
      return await LocalStorage.get(key);
    } catch {
      // Storage access may be denied, e.g. when third-party cookies are blocked. Better to show the
      // notice on every visit than never
      return undefined;
    }
  },
  /**
   * Store the dismissal, ignoring any error.
   * @param {string} key Local storage key.
   * @param {boolean} value Value to store.
   */
  set: async (key, value) => {
    try {
      await LocalStorage.set(key, value);
    } catch {
      //
    }
  },
};

/**
 * State of the dialog welcoming the user to the demo.
 */
export const demoWelcomeNotice = createOneOffNotice(DEMO_WELCOME_STORAGE_KEY, localNoticeStorage);

/**
 * Show the demo welcome dialog if the CMS runs as a demo and the user hasn’t seen it yet.
 * @returns {Promise<void>}
 */
export const showDemoWelcomeDialogIfNeeded = async () => {
  if (!isDemoSite(backend.current?.name)) {
    return;
  }

  await demoWelcomeNotice.showIfNeeded();
};
