import { _ } from '@sveltia/i18n';
import { LocalStorage } from '@sveltia/utils/storage';

import { fetchAdditions, getErrorMessage } from '$lib/services/additions/api';
import { derivePrehash, KDF_VERSION } from '$lib/services/additions/kdf';
import { fetchWithSession } from '$lib/services/additions/session-api';
import { getAdditionsURL } from '$lib/services/app/additions';
import { refreshAccessToken } from '$lib/services/backends/git/shared/api';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  isAuthPopup,
  sendMessage,
} from '$lib/services/backends/git/shared/auth';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import { SignInOptions, User } from '$lib/types/private';
 */

/**
 * Major version of the Sveltia CMS Additions API this CMS works with.
 */
const API_VERSION = 1;

/**
 * Minimum length of a new password. The service never sees the password, only its prehash, so the
 * rule can only be enforced here. The `additions.password_too_short` string mentions the number.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Check a new password as the user types it. It isn’t typed twice: the field can show what has
 * been typed instead.
 * @param {string} newPassword New password.
 * @returns {'' | 'password_too_short'} Problem to show, if any. Nothing is reported while the field
 * is empty.
 */
export const getNewPasswordError = (newPassword) =>
  newPassword && newPassword.length < MIN_PASSWORD_LENGTH ? 'password_too_short' : '';

/**
 * Sign-in state that only applies to Sveltia CMS Additions.
 */
export const additionsAuth = $state({
  /**
   * A user who signed in with a temporary password and must choose a new one before going on. The
   * prehash of the temporary password is kept to authorize the change, never the password itself.
   * @type {{ username: string, siteId: string, sessionToken: string, currentPrehash: string } |
   * undefined}
   */
  passwordChange: undefined,
  /**
   * Ways to sign in that the service offers, e.g. `github`, besides the password.
   * @type {string[]}
   */
  signInMethods: [],
});

/**
 * Client ID sent with the PKCE sign-in. The service doesn’t check it: it only lets the CMS use its
 * existing OAuth code.
 */
const CLIENT_ID = 'sveltia-cms';

/**
 * Get the OAuth endpoint configuration of the service, for the PKCE sign-in.
 * @returns {{ clientId: string, tokenURL: string }} Configuration.
 */
const getOAuthConfig = () => ({
  clientId: CLIENT_ID,
  tokenURL: `${getAdditionsURL()}/v1/auth/token`,
});

/**
 * Site IDs of the services this CMS has talked to, by service URL. A site’s ID doesn’t change, and
 * it salts every password derivation, so it’s only fetched once.
 * @type {Map<string, string>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const siteIds = new Map();

/**
 * Get the service’s `/version` and make sure this CMS can work with it.
 * @returns {Promise<{ site_id: string, package: string, version: string, sign_in_methods?: string[]
 * }>} Version info.
 * @throws {Error} When the service uses an incompatible API or password derivation.
 */
export const getServiceInfo = async () => {
  const info = await fetchAdditions('/version');

  if (info?.api !== API_VERSION || info?.kdf !== KDF_VERSION) {
    throw new Error('Incompatible Sveltia CMS Additions service', {
      cause: {
        message: _('additions.error.incompatible', { values: { url: getAdditionsURL() } }),
      },
    });
  }

  siteIds.set(getAdditionsURL(), info.site_id);

  return info;
};

/**
 * Get the ID of the site, which salts the password derivation. It’s read from `/version` the first
 * time only, which the sign-in page has usually done already to list the sign-in methods.
 * @returns {Promise<string>} Site ID.
 * @throws {Error} When the service can’t be reached, or uses an incompatible API.
 */
export const getSiteId = async () =>
  siteIds.get(getAdditionsURL()) ?? (await getServiceInfo()).site_id;

/**
 * Load the ways to sign in that the service offers, for the sign-in page. Nothing but the password
 * is offered if the service can’t be reached.
 * @returns {Promise<void>}
 */
export const loadSignInMethods = async () => {
  try {
    const { sign_in_methods: methods = [] } = await getServiceInfo();

    additionsAuth.signInMethods = methods.filter(
      (/** @type {string} */ method) => method !== 'password',
    );
  } catch {
    additionsAuth.signInMethods = [];
  }
};

