import { encodeBase64 } from '@sveltia/utils/file';
import mime from 'mime';

import SveltiaLogo from '$lib/assets/sveltia-logo.svg?raw&inline';
import { cmsConfig } from '$lib/services/config';
import {
  THUMBNAIL_TRANSFORM_OPTIONS,
  transformImage,
} from '$lib/services/utils/media/image/transform';
import {
  createDerivedState,
  createRawState,
  createRootEffect,
} from '$lib/services/utils/state.svelte';

/**
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
 */
export const appTitle = createDerivedState(() => cmsConfig.current?.app_title || DEFAULT_APP_TITLE);

/**
 * The app logo URL, derived from the CMS configuration. It checks both `logo.src` and the
 * deprecated `logo_url` for backward compatibility.
 */
export const appLogoURL = createDerivedState(
  () => cmsConfig.current?.logo?.src || cmsConfig.current?.logo_url || DEFAULT_APP_LOGO_URL,
);

/**
 * The app logo MIME type, derived from the app logo URL. It extracts the MIME type from data URLs
 * or uses the file extension for regular URLs.
 */
export const appLogoType = createDerivedState(() => {
  const url = appLogoURL.current;
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
 * @type {{ current: { small: string, large: string } | undefined }}
 * @see https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest
 */
export const appIconURLs = createRawState();

createRootEffect(() => {
  // Set when a newer logo supersedes this run. Fetching and transforming the logo is asynchronous,
  // so a run that started earlier may settle after a later one has, and it must not overwrite the
  // newer icons with its own stale ones
  let superseded = false;
  const logoURL = appLogoURL.current;

  (async () => {
    /** @type {{ small: string, large: string } | undefined} */
    let iconURLs;

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

      iconURLs = { small, large };
    } catch {
      iconURLs = undefined;
    }

    if (!superseded) {
      appIconURLs.current = iconURLs;
    }
  })();

  // Called before the next run starts
  return () => {
    superseded = true;
  };
});

/**
 * The app manifest URL, derived from the app title and logo. It generates a blob URL containing a
 * JSON manifest for the CMS, which can be used for PWA support.
 * @see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
 */
export const appManifestURL = createDerivedState(() => {
  const title = appTitle.current;
  const iconURLs = appIconURLs.current;

  if (!iconURLs) {
    return undefined;
  }

  const { origin, pathname } = window.location;

  const manifest = {
    name: title,
    short_name: title,
    start_url: `${origin}${pathname}`,
    display: 'standalone',
    icons: [
      { src: iconURLs.small, sizes: '192x192', type: 'image/webp' },
      { src: iconURLs.large, sizes: '512x512', type: 'image/webp' },
    ],
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });

  // Use a blob URL instead of a data URL to prevent a long string from being inlined in the HTML.
  // The blob URL will be revoked when the page is unloaded.
  return URL.createObjectURL(blob);
});
