/**
 * @import { I18nFileStructure } from '$lib/types/public';
 */

/**
 * I18n structure types.
 * @type {Record<string, I18nFileStructure>}
 */
export const I18N_STRUCTURES = {
  SINGLE_FILE: 'single_file',
  SINGLE_FILE_DEFAULT_ROOT: 'single_file_default_root',
  MULTIPLE_FILES: 'multiple_files',
  MULTIPLE_FOLDERS: 'multiple_folders',
  MULTIPLE_ROOT_FOLDERS: 'multiple_root_folders',
};

/**
 * Default locale identifier.
 */
export const DEFAULT_LOCALE_KEY = '_default';

/**
 * Default canonical slug configuration.
 */
export const DEFAULT_CANONICAL_SLUG = {
  key: 'translationKey',
  value: '{{slug}}',
};
