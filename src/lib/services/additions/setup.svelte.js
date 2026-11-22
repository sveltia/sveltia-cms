import { _ } from '@sveltia/i18n';

import { fetchAdditions, isGitHubURL } from '$lib/services/additions/api';
import { derivePrehash } from '$lib/services/additions/kdf';

/**
 * What the service has been set up with, as `/v1/setup/status` reports it.
 * @typedef {object} SetupStatus
 * @property {string} site_id Site ID, which salts the password derivation.
 * @property {'ok' | 'locked'} data_key Whether the stored secrets can be read with the current
 * admin secret.
 * @property {number} admins Number of active admins.
 * @property {string[]} allowed_domains Allowed domains.
 * @property {{ slug: string, owner: string, html_url: string } | null} github_app GitHub App.
 * @property {{ owner: string, name: string } | null} installation Installation on the repository.
 */

/**
 * Query parameter the service adds when it sends the browser back from GitHub.
 */
export const SETUP_RESULT_PARAM = 'additions_setup';

/**
 * State of the setup wizard, which is unlocked with the service’s admin secret. The secret is only
 * kept in memory while the wizard is open, never stored.
 */
export const additionsSetup = $state({
  /** Whether the wizard is shown in place of the sign-in form. */
  open: false,
  /** Admin secret, once it has been accepted. */
  secret: '',
  /** @type {SetupStatus | undefined} */
  status: undefined,
  /**
   * Outcome of connecting to GitHub, read from the URL the service sends the browser back to: `ok`
   * or an error code.
   */
  result: '',
});

/**
 * Send a request to the Sveltia CMS Additions API with the admin secret the wizard was unlocked
 * with.
 * @param {string} path Path, e.g. `/v1/setup/status`.
 * @param {object} [options] Options.
 * @param {string} [options.method] HTTP method.
 * @param {Record<string, any>} [options.body] JSON body.
 * @returns {Promise<any>} Parsed response.
 * @throws {Error} When the service can’t be reached or responds with an error.
 */
export const fetchWithSecret = (path, { method, body } = {}) =>
  fetchAdditions(path, { method, body, token: additionsSetup.secret });

/**
 * Open the setup wizard.
 */
export const openSetup = () => {
  additionsSetup.open = true;
  additionsSetup.result = '';
};

/**
 * Close the setup wizard and forget the admin secret.
 */
export const closeSetup = () => {
  Object.assign(additionsSetup, { open: false, secret: '', status: undefined });
};

/**
 * Get the setup status with the admin secret, which also checks the secret.
 * @param {string} secret Admin secret.
 * @returns {Promise<void>}
 * @throws {Error} When the secret is wrong, or the service refuses the request.
 */
export const unlockSetup = async (secret) => {
  additionsSetup.status = await fetchAdditions('/v1/setup/status', { token: secret });
  additionsSetup.secret = secret;
};

/**
 * Read the setup status again after a change.
 * @returns {Promise<void>}
 */
const refreshStatus = async () => {
  additionsSetup.status = await fetchWithSecret('/v1/setup/status');
};

/**
 * Create an admin, or reset an existing admin’s password, which is how an admin who can’t sign in
 * gets back in. The site this is done from becomes an allowed domain, so it can use the service.
 * @param {object} args Arguments.
 * @param {string} args.username Username.
 * @param {string} args.password Password. Only its prehash is sent.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request.
 */
export const saveAdmin = async ({ username, password }) => {
  const siteId = /** @type {SetupStatus} */ (additionsSetup.status).site_id;

  await fetchWithSecret('/v1/setup/admin', {
    method: 'POST',
    body: {
      username,
      prehash: await derivePrehash({ siteId, username, password }),
      allow_origin: true,
    },
  });

  await refreshStatus();
};

/**
 * Submit the GitHub App manifest to GitHub in a form, which leaves the CMS. GitHub creates the app,
 * the service then has it installed on the repository, and finally sends the browser back here.
 * @param {string} actionURL URL of GitHub’s app creation page, with the setup state.
 * @param {Record<string, any>} manifest App manifest.
 * @throws {Error} When the URL isn’t a GitHub page.
 * @see https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
 */
