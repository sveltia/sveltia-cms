/**
 * @import { I18nFileStructure } from '$lib/types/public';
 */

/**
 * I18n structure types.
 * @type {Record<string, I18nFileStructure>}
 * @internal
 * @todo Remove the legacy `MULTIPLE_FOLDERS_I18N_ROOT` structure prior to the 1.0 release.
 */
export const I18N_STRUCTURES = {
  SINGLE_FILE: 'single_file',
  SINGLE_FILE_DEFAULT_ROOT: 'single_file_default_root',
  MULTIPLE_FILES: 'multiple_files',
  MULTIPLE_FOLDERS: 'multiple_folders',
  MULTIPLE_FOLDERS_I18N_ROOT: 'multiple_folders_i18n_root', // deprecated
  MULTIPLE_ROOT_FOLDERS: 'multiple_root_folders', // new name
};

/**
 * I18n structures that store each locale’s copy of the whole site below a folder named after it, so
 * a locale name comes in front of a collection’s own folder. The other structures either keep one
 * file per entry or put the locale folder inside the collection folder.
 * @type {I18nFileStructure[]}
 * @internal
 */
export const LOCALE_ROOT_FOLDER_STRUCTURES = [
  I18N_STRUCTURES.MULTIPLE_FOLDERS_I18N_ROOT,
  I18N_STRUCTURES.MULTIPLE_ROOT_FOLDERS,
];

/**
 * Default locale identifier.
 * @internal
 */
export const DEFAULT_LOCALE_KEY = '_default';

/**
 * Default canonical slug configuration.
 * @internal
 */
export const DEFAULT_CANONICAL_SLUG = {
  key: 'translationKey',
  value: '{{slug}}',
};
