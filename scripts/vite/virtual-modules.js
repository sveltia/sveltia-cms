import { readFile } from 'fs/promises';

/**
 * Module specifier the app imports its version and dependency ranges from.
 */
const PACKAGE_INFO_MODULE_ID = 'virtual:package-info';
const RESOLVED_PACKAGE_INFO_MODULE_ID = `\0${PACKAGE_INFO_MODULE_ID}`;

/**
 * Bundle the version and the dependency ranges from `package.json`, which the app needs to pin the
 * libraries it loads from the CDN. Importing the file itself would ship all of it, the scripts and
 * development dependencies included.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const bundlePackageInfo = () => ({
  name: 'bundle-package-info',
  // eslint-disable-next-line jsdoc/require-jsdoc
  resolveId: (id) => (id === PACKAGE_INFO_MODULE_ID ? RESOLVED_PACKAGE_INFO_MODULE_ID : null),
  // eslint-disable-next-line jsdoc/require-jsdoc
  load: async (id) => {
    if (id !== RESOLVED_PACKAGE_INFO_MODULE_ID) {
      return null;
    }

    const { version, dependencies } = JSON.parse(await readFile('package.json', 'utf-8'));

    return [
      `export const version = ${JSON.stringify(version)};`,
      `export const dependencies = ${JSON.stringify(dependencies)};`,
    ].join('\n');
  },
});

/**
 * Module specifier the app imports the media types it needs beyond the standard ones from.
 */
const MIME_TYPES_MODULE_ID = 'virtual:mime-other-types';
const RESOLVED_MIME_TYPES_MODULE_ID = `\0${MIME_TYPES_MODULE_ID}`;
/**
 * Prefixes of the vendor and experimental media types the CMS tells apart: it sorts assets into
 * images, videos and audio by type, and opens text files in its editor.
 */
const MIME_TYPE_PREFIX_REGEX = /^(?:image|video|audio|text)\//;
/**
 * Extensions of the documents the CMS lists as such, as in `DOC_EXTENSION_REGEX` of
 * `src/lib/services/assets/kinds.js`, to show their type in the asset details.
 */
const MIME_DOC_EXTENSION_REGEX = /^(?:csv|docx?|odp|ods|odt|pdf|pptx?|rtf|xlsx?)$/;

/**
 * Bundle the vendor and experimental media types of the `mime` package that the CMS needs, along
 * with the standard ones of `mime/lite`. The full table holds hundreds of types for files a CMS
 * never deals with, which come to about 6 KB of the compressed bundle.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const bundleMimeTypes = () => ({
  name: 'bundle-mime-types',
  // eslint-disable-next-line jsdoc/require-jsdoc
  resolveId: (id) => (id === MIME_TYPES_MODULE_ID ? RESOLVED_MIME_TYPES_MODULE_ID : null),
  // eslint-disable-next-line jsdoc/require-jsdoc
  load: async (id) => {
    if (id !== RESOLVED_MIME_TYPES_MODULE_ID) {
      return null;
    }

    /** @type {Record<string, string[]>} */
    const { default: otherTypes } = await import('mime/types/other.js');

    const types = Object.fromEntries(
      Object.entries(otherTypes).filter(
        ([type, extensions]) =>
          MIME_TYPE_PREFIX_REGEX.test(type) ||
          extensions.some((extension) => MIME_DOC_EXTENSION_REGEX.test(extension)),
      ),
    );

    return `export default ${JSON.stringify(types)};`;
  },
});
