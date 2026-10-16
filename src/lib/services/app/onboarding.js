import { LocalStorage } from '@sveltia/utils/storage';

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

/**
 * Local storage key remembering that the user has seen the demo welcome dialog. The test backend
 * has no repository database to keep it in, unlike the notices above. The Erase All Data option
 * deletes it along with the demo repository, so the dialog greets the user again when the demo
 * starts over.
 */
export const DEMO_WELCOME_STORAGE_KEY = 'sveltia-cms.demo-welcome-seen';

/**
 * Whether to show the dialog welcoming the user to the demo.
 */
export const showDemoWelcomeDialog = createRawState(false);

/**
 * Show the demo welcome dialog if the CMS runs as a demo and the user hasn’t seen it yet.
 * @returns {Promise<void>}
 */
export const showDemoWelcomeDialogIfNeeded = async () => {
  if (!isDemoSite(backend.current?.name)) {
    return;
  }

  try {
    showDemoWelcomeDialog.current = !(await LocalStorage.get(DEMO_WELCOME_STORAGE_KEY));
  } catch {
    // Storage access may be denied, e.g. when third-party cookies are blocked. Better to show the
    // dialog on every visit than never
    showDemoWelcomeDialog.current = true;
  }
};

/**
 * Remember that the user has seen the demo welcome dialog, so it doesn’t come back.
 * @returns {Promise<void>}
 */
export const dismissDemoWelcomeDialog = async () => {
  try {
    await LocalStorage.set(DEMO_WELCOME_STORAGE_KEY, true);
  } catch {
    //
  }
};