/**
 * Sign in through a provider in a popup, with PKCE. The service sends the popup back to this page
 * with a one-time code, which the popup exchanges for the GitHub token and the session token.
 * @param {string} provider Provider, e.g. `github`.
 * @param {() => Promise<string>} [getLink] Function that gets a reference to the signed-in user, to
 * link the provider’s account to them rather than sign in. It’s called once the popup has opened,
 * as a browser may block a popup that doesn’t open right after the click.
 * @returns {Promise<{ token: string, refreshToken?: string }>} GitHub token and session token.
 * @throws {Error} When the sign-in fails or the popup is closed.
 */
const authorizeWithProvider = (provider, getLink) => {
  const authURL = `${getAdditionsURL()}/v1/auth/start/${provider}`;

  return initClientSideAuth({
    backendName: 'github',
    clientId: CLIENT_ID,
    authURL: getLink
      ? async () => `${authURL}?link=${encodeURIComponent(await getLink())}`
      : authURL,
    scope: '',
  });
};

/**
 * Finish a sign-in through a provider in its popup: exchange the code, or pass on the error the
 * service sent back.
 * @returns {Promise<void>}
 */
const finishProviderSignIn = async () => {
  const errorCode = new URLSearchParams(window.location.search).get('error');

  if (errorCode) {
    await LocalStorage.delete('sveltia-cms.auth');
    // The state names the channel the error goes over if the popup has lost its opener
    sendMessage({
      provider: 'github',
      state: new URLSearchParams(window.location.search).get('state') ?? undefined,
      error: getErrorMessage(errorCode),
      errorCode,
    });

    return;
  }

  await handleClientSideAuthPopup({
    backendName: 'github',
    apiConfig: /** @type {any} */ (getOAuthConfig()),
  });
};

/**
 * Get the signed-in user’s session, with a GitHub token for the site’s repository, and turn it into
 * the CMS’s user object. The GitHub token is the backend token the API requests use, and the
 * session token takes the place of the refresh token: when GitHub refuses the token, the CMS’s
 * usual refresh exchanges the session token for a new one at the service’s token endpoint.
 * @param {string} sessionToken Session token.
 * @returns {Promise<User>} User.
 * @throws {Error} When the session is invalid, or the service has no GitHub App set up yet.
 */
export const getSessionUser = async (sessionToken) => {
  const { user: account, git } = await fetchAdditions('/v1/auth/session', { token: sessionToken });

  // An admin has reset the password: the temporary one has to be changed first, which only a
  // sign-in with it can do
  if (account.must_change_password) {
    throw new Error('The password has to be changed', {
      cause: { status: 403, message: _('additions.error.temporary_password') },
    });
  }

  if (!git) {
    throw new Error('Sveltia CMS Additions has no GitHub App set up', {
      cause: { status: 409, message: _('additions.error.not_set_up') },
    });
  }

  // The ID isn’t passed on: the CMS takes `id` for a GitHub user ID, e.g. in commit metadata
  return {
    backendName: 'github',
    name: account.name,
    login: account.username,
    email: account.email ?? undefined,
    role: account.role,
    // An older release of the service doesn’t say; everyone had a password until GitHub sign-in
    hasPassword: account.has_password ?? true,
    commitAuthor: git.commit_author,
    ownGitHubToken: git.kind === 'user',
    tokenExpiresAt: git.expires_at,
    token: git.token,
    refreshToken: sessionToken,
  };
};

/**
 * Sign in to Sveltia CMS Additions. An automatic sign-in validates the cached session; a manual one
 * signs in with a username and password, or through a provider such as GitHub in a popup. A user
 * with a temporary password is asked to change it first, through {@link additionsAuth}, and the
 * sign-in finishes once they have.
 * @param {SignInOptions} options Options.
 * @returns {Promise<User | undefined>} User, or `undefined` when there is nothing to sign in with
 * or the password has to be changed first.
 * @throws {Error} When signing in fails.
 */
