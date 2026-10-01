import { _ } from '@sveltia/i18n';
import { sanitize } from 'isomorphic-dompurify';

import { LINK_SANITIZE_OPTIONS } from '$lib/services/utils/string';

/**
 * Get the localized description of an external service that requires an API key, with links to
 * the service’s website and the page where the key can be obtained, and sanitize the result.
 * @param {string} key Localization string key, e.g. `prefs.i18n.translators.description`.
 * @param {object} args Arguments.
 * @param {string} args.service Service label.
 * @param {string} args.developerURL URL of the service’s website.
 * @param {string} args.apiKeyURL URL of the page where the API key can be obtained.
 * @returns {string} Linked and sanitized HTML string.
 */
export const getServiceDescription = (key, { service, developerURL, apiKeyURL }) =>
  sanitize(
    _(key, {
      values: { service, homeHref: `href="${developerURL}"`, apiKeyHref: `href="${apiKeyURL}"` },
    })
      // Remove invisible characters used for link detection in the locale string
      .replace(/[\u2068\u2069]/g, ''),
    LINK_SANITIZE_OPTIONS,
  );
