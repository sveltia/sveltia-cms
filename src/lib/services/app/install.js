import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * `BeforeInstallPromptEvent` the browser fired to offer installing the app, kept until the app is
 * installed. Browsers fire it once, shortly after the page loads, so it’s captured at the app level
 * rather than by the menu item offering the installation, which is only rendered while the account
 * menu is open.
 * @type {{ current: any }}
 * @see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
 */
export const installPrompt = createRawState(null);

/**
 * Keep the install prompt, and stop the browser from showing its own install UI.
 * @param {Event} event `BeforeInstallPromptEvent`.
 */
const beforeInstallPromptHandler = (event) => {
  event.preventDefault();
  installPrompt.current = event;
};

/**
 * Drop the install prompt once the app is installed.
 */
const appInstalledHandler = () => {
  installPrompt.current = null;
};

/**
 * Start listening to the events telling whether the app can be installed. This should be called
 * when the app is initialized, before the browser offers to install it.
 * @returns {() => void} Function to stop listening.
 */
export const initAppInstallDetection = () => {
  window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
  window.addEventListener('appinstalled', appInstalledHandler);

  return () => {
    window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    window.removeEventListener('appinstalled', appInstalledHandler);
  };
};

/**
 * Show the browser’s install prompt, if it has offered to install the app. A prompt can only be
 * shown once, so it’s dropped right away; if the user dismisses it, the browser may fire another
 * `beforeinstallprompt` event later.
 * @returns {Promise<void>}
 */
export const promptAppInstall = async () => {
  const prompt = installPrompt.current;

  if (!prompt) {
    return;
  }

  installPrompt.current = null;
  await prompt.prompt();
};
