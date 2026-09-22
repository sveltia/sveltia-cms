// @ts-nocheck
import { afterEach, describe, expect, it } from 'vitest';

import { GIT_CONFIG_FILE_REGEX, gitConfigFiles } from './config';

describe('git/shared/config', () => {
  afterEach(() => {
    gitConfigFiles.current = [];
  });

  describe('GIT_CONFIG_FILE_REGEX', () => {
    it('should match Git configuration files', () => {
      expect(GIT_CONFIG_FILE_REGEX.test('.gitattributes')).toBe(true);
      expect(GIT_CONFIG_FILE_REGEX.test('.gitignore')).toBe(true);
      expect(GIT_CONFIG_FILE_REGEX.test('.gitkeep')).toBe(true);
      expect(GIT_CONFIG_FILE_REGEX.test('path/to/.gitattributes')).toBe(true);
      expect(GIT_CONFIG_FILE_REGEX.test('src/.gitignore')).toBe(true);
      expect(GIT_CONFIG_FILE_REGEX.test('empty-folder/.gitkeep')).toBe(true);
    });

    it('should not match other files', () => {
      expect(GIT_CONFIG_FILE_REGEX.test('README.md')).toBe(false);
      expect(GIT_CONFIG_FILE_REGEX.test('.git/config')).toBe(false);
      expect(GIT_CONFIG_FILE_REGEX.test('package.json')).toBe(false);
      expect(GIT_CONFIG_FILE_REGEX.test('gitattributes')).toBe(false);
    });
  });

  describe('gitConfigFiles store', () => {
    it('should be a writable store with empty initial value', () => {
      expect(gitConfigFiles.current).toEqual([]);
    });

    it('should be writable', () => {
      const testFiles = [
        { path: '.gitattributes', text: '*.pdf filter=lfs' },
        { path: '.gitignore', text: 'node_modules/' },
      ];

      gitConfigFiles.current = testFiles;
      expect(gitConfigFiles.current).toEqual(testFiles);
    });
  });
});
