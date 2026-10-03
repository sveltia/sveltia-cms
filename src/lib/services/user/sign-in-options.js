/**
 * @import { Backend, GitBackend, GiteaBackend } from '$lib/types/public';
 */

/**
 * @typedef {object} SignInOptions
 * @property {string | undefined} serviceLabel The label to use for the Sign In button, which is
 * usually the backend’s label but can be overridden for specific backends (e.g. Forgejo on
 * Codeberg) to provide a better UX.
 * @property {boolean} tokenOptionHidden Whether the option to sign in using a PAT should be hidden.
 * @property {boolean} oauthOptionHidden Whether the option to sign in using OAuth should be hidden.
 * @property {boolean} oauthOptionDisabled Whether the option to sign in using OAuth should be
 * disabled. This is used for Gitea with PKCE authentication, which requires an app ID to be
 * provided. We can’t check this during config validation because token authentication doesn’t
 * require an ID, so we check it here instead.
 * @see https://github.com/sveltia/sveltia-cms/issues/721
 */

/**
 * Determine how to present the sign-in options for the configured backend.
 * @param {Backend} backendConfig Backend configuration.
 * @param {string | undefined} backendLabel Label of the backend service, if it’s supported.
 * @returns {SignInOptions} Sign-in options.
 */
export const getSignInOptions = (backendConfig, backendLabel) => {
  const { name } = backendConfig;
  const isTestRepo = name === 'test-repo';
  const { auth_methods: authMethods } = /** @type {GitBackend} */ (backendConfig);
  const { base_url: baseURL, app_id: appId } = /** @type {GiteaBackend} */ (backendConfig);

  return {
    serviceLabel:
      name === 'gitea' && baseURL === 'https://codeberg.org' ? 'Codeberg' : backendLabel,
    tokenOptionHidden: !isTestRepo && authMethods?.includes('token') === false,
    oauthOptionHidden: !isTestRepo && authMethods?.includes('oauth') === false,
    oauthOptionDisabled: name === 'gitea' && !appId,
  };
};
