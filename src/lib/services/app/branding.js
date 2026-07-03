import { encodeBase64 } from '@sveltia/utils/file';
import mime from 'mime';
import { derived } from 'svelte/store';

import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
import { cmsConfig } from '$lib/services/config';
import {
  THUMBNAIL_TRANSFORM_OPTIONS,
  transformImage,
} from '$lib/services/utils/media/image/transform';

/**
 * @import { Readable } from 'svelte/store';
 * @import { InternalImageTransformationOptions } from '$lib/types/private';
 */

const IMAGE_DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/;

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
 * The app title, derived from the CMS configuration’s `app_title` field.
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
  const match = url.match(IMAGE_DATA_URL_REGEX);

  if (match) {
    return match[1];
  }

  return mime.getType(url) ?? undefined;
});

/**
 * Get a data URL for the given image blob, transformed to the specified options. This is used to
 * generate the app icon for the CMS manifest and Apple touch icon.
 * @param {Blob} blob Original image blob.
 * @param {InternalImageTransformationOptions} options Transformation options.
 * @returns {Promise<string>} Data URL of the transformed image.
 */
const getDataURL = async (blob, options) => {
  const transformedBlob = await transformImage(blob, options);
  const data = await encodeBase64(transformedBlob);

  return `data:image/webp;base64,${data}`;
};

/**
 * The app icon URL, derived from the app logo URL. It generates a WebP thumbnail of the logo for
 * use in the app manifest and as the Apple touch icon. If the transformation fails, it falls back
 * to no icon. The available sizes are 192x192 and 512x512, which are recommended for PWA support.
 * @type {Readable<{ small: string, large: string } | undefined>}
 * @see https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest
 */
export const appIconURLs = derived([appLogoURL], ([logoURL], set) => {
  (async () => {
    try {
      const response = await fetch(logoURL);

      if (!response.ok) {
        throw new Error('Failed to fetch logo');
      }

      const blob = await response.blob();

      const [small, large] = await Promise.all([
        getDataURL(blob, { ...THUMBNAIL_TRANSFORM_OPTIONS, width: 192, height: 192 }),
        getDataURL(blob, THUMBNAIL_TRANSFORM_OPTIONS),
      ]);

      set({ small, large });
    } catch {
      set(undefined);
    }
  })();
});

/**
 * The app manifest URL, derived from the app title and logo. It generates a data URL containing a
 * JSON manifest for the CMS, which can be used for PWA support.
 * @type {Readable<string | undefined>}
 * @see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
 */
export const appManifestURL = derived([appTitle, appIconURLs], ([title, iconURLs]) => {
  if (!iconURLs) {
    return undefined;
  }

  const manifest = {
    name: title,
    short_name: title,
    start_url: '.',
    display: 'standalone',
    icons: [
      { src: iconURLs.small, sizes: '192x192', type: 'image/webp' },
      { src: iconURLs.large, sizes: '512x512', type: 'image/webp' },
    ],
  };

  return `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
});
