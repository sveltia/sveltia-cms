import { UNPKG_BASE_URL } from '$lib/services/app';

/**
 * The URL of the JSON schema for Sveltia CMS configuration files. This is used to validate the
 * configuration file and provide helpful error messages when the configuration is invalid.
 * @see https://sveltiacms.app/en/docs/config-basics#validation-and-autocomplete
 */
export const SCHEMA_URL = `${UNPKG_BASE_URL}/schema/sveltia-cms.json`;

const { DEV, VITE_SITE_URL } = import.meta.env;

/**
 * The local live site URL. Local development can be done by loading a CMS config file from a
 * separate dev server. By default, this assumes a local SvelteKit site is running on port 5174
 * along with Sveltia CMS on port 5173. The site URL can be specified with the `VITE_SITE_URL`
 * environment variable. For example, run `VITE_SITE_URL=http://localhost:3000 pnpm dev` for
 * Next.js. You probably need to define the `Access-Control-Allow-Origin: *` HTTP response header
 * with the dev server’s middleware, or loading the CMS config file may fail due to a CORS error.
 */
export const DEV_SITE_URL = DEV
  ? VITE_SITE_URL || 'http://localhost:5174'
  : /* v8 ignore next */ undefined;

/**
 * Path of the CMS config file on the local live site during development.
 */
export const DEV_CONFIG_PATH = '/admin/config.yml';

/**
 * Supported MIME types for configuration files.
 */
export const SUPPORTED_TYPES = [
  'text/yaml', // legacy
  'application/yaml', // default
  'application/toml',
  'application/json',
];
