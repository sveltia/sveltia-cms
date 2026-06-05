import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simplified locale data used by the locale module mocks
const mockEnData = { hello: 'Hello', world: 'World' };
const mockJaData = { hello: 'こんにちは', world: '世界' };
// Mock all dependencies first
const mockAddMessages = vi.fn();
const mockInit = vi.fn();
const mockGetLocaleFromNavigator = vi.fn();
const mockGetPathInfo = vi.fn();

vi.mock('$lib/locales/en.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/ja.yaml', () => ({ default: mockJaData }));

vi.mock('@sveltia/i18n', () => ({
  addMessages: mockAddMessages,
  getLocaleFromNavigator: mockGetLocaleFromNavigator,
  init: mockInit,
  locale: { current: 'en' },
}));

vi.mock('@sveltia/utils/file', () => ({
  getPathInfo: mockGetPathInfo,
}));

/** @type {{ locale: string | null }} */
const mockPrefs = { locale: 'en' };

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: mockPrefs,
}));

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrefs.locale = 'en';

    // Set up getPathInfo to extract filename correctly
    mockGetPathInfo.mockImplementation((path) => {
      const match = path.match(/([^/]+)\.yaml$/);

      return { filename: match ? match[1] : 'unknown' };
    });
  });

  describe('initAppLocale', () => {
    it('should load locale modules and initialize locales', async () => {
      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockAddMessages).toHaveBeenCalledTimes(2);
      expect(mockAddMessages).toHaveBeenCalledWith('en', { hello: 'Hello', world: 'World' });
      expect(mockAddMessages).toHaveBeenCalledWith('ja', { hello: 'こんにちは', world: '世界' });

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });
    });

    it('should fall back to navigator locale when no prefs locale', async () => {
      mockPrefs.locale = null;
      mockGetLocaleFromNavigator.mockReturnValue('ja-JP');

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'ja',
      });
    });

    it('should fall back to en when no prefs and no navigator locale', async () => {
      mockPrefs.locale = null;
      mockGetLocaleFromNavigator.mockReturnValue(null);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });
    });

    it('should handle empty navigator locale string', async () => {
      mockPrefs.locale = null;
      mockGetLocaleFromNavigator.mockReturnValue('');

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });
    });
  });
});
