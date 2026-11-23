export { dependencies, version } from 'virtual:package-info';

/**
 * Origin of the UNPKG CDN, which serves npm packages. The CMS loads its locales and other files
 * from there, so a site’s Content Security Policy already allows it.
 */
export const UNPKG_ORIGIN = 'https://unpkg.com';

/**
 * Name of the CMS package on npm.
 */
export const PACKAGE_NAME = '@sveltia/cms';

/**
 * Base URL for the CMS on the UNPKG CDN.
 */
export const UNPKG_BASE_URL = `${UNPKG_ORIGIN}/${PACKAGE_NAME}`;

/**
 * URL of the Sveltia CMS repository on GitHub.
 */
export const REPOSITORY_URL = 'https://github.com/sveltia/sveltia-cms';

/**
 * Base URL for the Sveltia CMS documentation.
 */
export const DOCS_BASE_URL = 'https://sveltiacms.app/en/docs';
