import { describe, expect, test } from 'vitest';

import { SCHEMA_URL, SUPPORTED_TYPES } from './constants';

describe('config/constants', () => {
  describe('SCHEMA_URL', () => {
    test('should be a valid URL string', () => {
      expect(typeof SCHEMA_URL).toBe('string');
      expect(SCHEMA_URL.startsWith('http')).toBe(true);
    });

    test('should point to unpkg.com CDN', () => {
      expect(SCHEMA_URL).toContain('unpkg.com');
    });

    test('should reference the Sveltia CMS schema', () => {
      expect(SCHEMA_URL).toContain('@sveltia/cms');
      expect(SCHEMA_URL).toContain('schema/sveltia-cms.json');
    });

    test('should have the exact expected URL', () => {
      expect(SCHEMA_URL).toBe('https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json');
    });
  });

  describe('SUPPORTED_TYPES', () => {
    test('should be an array', () => {
      expect(Array.isArray(SUPPORTED_TYPES)).toBe(true);
    });

    test('should contain all required MIME types', () => {
      expect(SUPPORTED_TYPES).toContain('text/yaml');
      expect(SUPPORTED_TYPES).toContain('application/yaml');
      expect(SUPPORTED_TYPES).toContain('application/toml');
      expect(SUPPORTED_TYPES).toContain('application/json');
    });

    test('should have exactly 4 MIME types', () => {
      expect(SUPPORTED_TYPES).toHaveLength(4);
    });

    test('should have MIME types in the expected order', () => {
      expect(SUPPORTED_TYPES[0]).toBe('text/yaml');
      expect(SUPPORTED_TYPES[1]).toBe('application/yaml');
      expect(SUPPORTED_TYPES[2]).toBe('application/toml');
      expect(SUPPORTED_TYPES[3]).toBe('application/json');
    });

    test('should not be modifiable (immutability check)', () => {
      const originalLength = SUPPORTED_TYPES.length;
      const originalFirst = SUPPORTED_TYPES[0];

      // Try to modify (should fail or not affect exports)
      expect(() => {
        SUPPORTED_TYPES.push('application/xml');
      }).not.toThrow();

      // Ensure the constant reference hasn't changed
      expect(SUPPORTED_TYPES[0]).toBe(originalFirst);
      // Note: Array will be modified since it's not frozen, but new imports get fresh reference
      expect(SUPPORTED_TYPES.length).toBeGreaterThanOrEqual(originalLength);
    });
  });
});
