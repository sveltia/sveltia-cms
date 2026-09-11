// @ts-nocheck
import { afterEach, describe, expect, it } from 'vitest';

import { GIT_CONFIG_FILE_REGEX, gitConfigFiles, lfsFileExtensions } from './config';

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

  describe('lfsFileExtensions derived store', () => {
    it('should return empty array when no .gitattributes file', () => {
      gitConfigFiles.current = [
        { path: '.gitignore', text: 'node_modules/' },
        { path: '.gitkeep', text: '' },
      ];

      expect(lfsFileExtensions.current).toEqual([]);
    });

    it('should extract LFS file extensions from .gitattributes', () => {
      gitConfigFiles.current = [
        {
          path: '.gitattributes',
          text: '*.pdf filter=lfs diff=lfs merge=lfs -text\n*.zip filter=lfs diff=lfs merge=lfs -text',
        },
      ];

      expect(lfsFileExtensions.current).toEqual(['pdf', 'zip']);
    });

    it('should handle mixed content in .gitattributes', () => {
      gitConfigFiles.current = [
        {
          path: '.gitattributes',
          text: '# Comment\n*.pdf filter=lfs diff=lfs merge=lfs -text\n*.js text eol=lf',
        },
      ];

      expect(lfsFileExtensions.current).toEqual(['pdf']);
    });

    it('should convert extensions to lowercase', () => {
      gitConfigFiles.current = [
        {
          path: '.gitattributes',
          text: '*.PDF filter=lfs diff=lfs merge=lfs -text',
        },
      ];

      expect(lfsFileExtensions.current).toEqual(['pdf']);
    });

    it('should update when gitConfigFiles changes', () => {
      // Initial state
      gitConfigFiles.current = [
        {
          path: '.gitattributes',
          text: '*.pdf filter=lfs diff=lfs merge=lfs -text',
        },
      ];

      expect(lfsFileExtensions.current).toEqual(['pdf']);

      // Remove .gitattributes
      gitConfigFiles.current = [{ path: '.gitignore', text: 'node_modules/' }];

      expect(lfsFileExtensions.current).toEqual([]);
    });
  });
});
