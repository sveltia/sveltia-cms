import { readPackageJson, virtualModule } from './utils.js';

/**
 * Bundle the version and the dependency ranges from `package.json`, which the app needs to pin the
 * libraries it loads from the CDN. Importing the file itself would ship all of it, the scripts and
 * development dependencies included.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export const bundlePackageInfo = () =>
  virtualModule({
    name: 'bundle-package-info',
    id: 'virtual:package-info',
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: () => {
      const { version, dependencies } = readPackageJson();

      return [
        `export const version = ${JSON.stringify(version)};`,
        `export const dependencies = ${JSON.stringify(dependencies)};`,
      ].join('\n');
    },
  });

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
export const bundleMimeTypes = () =>
  virtualModule({
    name: 'bundle-mime-types',
    id: 'virtual:mime-other-types',
    // eslint-disable-next-line jsdoc/require-jsdoc
    load: async () => {
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
