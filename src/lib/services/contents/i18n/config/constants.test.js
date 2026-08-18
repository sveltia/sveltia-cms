import { describe, expect, test } from 'vitest';

import { DEFAULT_CANONICAL_SLUG, DEFAULT_LOCALE_KEY, I18N_STRUCTURES } from './constants';

describe('I18N_STRUCTURES constant', () => {
  test('should have all expected structure types', () => {
    expect(I18N_STRUCTURES).toEqual({
      SINGLE_FILE: 'single_file',
      SINGLE_FILE_DEFAULT_ROOT: 'single_file_default_root',
      MULTIPLE_FILES: 'multiple_files',
      MULTIPLE_FOLDERS: 'multiple_folders',
      MULTIPLE_FOLDERS_I18N_ROOT: 'multiple_folders_i18n_root',
      MULTIPLE_ROOT_FOLDERS: 'multiple_root_folders',
    });
  });
});

describe('DEFAULT_LOCALE_KEY constant', () => {
  test('should be _default', () => {
    expect(DEFAULT_LOCALE_KEY).toBe('_default');
  });
});

describe('DEFAULT_CANONICAL_SLUG constant', () => {
  test('should have correct default values', () => {
    expect(DEFAULT_CANONICAL_SLUG).toEqual({
      key: 'translationKey',
      value: '{{slug}}',
    });
  });
});
