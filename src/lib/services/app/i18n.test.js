import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create a working mock for import.meta.glob
const mockLocaleModules = {
  '$lib/locales/en.js': { strings: { hello: 'Hello', world: 'World' } },
  '$lib/locales/ja.js': { strings: { hello: 'こんにちは', world: '世界' } },
};

// Mock all dependencies first
const mockAddMessages = vi.fn();
const mockInitLocales = vi.fn();
const mockGetLocaleFromNavigator = vi.fn();
const mockGet = vi.fn();
const mockGetPathInfo = vi.fn();

vi.mock('@sveltia/ui', () => ({
  initLocales: mockInitLocales,
}));

vi.mock('svelte-i18n', () => ({
  addMessages: mockAddMessages,
  getLocaleFromNavigator: mockGetLocaleFromNavigator,
}));

vi.mock('svelte/store', () => ({
  get: mockGet,
}));

vi.mock('@sveltia/utils/file', () => ({
  getPathInfo: mockGetPathInfo,
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: { locale: 'en' },
}));

// Mock import.meta.glob by using dynamic import mocking
vi.doMock('$lib/locales/en.js', () => mockLocaleModules['$lib/locales/en.js']);
vi.doMock('$lib/locales/ja.js', () => mockLocaleModules['$lib/locales/ja.js']);

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up getPathInfo to extract filename correctly
    mockGetPathInfo.mockImplementation((path) => {
      const match = path.match(/([^/]+)\.js$/);

      return { filename: match ? match[1] : 'unknown' };
    });
  });

  describe('initAppLocale', () => {
    it('should load locale modules and initialize locales', async () => {
      mockGet.mockReturnValue({ locale: 'en' });

      // Mock import.meta.glob for this test
      const originalGlob = import.meta.glob;

      import.meta.glob = vi.fn().mockReturnValue(mockLocaleModules);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockAddMessages).toHaveBeenCalledTimes(2);
      expect(mockAddMessages).toHaveBeenCalledWith('en', { hello: 'Hello', world: 'World' });
      expect(mockAddMessages).toHaveBeenCalledWith('ja', { hello: 'こんにちは', world: '世界' });

      expect(mockInitLocales).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });

      // Restore original
      import.meta.glob = originalGlob;
    });

    it('should fall back to navigator locale when no prefs locale', async () => {
      mockGet.mockReturnValue({ locale: null });
      mockGetLocaleFromNavigator.mockReturnValue('ja-JP');

      // Mock import.meta.glob
      const originalGlob = import.meta.glob;

      import.meta.glob = vi.fn().mockReturnValue(mockLocaleModules);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInitLocales).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'ja',
      });

      // Restore original
      import.meta.glob = originalGlob;
    });

    it('should fall back to en when no prefs and no navigator locale', async () => {
      mockGet.mockReturnValue({ locale: null });
      mockGetLocaleFromNavigator.mockReturnValue(null);

      // Mock import.meta.glob
      const originalGlob = import.meta.glob;

      import.meta.glob = vi.fn().mockReturnValue(mockLocaleModules);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInitLocales).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });

      // Restore original
      import.meta.glob = originalGlob;
    });

    it('should handle empty navigator locale string', async () => {
      mockGet.mockReturnValue({ locale: null });
      mockGetLocaleFromNavigator.mockReturnValue('');

      // Mock import.meta.glob
      const originalGlob = import.meta.glob;

      import.meta.glob = vi.fn().mockReturnValue(mockLocaleModules);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInitLocales).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });

      // Restore original
      import.meta.glob = originalGlob;
    });
  });
});
