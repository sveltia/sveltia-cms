import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simplified locale data used by the yaml.parse mock
const mockEnData = { hello: 'Hello', world: 'World' };
const mockJaData = { hello: 'こんにちは', world: '世界' };
const mockYamlParse = vi.fn();
// Mock all dependencies first
const mockAddMessages = vi.fn();
const mockInit = vi.fn();
const mockGetLocaleFromNavigator = vi.fn();
const mockGet = vi.fn();
const mockGetPathInfo = vi.fn();

vi.mock('yaml', () => ({
  parse: mockYamlParse,
}));

vi.mock('@sveltia/i18n', () => ({
  addMessages: mockAddMessages,
  getLocaleFromNavigator: mockGetLocaleFromNavigator,
  init: mockInit,
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

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up getPathInfo to extract filename correctly
    mockGetPathInfo.mockImplementation((path) => {
      const match = path.match(/([^/]+)\.yaml$/);

      return { filename: match ? match[1] : 'unknown' };
    });

    // Set up yaml.parse to return locale-appropriate test data (en first, then ja)
    mockYamlParse.mockReturnValueOnce(mockEnData).mockReturnValueOnce(mockJaData);
  });

  describe('initAppLocale', () => {
    it('should load locale modules and initialize locales', async () => {
      mockGet.mockReturnValue({ locale: 'en' });

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
      mockGet.mockReturnValue({ locale: null });
      mockGetLocaleFromNavigator.mockReturnValue('ja-JP');

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'ja',
      });
    });

    it('should fall back to en when no prefs and no navigator locale', async () => {
      mockGet.mockReturnValue({ locale: null });
      mockGetLocaleFromNavigator.mockReturnValue(null);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en',
      });
    });

    it('should handle empty navigator locale string', async () => {
      mockGet.mockReturnValue({ locale: null });
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
