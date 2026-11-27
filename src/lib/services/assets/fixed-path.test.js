import { describe, expect, it } from 'vitest';

import { hasFixedPath } from '$lib/services/assets/fixed-path';
import { createMockAssetFolder } from '$lib/test/factories';

describe('assets/fixed-path', () => {
  describe('hasFixedPath', () => {
    it('should accept a plain folder, including the root folder', () => {
      expect(hasFixedPath(createMockAssetFolder())).toBe(true);
      expect(hasFixedPath(createMockAssetFolder({ internalPath: '' }))).toBe(true);
    });

    it('should reject the All Assets folder', () => {
      expect(hasFixedPath(undefined)).toBe(false);
      expect(hasFixedPath(createMockAssetFolder({ internalPath: undefined }))).toBe(false);
    });

    it('should reject an entry-relative folder or one with template tags', () => {
      expect(hasFixedPath(createMockAssetFolder({ entryRelative: true }))).toBe(false);
      expect(hasFixedPath(createMockAssetFolder({ hasTemplateTags: true }))).toBe(false);
    });
  });
});
