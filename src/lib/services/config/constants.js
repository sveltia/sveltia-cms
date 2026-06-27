/**
 * The URL of the JSON schema for Sveltia CMS configuration files. This is used to validate the
 * configuration file and provide helpful error messages when the configuration is invalid.
 * @see https://sveltiacms.app/en/docs/config-basics#validation-and-autocomplete
 */
export const SCHEMA_URL = 'https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json';

/**
 * Supported MIME types for configuration files.
 */
export const SUPPORTED_TYPES = [
  'text/yaml', // legacy
  'application/yaml', // default
  'application/toml',
  'application/json',
];
