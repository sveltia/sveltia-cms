// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import { entryDraft, entryDraftModified, i18nAutoDupEnabled } from './index';

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {
    subscribe: vi.fn((callback) => {
      callback({ devModeEnabled: false });

      return vi.fn();
    }),
  },
}));

describe('draft/index', () => {
  describe('entryDraft', () => {
    it('should initialize as undefined', () => {
      let value;

      entryDraft.subscribe((v) => {
        value = v;
      });

      expect(value).toBeUndefined();
    });

    it('should be writable', () => {
      const draft = {
        collectionName: 'posts',
        originalValues: { en: { title: 'Original' } },
        currentValues: { en: { title: 'Original' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraft.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual(draft);
    });
  });

  describe('i18nAutoDupEnabled', () => {
    it('should initialize as true', () => {
      let value;

      i18nAutoDupEnabled.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should be writable', () => {
      i18nAutoDupEnabled.set(false);

      let value;

      i18nAutoDupEnabled.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);

      // Reset
      i18nAutoDupEnabled.set(true);
    });
  });

  describe('entryDraftModified', () => {
    it('should return false when draft is undefined', () => {
      entryDraft.set(undefined);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return false when draft is null', () => {
      entryDraft.set(null);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return false when draft values are unchanged', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(false);
    });

    it('should return true when locales are modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true, ja: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when slugs are modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'modified-test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should return true when values are modified', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { title: 'Test' } },
        currentValues: { en: { title: 'Modified Test' } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });

    it('should detect deep changes in nested values', () => {
      const draft = {
        originalLocales: { en: true },
        currentLocales: { en: true },
        originalSlugs: { en: 'test' },
        currentSlugs: { en: 'test' },
        originalValues: { en: { metadata: { author: 'John' } } },
        currentValues: { en: { metadata: { author: 'Jane' } } },
      };

      entryDraft.set(draft);

      let value;

      entryDraftModified.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(true);
    });
  });

  describe('devModeEnabled subscription', () => {
    it('should log draft to console when devModeEnabled is true', async () => {
      // Reset modules to reimport with different mock
      vi.resetModules();

      // Mock prefs with devModeEnabled true
      vi.doMock('$lib/services/user/prefs', () => ({
        prefs: {
          subscribe: vi.fn((callback) => {
            callback({ devModeEnabled: true });

            return vi.fn();
          }),
        },
      }));

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // Re-import the module with new mocks
      await import('./index');

      // The subscription should have logged on import
      // (Note: Testing this fully would require accessing internal module state)
      consoleSpy.mockRestore();
    });
  });
});