export const signInWithAdditions = async ({ auto, refreshToken, username, password, provider }) => {
  // This window is the popup of a sign-in through a provider
  if (auto && isAuthPopup()) {
    await finishProviderSignIn();

    return undefined;
  }

  if (refreshToken) {
    return getSessionUser(refreshToken);
  }

  if (provider && !auto) {
    const { refreshToken: sessionToken } = await authorizeWithProvider(provider);

    return getSessionUser(/** @type {string} */ (sessionToken));
  }

  if (auto || !username || !password) {
    return undefined;
  }

  const siteId = await getSiteId();
  const prehash = await derivePrehash({ siteId, username, password });
  /** @type {{ session_token: string, user: any }} */
  let result;

  try {
    result = await fetchAdditions('/v1/auth/sign-in', {
      method: 'POST',
      body: { username, prehash },
    });
  } catch (ex) {
    // The site ID may have changed, e.g. for a site deleted and added again while this page was
    // open, which makes every password look wrong; it’s read again for the next try
    siteIds.delete(getAdditionsURL());
    throw ex;
  }

  const { session_token: sessionToken, user: account } = result;

  if (account.must_change_password) {
    additionsAuth.passwordChange = {
      username: account.username,
      siteId,
      sessionToken,
      currentPrehash: prehash,
    };

    return undefined;
  }

  return getSessionUser(sessionToken);
};

/**
 * Change the password of the user who must replace a temporary one.
 * @param {string} newPassword New password.
 * @returns {Promise<string>} New session token, as every session ends with the change.
 * @throws {Error} When no change is pending, or the service refuses it.
 */
export const changeTemporaryPassword = async (newPassword) => {
  const pending = additionsAuth.passwordChange;

  if (!pending) {
    throw new Error('No password change is pending');
  }

  /** @type {string} */
  let sessionToken;

  try {
    ({ session_token: sessionToken } = await fetchAdditions('/v1/auth/password', {
      method: 'POST',
      token: pending.sessionToken,
      body: {
        current_prehash: pending.currentPrehash,
        new_prehash: await derivePrehash({
          siteId: pending.siteId,
          username: pending.username,
          password: newPassword,
        }),
      },
    }));
  } catch (/** @type {any} */ ex) {
    // The session has expired or was ended, e.g. by an admin resetting the password again, so the
    // change can only be retried after signing in again: go back to the sign-in form
    if (ex.cause?.status === 401) {
      additionsAuth.passwordChange = undefined;
    }

    throw ex;
  }

  additionsAuth.passwordChange = undefined;

  return sessionToken;
};

/**
 * Give up choosing a new password in place of a temporary one, e.g. for an account that isn’t the
 * user’s, and go back to the sign-in form. The session the temporary password started is ended.
 * @returns {Promise<void>}
 */
export const cancelPasswordChange = async () => {
  const pending = additionsAuth.passwordChange;

  additionsAuth.passwordChange = undefined;

  if (pending) {
    // eslint-disable-next-line no-use-before-define
    await endSession(pending.sessionToken);
  }
};

/**
 * Change the signed-in user’s password. The service ends every session and revokes every GitHub
 * token of the user, so the CMS carries on with the new session it returns.
 * @param {string} currentPassword Current password.
 * @param {string} newPassword New password.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the change, e.g. because the current password is wrong.
 */
export const changePassword = async (currentPassword, newPassword) => {
  const { account } = /** @type {{ account: User }} */ (user);
  const siteId = await getSiteId();
  const username = /** @type {string} */ (account.login);

  const [currentPrehash, newPrehash] = await Promise.all(
    [currentPassword, newPassword].map((password) => derivePrehash({ siteId, username, password })),
  );

  const { session_token: sessionToken } = await fetchWithSession('/v1/auth/password', {
    method: 'POST',
    body: { current_prehash: currentPrehash, new_prehash: newPrehash },
  });

  // Keep the new session first: the previous one has ended, and the CMS refreshes the GitHub token
  // with whatever session it has
  user.account = { ...account, refreshToken: sessionToken };

  try {
    user.account = await getSessionUser(sessionToken);
  } catch {
    // The password has been changed anyway; the GitHub token is refreshed at the next request
  }
};

