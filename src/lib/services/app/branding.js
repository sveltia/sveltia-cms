import mime from 'mime';
import { derived } from 'svelte/store';

import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
import { cmsConfig } from '$lib/services/config';

/**
 * @import { Readable } from 'svelte/store';
 */

/**
 * Default title for the CMS, used when `app_title` is not specified in the configuration.
 */
export const DEFAULT_APP_TITLE = 'Sveltia CMS';

/**
 * Default logo for the CMS, used when `logo` is not specified in the configuration. This is a
 * base64-encoded SVG of the Sveltia logo, inlined to avoid an extra network request.
 */
export const DEFAULT_APP_LOGO_URL = `data:image/svg+xml;base64,${btoa(SveltiaLogo)}`;

/**
 * The app title, derived from the CMS configuration's `app_title` field.
 * @type {Readable<string>}
 */
export const appTitle = derived([cmsConfig], ([config]) => config?.app_title || DEFAULT_APP_TITLE);

/**
 * The app logo URL, derived from the CMS configuration. It checks both `logo.src` and the
 * deprecated `logo_url` for backward compatibility.
 * @type {Readable<string>}
 */
export const appLogoURL = derived(
  [cmsConfig],
  ([config]) => config?.logo?.src || config?.logo_url || DEFAULT_APP_LOGO_URL,
);

/**
 * The app logo MIME type, derived from the app logo URL. It extracts the MIME type from data URLs
 * or uses the file extension for regular URLs.
 * @type {Readable<string | undefined>}
 */
export const appLogoType = derived(appLogoURL, (url) => {
  const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);

  if (match) {
    return match[1];
  }

  return mime.getType(url) ?? undefined;
});
