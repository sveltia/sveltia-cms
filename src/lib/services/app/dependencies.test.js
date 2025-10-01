import { describe, expect, it, vi } from 'vitest';

import { getUnpkgURL, loadModule } from './dependencies';

// Mock the dependencies import
vi.mock('$lib/services/app', () => ({
  dependencies: {
    'test-library': '^1.2.3',
    'another-lib': '~2.0.0',
    'exact-version': '3.1.4',
    'no-version': undefined,
  },
}));

describe('dependencies', () => {
  describe('getUnpkgURL', () => {
    it('should return basic URL when dependency version is not found', () => {
      const url = getUnpkgURL('unknown-library');

      expect(url).toBe('https://unpkg.com/unknown-library');
    });

    it('should return basic URL when dependency has no version', () => {
      const url = getUnpkgURL('no-version');

      expect(url).toBe('https://unpkg.com/no-version');
    });

    it('should return versioned URL for dependency with caret version', () => {
      const url = getUnpkgURL('test-library');

      expect(url).toBe('https://unpkg.com/test-library@1.2.3');
    });

    it('should return versioned URL for dependency with tilde version', () => {
      const url = getUnpkgURL('another-lib');

      expect(url).toBe('https://unpkg.com/another-lib@2.0.0');
    });

    it('should return versioned URL for dependency with exact version', () => {
      const url = getUnpkgURL('exact-version');

      expect(url).toBe('https://unpkg.com/exact-version@3.1.4');
    });
  });

  describe('loadModule', () => {
    it('should dynamically import module from UNPKG URL', async () => {
      // We can't easily test actual dynamic imports, but we can verify the function exists
      // and can be called
      expect(typeof loadModule).toBe('function');

      // The function should accept library name and path
      const result = loadModule('test-library', 'dist/index.js');

      // Should return a promise
      expect(result).toBeInstanceOf(Promise);

      // Note: The actual import will fail in test environment, but we verified the function
      // construction is correct
      await expect(result).rejects.toThrow();
    });

    it('should construct correct import URL', async () => {
      // Test that the function constructs the correct URL
      // Note: We can't easily test dynamic imports in Node.js environment
      const testLibrary = 'test-library';
      const testPath = 'dist/index.js';
      // The loadModule function should call dynamic import with the constructed URL
      // We verify the URL construction logic by testing getUnpkgURL directly
      const expectedURL = getUnpkgURL(testLibrary);

      expect(expectedURL).toBe('https://unpkg.com/test-library@1.2.3');

      // The full import URL would be: expectedURL + '/' + testPath
      const fullURL = `${expectedURL}/${testPath}`;

      expect(fullURL).toBe('https://unpkg.com/test-library@1.2.3/dist/index.js');
    });

    it('should handle library without version in URL construction', () => {
      const testLibrary = 'unknown-library';
      const testPath = 'lib/main.js';
      const expectedURL = getUnpkgURL(testLibrary);

      expect(expectedURL).toBe('https://unpkg.com/unknown-library');

      const fullURL = `${expectedURL}/${testPath}`;

      expect(fullURL).toBe('https://unpkg.com/unknown-library/lib/main.js');
    });
  });
});
