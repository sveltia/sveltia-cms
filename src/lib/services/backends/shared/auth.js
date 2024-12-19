import { generateRandomId, generateUUID, getHash } from '@sveltia/utils/crypto';
import { LocalStorage } from '@sveltia/utils/storage';
import { _ } from 'svelte-i18n';
import { get, writable } from 'svelte/store';

export const inAuthPopup = writable(false);

/**
 * Authenticate with a Git service provider through Netlify Identity or other 3rd party OAuth client
 * specified with the configuration file.
 * @param {object} args - Arguments.
 * @param {string} args.backendName - Backend name, e.g. `github`.
 * @param {string} args.authURL - Authentication site URL.
 * @returns {Promise<string>} Auth token.
 * @throws {Error} When authentication failed or the popup window is closed before the auth process
 * is complete.
 * @see https://decapcms.org/docs/backends-overview/
 */
const authorize = async ({ backendName, authURL }) => {
  const width = 600;
  const height = 800;
  const { availHeight, availWidth } = window.screen;
  const top = availHeight / 2 - height / 2;
  const left = availWidth / 2 - width / 2;

  const popup = window.open(
    authURL,
    'auth',
    `width=${width},height=${height},top=${top},left=${left}`,
  );

  return new Promise((resolve, reject) => {
    /**
     * Timer to check if the popup is closed. This doesn’t work with GitLab; `window.closed` will
     * always be `true`.
     */
    const timer =
      backendName === 'github'
        ? setInterval(() => {
            if (popup?.closed) {
              clearInterval(timer);
              reject(Object.assign(new Error('Authentication aborted'), { name: 'AbortError' }));
            }
          }, 1000)
        : 0;

    /**
     * Message event handler.
     * @param {object} args - Arguments.
     * @param {string} args.origin - Origin URL.
     * @param {string} args.data - Passed data.
     */
    const handler = ({ origin, data }) => {
      if (origin !== new URL(authURL).origin || typeof data !== 'string') {
        return;
      }

      const provider = backendName;

      // First message
      if (data === `authorizing:${provider}`) {
        popup?.postMessage(data, origin);

        return;
      }

      // Second message
      const { result: resultStr } =
        data.match(`^authorization:${provider}:(success|error):(?<result>.+)`)?.groups ?? {};

      /** @type {{ token?: string, error?: string, errorCode?: string }} */
      let result;

      try {
        result = resultStr ? JSON.parse(resultStr) : { error: 'No data' };
      } catch {
        result = { error: 'Malformed data' };
      }

      if (typeof result?.token === 'string') {
        resolve(result.token);
      } else {
        reject(
          new Error('Authentication failed', {
            cause: new Error(
              result?.errorCode
                ? get(_)(`sign_in_error.${result.errorCode}`, { default: result?.error })
                : result?.error,
            ),
          }),
        );
      }

      window.removeEventListener('message', handler);
      clearInterval(timer);
      popup?.close();
    };

    window.addEventListener('message', handler);
  });
};

/**
 * Initialize the server-side Authorization Code Flow.
 * @param {object} args - Arguments.
 * @param {string} args.backendName - Backend name, e.g. `github`.
 * @param {string} args.siteDomain - Domain of the site hosting the CMS.
 * @param {string} args.authURL - Authorization site URL.
 * @param {string} args.scope - Authorization scope.
 * @returns {Promise<string>} Auth token.
 */
export const initServerSideAuth = async ({ backendName, siteDomain, authURL, scope }) => {
  const params = new URLSearchParams({
    provider: backendName,
    site_id: siteDomain,
    scope,
  });

  return authorize({
    backendName,
    authURL: `${authURL}?${params.toString()}`,
  });
};

/**
 * Create a code verifier and challenge for PKCE auth along with a CSRF token.
 * @returns {Promise<{ csrfToken: string, codeVerifier: string, codeChallenge: string}>} Secrets.
 * @see https://stackoverflow.com/questions/63309409/creating-a-code-verifier-and-challenge-for-pkce-auth-on-spotify-api-in-reactjs
 */
