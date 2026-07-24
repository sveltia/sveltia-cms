import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simplified locale data used by the locale module mocks
const mockEnData = { hello: 'Hello', world: 'World' };
const mockJaData = { hello: 'こんにちは', world: '世界' };

/** @type {Record<string, Record<string, string> | undefined>} */
const mockComponentStrings = {
  'en-CA': { button: 'Button' },
  'en-GB': { button: 'Button (UK)' },
  'en-US': { button: 'Button (US)' },
  ja: { button: 'ボタン' },
};

// Mock all dependencies first
const mockAddMessages = vi.fn();
const mockInit = vi.fn();
const mockGetLocaleFromNavigator = vi.fn();
const mockGetPathInfo = vi.fn();

vi.mock('$lib/locales/en-CA.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/en-GB.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/en-US.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/ja.yaml', () => ({ default: mockJaData }));

vi.mock('@sveltia/i18n', () => ({
  addMessages: mockAddMessages,
  getLocaleFromNavigator: mockGetLocaleFromNavigator,
  init: mockInit,
  locale: { current: 'en' },
}));

vi.mock('@sveltia/ui', () => ({
  strings: mockComponentStrings,
}));

vi.mock('@sveltia/utils/file', () => ({
  getPathInfo: mockGetPathInfo,
}));

/** @type {{ locale: string | null }} */
const mockPrefs = { locale: 'en-US' };

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: mockPrefs,
}));

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrefs.locale = 'en-US';
    mockComponentStrings['en-CA'] = { button: 'Button' };
    mockComponentStrings['en-GB'] = { button: 'Button (UK)' };
    mockComponentStrings['en-US'] = { button: 'Button (US)' };
    mockComponentStrings.ja = { button: 'ボタン' };

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

      expect(mockAddMessages).toHaveBeenCalledTimes(4);
      expect(mockAddMessages).toHaveBeenCalledWith('en-CA', {
        hello: 'Hello',
        world: 'World',
        _sui: { button: 'Button' },
      });
      expect(mockAddMessages).toHaveBeenCalledWith('en-GB', {
        hello: 'Hello',
        world: 'World',
        _sui: { button: 'Button (UK)' },
      });
      expect(mockAddMessages).toHaveBeenCalledWith('en-US', {
        hello: 'Hello',
        world: 'World',
        _sui: { button: 'Button (US)' },
      });
      expect(mockAddMessages).toHaveBeenCalledWith('ja', {
        hello: 'こんにちは',
        world: '世界',
        _sui: { button: 'ボタン' },
      });

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en',
        initialLocale: 'en-US',
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

    it('should use an empty object when no component strings exist for a locale', async () => {
      mockComponentStrings['en-CA'] = undefined;
      mockComponentStrings['en-GB'] = undefined;
      mockComponentStrings['en-US'] = undefined;
      mockComponentStrings.ja = undefined;

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockAddMessages).toHaveBeenCalledWith('en-CA', {
        hello: 'Hello',
        world: 'World',
        _sui: {},
      });
      expect(mockAddMessages).toHaveBeenCalledWith('en-GB', {
        hello: 'Hello',
        world: 'World',
        _sui: {},
      });
      expect(mockAddMessages).toHaveBeenCalledWith('en-US', {
        hello: 'Hello',
        world: 'World',
        _sui: {},
      });
      expect(mockAddMessages).toHaveBeenCalledWith('ja', {
        hello: 'こんにちは',
        world: '世界',
        _sui: {},
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
