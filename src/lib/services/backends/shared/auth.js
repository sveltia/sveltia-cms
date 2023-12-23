import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { isObject } from '$lib/services/utils/misc';

/**
 * Authenticate with the Git service through Netlify Identity or 3rd party OAuth client specified
 * with the configuration file.
 * @param {string} provider - Provider name, e.g. `github`.
 * @returns {Promise<?string>} Auth token or `null` if authentication failed.
 * @see https://decapcms.org/docs/backends-overview/
 */
export const authorize = async (provider) => {
  const {
    site_domain: siteDomain = document.domain,
    base_url: baseURL = 'https://api.netlify.com',
    auth_endpoint: path = 'auth',
  } = get(siteConfig).backend;

  const width = 600;
  const height = 800;
  const { availHeight, availWidth } = window.screen;
  const top = availHeight / 2 - height / 2;
  const left = availWidth / 2 - width / 2;

  const popup = window.open(
    `${baseURL}/${path}?provider=${provider}&site_id=${siteDomain}&scope=repo`,
    'auth',
    `width=${width},height=${height},top=${top},left=${left}`,
  );

  return new Promise((resolve) => {
    /**
     * Message event handler.
     * @param {object} args - Arguments.
     * @param {string} args.origin - Origin URL.
     * @param {string} args.data - Passed data.
     */
    const handler = ({ origin, data }) => {
      if (origin !== baseURL || typeof data !== 'string') {
        return;
      }

      // First message
      if (data === `authorizing:${provider}`) {
        popup.postMessage(data, origin);

        return;
      }

      // Second message
      const [, state, _result] =
        data.match(`^authorization:${provider}:(success|error):(.+)`) ?? [];

      /**
       * @type {{ token: string }}
       */
      let result;

      try {
        result = _result ? JSON.parse(_result) : undefined;
      } catch {
        //
      }

      resolve(
        state === 'success' && isObject(result) && typeof result.token === 'string'
          ? result.token
          : null,
      );

      window.removeEventListener('message', handler);
      popup.close();
    };

    window.addEventListener('message', handler);
  });
};