export const submitManifest = (actionURL, manifest) => {
  if (!isGitHubURL(actionURL)) {
    throw new Error('The app creation page isn’t on GitHub.');
  }

  const form = Object.assign(document.createElement('form'), { method: 'post', action: actionURL });

  form.append(
    Object.assign(document.createElement('input'), {
      type: 'hidden',
      name: 'manifest',
      value: JSON.stringify(manifest),
    }),
  );
  document.body.append(form);
  form.submit();
};

/**
 * Look up whether a GitHub account is an organization or a user, which decides where GitHub creates
 * the app. This is done from the browser, because GitHub limits requests without credentials by IP
 * address, and the service shares its address with other Cloudflare Workers.
 * @param {string} owner Account name.
 * @returns {Promise<'Organization' | 'User' | undefined>} Account type, or `undefined` if it can’t
 * be found out, which leaves the lookup to the service.
 */
export const getOwnerType = async (owner) => {
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(owner)}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const { type } = await response.json();

      return type === 'Organization' ? 'Organization' : 'User';
    }
  } catch {
    // Left to the service
  }

  return undefined;
};

/**
 * Register a GitHub App for the repository and install it, through GitHub.
 * @param {object} args Arguments.
 * @param {string} args.repo Repository, as `owner/name`.
 * @param {boolean} [args.replace] Whether to replace an app that’s already set up.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request.
 */
export const connectGitHub = async ({ repo, replace = false }) => {
  const { action_url: actionURL, manifest } = await fetchWithSecret('/v1/setup/github', {
    method: 'POST',
    body: {
      repo,
      return_url: window.location.href,
      replace,
      owner_type: await getOwnerType(repo.split('/')[0]),
    },
  });

  submitManifest(actionURL, manifest);
};

/**
 * Ask the service to recover the data key after the admin secret was changed, then read the
 * status again.
 * @param {Record<string, any>} body Request body: how to recover it.
 * @returns {Promise<void>}
 */
const recoverDataKey = async (body) => {
  await fetchWithSecret('/v1/setup/secret', { method: 'POST', body });
  await refreshStatus();
};

/**
 * Unlock the stored secrets after the admin secret was changed, with the previous secret.
 * @param {string} previousSecret Previous admin secret.
 * @returns {Promise<void>}
 * @throws {Error} When the previous secret is wrong.
 */
export const rewrapDataKey = async (previousSecret) => {
  await recoverDataKey({ previous: previousSecret });
};

/**
 * Start over with a new data key after the previous admin secret was lost. The stored secrets,
 * including the GitHub App’s, are deleted, and everyone is signed out; passwords are kept.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the request.
 */
export const rekeyDataKey = async () => {
  await recoverDataKey({ rekey: true });
};

/**
 * Outcomes of connecting to GitHub that have a message of their own.
 */
const SETUP_RESULTS = [
  'ok',
  'github_app_not_created',
  'github_app_not_installed',
  'github_wrong_account',
  'github_repository_not_included',
];

/**
 * Get the message for the outcome of connecting to GitHub.
 * @param {string} result `ok` or an error code.
 * @returns {string} Localized message.
 */
export const getSetupResultMessage = (result) =>
  _(`additions.setup.result.${SETUP_RESULTS.includes(result) ? result : 'unexpected'}`);

/**
 * Read the outcome of connecting to GitHub from the URL the service sent the browser back to, and
 * remove it from the URL, so a reload doesn’t show it again.
 * @returns {string} `ok`, an error code, or an empty string if there is none.
 */
export const readSetupResult = () => {
  // A plain URL, only used to rewrite the address, not to react to
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const url = new URL(window.location.href);
  const result = url.searchParams.get(SETUP_RESULT_PARAM) ?? '';

  if (result) {
    url.searchParams.delete(SETUP_RESULT_PARAM);
    window.history.replaceState(window.history.state, '', url);
    additionsSetup.result = result;
  }

  return result;
};