/**
 * Change the signed-in user’s own name, which also sets the author of their commits. The account is
 * read again from the service afterwards, so the new commit author applies at once. Only an admin
 * can change the email.
 * @param {string} name New name.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses the change.
 */
export const changeName = async (name) => {
  const { account } = /** @type {{ account: User }} */ (user);

  const { user: updated } = await fetchWithSession('/v1/auth/profile', {
    method: 'PATCH',
    body: { name },
  });

  // Shown at once, even if reading the account again fails. The account as it is now, as the
  // token may have been renewed during the request
  user.account = { .../** @type {User} */ (user.account), name: updated.name };

  try {
    user.account = await getSessionUser(/** @type {string} */ (account.refreshToken));
  } catch {
    // The name has been changed anyway; the commit author is updated at the next token refresh
  }
};

/**
 * End a session on the service, which also revokes its GitHub token. Errors are ignored: the
 * session expires on its own, and nothing the user does waits for this.
 * @param {string} sessionToken Session token.
 * @returns {Promise<void>}
 */
const endSession = async (sessionToken) => {
  try {
    await fetchAdditions('/v1/auth/sign-out', { method: 'POST', token: sessionToken });
  } catch {
    //
  }
};

/**
 * Link a GitHub account to the signed-in user, who can then sign in with it, and gets their own
 * GitHub token: their commits are then their own. The link happens in a popup like a sign-in, which
 * starts a new session; the previous one is ended.
 * @returns {Promise<void>}
 * @throws {Error} When linking fails or the popup is closed.
 */
export const linkGitHubAccount = async () => {
  const { refreshToken: previousSession } = /** @type {User} */ (user.account);

  try {
    const { refreshToken: sessionToken } = await authorizeWithProvider(
      'github',
      async () =>
        (await fetchAdditions('/v1/auth/link/github', { method: 'POST', token: previousSession }))
          .link,
    );

    user.account = await getSessionUser(/** @type {string} */ (sessionToken));
  } finally {
    // The popup flow overwrites the stored account; store it again, whatever the outcome, unless
    // the user has signed out in the meantime
    if (user.account) {
      user.account = { ...user.account };
    }
  }

  // A signed-in user of Sveltia CMS Additions always has a session
  await endSession(/** @type {string} */ (previousSession));
};

/**
 * Sign out from Sveltia CMS Additions, which ends the session and revokes its GitHub token. Errors
 * are ignored: the session expires on its own, and signing out locally mustn’t depend on the
 * service.
 * @returns {Promise<void>}
 */
export const signOutFromAdditions = async () => {
  const sessionToken = user.account?.refreshToken;

  additionsAuth.passwordChange = undefined;

  if (sessionToken) {
    await endSession(sessionToken);
  }
};

/**
 * How long before the GitHub token expires it’s refreshed.
 */
const REFRESH_MARGIN = 5 * 60 * 1000;

/**
 * How often the token’s expiry is checked.
 */
export const REFRESH_CHECK_INTERVAL = 60 * 1000;

/**
 * Refresh the GitHub token if it expires soon, so a request never has to fail first. A token that
 * couldn’t be refreshed is still refreshed when GitHub refuses it.
 * @returns {Promise<void>}
 */
export const refreshTokenIfNeeded = async () => {
  const { tokenExpiresAt, refreshToken } = user.account ?? {};

  if (
    !tokenExpiresAt ||
    !refreshToken ||
    Date.parse(tokenExpiresAt) - Date.now() > REFRESH_MARGIN
  ) {
    return;
  }

  try {
    await refreshAccessToken({ ...getOAuthConfig(), refreshToken });
  } catch {
    //
  }
};

/**
 * Keep the GitHub token fresh for as long as the user is signed in.
 * @returns {() => void} Function that stops it.
 */
export const startTokenRefresh = () => {
  const timer = setInterval(refreshTokenIfNeeded, REFRESH_CHECK_INTERVAL);

  return () => {
    clearInterval(timer);
  };
};