const createAuthSecrets = async () => {
  const codeVerifier = `${generateRandomId()}${generateRandomId()}`;

  const codeChallenge = btoa(
    await getHash(codeVerifier, { algorithm: 'SHA-256', format: 'binary' }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return {
    csrfToken: generateUUID().replaceAll('-', ''),
    codeVerifier,
    codeChallenge,
  };
};

/**
 * Initialize the client-side Authorization Code Flow with PKCE.
 * @param {object} args - Arguments.
 * @param {string} args.backendName - Backend name, e.g. `gitlab`.
 * @param {string} args.clientId - OAuth application ID.
 * @param {string} args.authURL - Authorization site URL.
 * @param {string} args.scope - Authorization scope.
 * @returns {Promise<string>} Auth token.
 * @see https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-with-proof-key-for-code-exchange-pkce
 */
export const initClientSideAuth = async ({ backendName, clientId, authURL, scope }) => {
  const { csrfToken, codeVerifier, codeChallenge } = await createAuthSecrets();
  const { origin, pathname } = window.location;
  const redirectURL = `${origin}${pathname}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectURL,
    response_type: 'code',
    state: csrfToken,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Store the temporary secret and real auth URL
  await LocalStorage.set('sveltia-cms.auth', {
    csrfToken,
    codeVerifier,
    realAuthURL: `${authURL}?${params.toString()}`,
  });

  // Store the user info only with the backend name, so the automatic sign-in flow that triggers
  // `finishClientSideAuth` below will work
  await LocalStorage.set('sveltia-cms.user', { backendName });

  return authorize({
    backendName,
    authURL: redirectURL,
  });
};

/**
 * Communicate with the window opener as part of {@link finishClientSideAuth}.
 * @param {object} args - Options.
 * @param {string} [args.provider] - Backend name, e,g. `github`.
 * @param {string} [args.token] - OAuth token.
 * @param {string} [args.error] - Error message when an OAuth token is not available.
 * @param {string} [args.errorCode] - Error code to be used to localize the error message in
 * Sveltia CMS.
 */
const sendMessage = ({ provider = 'unknown', token, error, errorCode }) => {
  const _state = error ? 'error' : 'success';
  const content = error ? { provider, error, errorCode } : { provider, token };

  window.addEventListener('message', ({ data, origin }) => {
    if (data === `authorizing:${provider}`) {
      window.opener?.postMessage(
        `authorization:${provider}:${_state}:${JSON.stringify(content)}`,
        origin,
      );
    }
  });

  window.opener?.postMessage(`authorizing:${provider}`, '*');
};

/**
 * Complete the client-side Authorization Code Flow with PKCE by retrieving an access token and
 * passing it to the window opener. This code is to be called within the auth popup window and
 * basically does the same thing as the callback handler of Sveltia CMS Authenticator.
 * @param {object} args - Arguments.
 * @param {string} args.backendName - Backend name, e.g. `gitlab`.
 * @param {string} args.clientId - OAuth application ID.
 * @param {string} args.authURL - Authorization site URL.
 * @param {string} args.code - Authorization code.
 * @param {string} args.state - Authorization state, which is a CSRF token previously set.
 * @returns {Promise<void>} None.
 * @see https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-with-proof-key-for-code-exchange-pkce
 * @see https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 */
export const finishClientSideAuth = async ({ backendName, clientId, authURL, code, state }) => {
  const { origin, pathname } = new URL(window.location.href);
  const { csrfToken, codeVerifier } = (await LocalStorage.get('sveltia-cms.auth')) ?? {};
  const provider = backendName;
  const redirectURL = `${origin}${pathname}`;

  // Remove the temporary secret
  await LocalStorage.delete('sveltia-cms.auth');

  if (!csrfToken || !codeVerifier || state !== csrfToken) {
    return sendMessage({
      provider,
      error: get(_)('sign_in_error.CSRF_DETECTED'),
      errorCode: 'CSRF_DETECTED',
    });
  }

  let response;
  let token = '';
  let error = '';

  try {
    response = await fetch(authURL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectURL,
        code_verifier: codeVerifier,
      }),
    });
  } catch {
    //
  }

  if (!response) {
    return sendMessage({
      provider,
      error: get(_)('sign_in_error.TOKEN_REQUEST_FAILED'),
      errorCode: 'TOKEN_REQUEST_FAILED',
    });
  }

  try {
    ({ access_token: token, error } = await response.json());
  } catch {
    return sendMessage({
      provider,
      error: get(_)('sign_in_error.MALFORMED_RESPONSE'),
      errorCode: 'MALFORMED_RESPONSE',
    });
  }

  return sendMessage({ provider, token, error });
};

/**
 * Handle the client-side Authorization Code Flow with PKCE within the auth popup window. Redirect
 * to the authorization site or finish the flow after being redirected from the auth site.
 * @param {object} args - Arguments.
 * @param {string} args.backendName - Backend name, e.g. `gitlab`.
 * @param {string} args.clientId - OAuth application ID.
 * @param {string} args.authURL - Authorization site URL.
 */
export const handleClientSideAuthPopup = async ({ backendName, clientId, authURL }) => {
  inAuthPopup.set(true);

  const { search } = window.location;
  const { code, state } = Object.fromEntries(new URLSearchParams(search));

  if (code && state) {
    await finishClientSideAuth({ backendName, clientId, authURL, code, state });
  } else {
    const { realAuthURL } = (await LocalStorage.get('sveltia-cms.auth')) ?? {};

    if (realAuthURL) {
      window.location.href = realAuthURL;
    }
  }
};
