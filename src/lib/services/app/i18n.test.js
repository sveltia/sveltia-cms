import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Simplified locale data used by the locale module mocks
const mockEnData = { hello: 'Hello', world: 'World' };
const mockJaData = { hello: 'こんにちは', world: '世界' };
// Sveltia UI strings for the default locale, statically imported from the package in production
const mockDefaultComponentStrings = { button: 'Button (bundled)' };

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
const mockRegister = vi.fn();
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
  register: mockRegister,
}));

vi.mock('$lib/services/app', () => ({
  version: '1.2.3',
}));

vi.mock('@sveltia/ui', () => ({
  strings: mockComponentStrings,
}));

vi.mock('@sveltia/ui/locales/en-US.yaml', () => ({ default: mockDefaultComponentStrings }));

vi.mock('@sveltia/utils/file', () => ({
  getPathInfo: mockGetPathInfo,
}));

const mockLocalStorage = { get: vi.fn(), set: vi.fn() };

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

/** @type {{ locale: string | null }} */
const mockPrefs = { locale: 'en-US' };

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: mockPrefs,
}));

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.get.mockResolvedValue(undefined);
    mockLocalStorage.set.mockResolvedValue(undefined);
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

  describe('initAppLocale in development', () => {
    it('should load locale modules and initialize locales', async () => {
      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockAddMessages.mock.calls.map(([locale]) => locale)).toEqual(
        expect.arrayContaining(Object.keys(mockComponentStrings)),
      );
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
        fallbackLocale: 'en-US',
        initialLocale: 'en-US',
      });
    });

    it('should fall back to navigator locale when no prefs locale', async () => {
      mockPrefs.locale = null;
      mockGetLocaleFromNavigator.mockReturnValue('ja-JP');

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'ja-JP',
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
        fallbackLocale: 'en-US',
        initialLocale: 'en-US',
      });
    });

    it('should handle empty navigator locale string', async () => {
      mockPrefs.locale = null;
      mockGetLocaleFromNavigator.mockReturnValue('');

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-US',
      });
    });
  });

  describe('initAppLocale in production', () => {
    beforeEach(async () => {
      vi.stubEnv('DEV', false);

      const { appLocaleLoadError } = await import('./i18n.js');

      appLocaleLoadError.set(undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('should bundle the default locale only and register loaders for the others', async () => {
      const { APP_LOCALES, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockAddMessages).toHaveBeenCalledTimes(1);
      // The component strings come from the `@sveltia/ui` subpath import, not from `strings`, so
      // that the other locales are not bundled
      expect(mockAddMessages).toHaveBeenCalledWith('en-US', {
        hello: 'Hello',
        world: 'World',
        _sui: mockDefaultComponentStrings,
      });

      expect(mockRegister.mock.calls.map(([locale]) => locale)).toEqual(
        APP_LOCALES.filter((locale) => locale !== 'en-US'),
      );

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-US',
      });
    });

    it('should fetch the strings from the CDN when a registered loader is called', async () => {
      const strings = { hello: 'こんにちは', _sui: { button: 'ボタン' } };
      // eslint-disable-next-line jsdoc/require-jsdoc
      const mockFetch = vi.fn(async () => ({ ok: true, json: () => Promise.resolve(strings) }));

      vi.stubGlobal('fetch', mockFetch);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      await expect(loader()).resolves.toEqual(strings);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://unpkg.com/@sveltia/cms@1.2.3/locales/ja.json',
        { signal: expect.any(AbortSignal) },
      );

      // The fetched strings are cached along with the locale and app version
      expect(mockLocalStorage.set).toHaveBeenCalledWith('sveltia-cms.locale', {
        _locale: 'ja',
        _version: '1.2.3',
        ...strings,
      });
    });

    it('should use the cached strings without hitting the CDN', async () => {
      const strings = { hello: 'こんにちは', _sui: { button: 'ボタン' } };
      const mockFetch = vi.fn();

      vi.stubGlobal('fetch', mockFetch);
      mockLocalStorage.get.mockResolvedValue({ _locale: 'ja', _version: '1.2.3', ...strings });

      const { appLocaleLoading, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      // The metadata is stripped from the returned strings
      await expect(loader()).resolves.toEqual(strings);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLocalStorage.set).not.toHaveBeenCalled();
      // A cache hit is instant, so no loading notification is shown
      expect(get(appLocaleLoading)).toBeUndefined();
    });

    it('should ignore the cache for another locale or app version', async () => {
      const strings = { hello: 'こんにちは' };
      // eslint-disable-next-line jsdoc/require-jsdoc
      const mockFetch = vi.fn(async () => ({ ok: true, json: () => Promise.resolve(strings) }));

      vi.stubGlobal('fetch', mockFetch);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      // Cached strings for a different locale
      mockLocalStorage.get.mockResolvedValue({ _locale: 'ru', _version: '1.2.3', hello: 'Привет' });
      await expect(loader()).resolves.toEqual(strings);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cached strings from an older app version
      mockLocalStorage.get.mockResolvedValue({
        _locale: 'ja',
        _version: '1.0.0',
        hello: 'こんにちわ',
      });
      await expect(loader()).resolves.toEqual(strings);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Cached metadata without any strings
      mockLocalStorage.get.mockResolvedValue({ _locale: 'ja', _version: '1.2.3' });
      await expect(loader()).resolves.toEqual(strings);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should still load the strings when the local storage is unavailable', async () => {
      const strings = { hello: 'こんにちは' };
      // eslint-disable-next-line jsdoc/require-jsdoc
      const mockFetch = vi.fn(async () => ({ ok: true, json: () => Promise.resolve(strings) }));

      vi.stubGlobal('fetch', mockFetch);
      mockLocalStorage.get.mockRejectedValue(new Error('Permission denied'));
      mockLocalStorage.set.mockRejectedValue(new Error('Quota exceeded'));

      const { appLocaleLoadError, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      await expect(loader()).resolves.toEqual(strings);
      expect(get(appLocaleLoadError)).toBeUndefined();
    });

    it('should give up on the CDN request after a timeout', async () => {
      // `AbortSignal.timeout()` is passed to `fetch()`, so the request is aborted on its own
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

      vi.stubGlobal(
        'fetch',
        // eslint-disable-next-line jsdoc/require-jsdoc
        vi.fn(async () => ({ ok: true, json: () => Promise.resolve({}) })),
      );

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      await loader();

      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Number));
      timeoutSpy.mockRestore();
    });

    it('should report the loading state while the CDN request is in flight', async () => {
      /**
       * Resolver for the pending `fetch()` call.
       * @type {(value: any) => void}
       */
      let resolveFetch = () => undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise((resolve) => {
              resolveFetch = resolve;
            }),
        ),
      );

      const { appLocaleLoading, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      const promise = loader();

      // The loading state is set once the cache is found to be empty
      await vi.waitFor(() => {
        expect(get(appLocaleLoading)).toBe('ja');
      });

      // eslint-disable-next-line jsdoc/require-jsdoc
      resolveFetch({ ok: true, json: () => Promise.resolve({}) });
      await promise;

      expect(get(appLocaleLoading)).toBeUndefined();
    });

    it('should reset the loading state when the CDN request fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 404 })),
      );

      const { appLocaleLoading, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      await expect(loader()).rejects.toThrow();
      expect(get(appLocaleLoading)).toBeUndefined();
    });

    it('should report the failure when the CDN request fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 404 })),
      );

      const { appLocaleLoadError, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      await expect(loader()).rejects.toThrow('Failed to load the ja locale strings');
      expect(get(appLocaleLoadError)).toEqual({ locale: 'ja' });
    });

    it('should report the failure when the CDN request times out', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new DOMException('The operation timed out', 'TimeoutError'))),
      );

      const { appLocaleLoadError, initAppLocale } = await import('./i18n.js');

      initAppLocale();

      const [, loader] = /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([locale]) => locale === 'ja')
      );

      await expect(loader()).rejects.toThrow('The operation timed out');
      expect(get(appLocaleLoadError)).toEqual({ locale: 'ja' });
    });

    it('should not wait for the strings for the initial locale', async () => {
      const { initAppLocale } = await import('./i18n.js');

      // The strings for the default locale are always bundled, so the app can be rendered right
      // away, without waiting for a remote locale file
      expect(initAppLocale()).toBeUndefined();
      expect(mockInit).toHaveBeenCalled();
    });
  });
});
