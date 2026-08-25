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
const mockGetPathInfo = vi.fn();

vi.mock('$lib/locales/en-CA.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/en-GB.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/en-US.yaml', () => ({ default: mockEnData }));
vi.mock('$lib/locales/ja.yaml', () => ({ default: mockJaData }));

vi.mock('@sveltia/i18n', () => ({
  addMessages: mockAddMessages,
  init: mockInit,
  locale: { current: 'en' },
  register: mockRegister,
}));

vi.mock('$lib/services/app', () => ({
  version: '1.2.3',
  UNPKG_BASE_URL: 'https://unpkg.com/@sveltia/cms',
}));

vi.mock('@sveltia/ui', () => ({
  strings: mockComponentStrings,
}));

vi.mock('@sveltia/ui/locales/en-US.yaml', () => ({ default: mockDefaultComponentStrings }));

vi.mock('@sveltia/utils/file', () => ({
  getPathInfo: mockGetPathInfo,
}));

const mockLocalStorage = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

// Locale matching the browser’s language settings, which lives in the preferences service so that
// the language preference can be applied there
const mockNavigatorLocale = { current: /** @type {string | undefined} */ (undefined) };

vi.mock('$lib/services/user/prefs.svelte', () => ({
  navigatorLocale: mockNavigatorLocale,
  PREFS_STORAGE_KEY: 'sveltia-cms.prefs',
}));

// The stored language preference is read straight from the Web Storage API, because the `prefs`
// state is not populated yet when the app starts
const mockWebStorage = { getItem: vi.fn() };

mockWebStorage.getItem.mockReturnValue(null);

/**
 * Store a language preference to be picked up as the initial locale.
 * @param {string | null} locale Locale code, or `null` to store no preference at all.
 */
const setStoredLocale = (locale) => {
  mockWebStorage.getItem.mockReturnValue(locale === null ? null : JSON.stringify({ locale }));
};

/**
 * Set the browser’s preferred languages, which the initial locale is negotiated against when there
 * is no usable language preference.
 * @param {string[]} languages Language tags, in order of preference.
 */
const setNavigatorLanguages = (languages) => {
  vi.stubGlobal('navigator', { languages });
};

// The app listens for `languagechange` on `window`, which doesn’t exist in the Node environment
const mockWindow = { addEventListener: vi.fn() };

/**
 * Simulate a change to the browser’s language settings.
 * @param {string[]} languages New language tags, in order of preference.
 */
const changeNavigatorLanguages = (languages) => {
  setNavigatorLanguages(languages);
  mockWindow.addEventListener.mock.calls
    .filter(([type]) => type === 'languagechange')
    .forEach(([, listener]) => listener());
};

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.get.mockResolvedValue(undefined);
    mockLocalStorage.set.mockResolvedValue(undefined);
    mockLocalStorage.delete.mockResolvedValue(undefined);
    vi.stubGlobal('localStorage', mockWebStorage);
    setStoredLocale('en-US');
    setNavigatorLanguages(['en-US']);
    mockNavigatorLocale.current = undefined;
    vi.stubGlobal('window', mockWindow);
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

    it('should start with the stored language preference, not the browser language', async () => {
      // The preferences are loaded asynchronously, so reading `prefs.locale` here would always come
      // up empty and the app would start with the browser’s language, load and cache the strings
      // for it, and then throw that cache away once the preference is applied — on every visit
      setStoredLocale('ja');
      setNavigatorLanguages(['en-CA']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'ja',
      });
    });

    it('should ignore a stored locale that is not available', async () => {
      // `en` is the legacy value, which is migrated once the preferences are loaded
      setStoredLocale('en');
      setNavigatorLanguages(['en-CA']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-CA',
      });
    });

    it('should ignore unreadable stored preferences', async () => {
      mockWebStorage.getItem.mockReturnValue('{ not json');
      setNavigatorLanguages(['en-CA']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-CA',
      });
    });

    it('should ignore an unavailable local storage', async () => {
      mockWebStorage.getItem.mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      setNavigatorLanguages(['en-CA']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-CA',
      });
    });

    it('should ignore a stored preference that parses to a non-object value', async () => {
      mockWebStorage.getItem.mockReturnValue('null');
      setNavigatorLanguages(['en-CA']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-CA',
      });
    });

    it('should resolve the automatic language preference against the browser languages', async () => {
      // The same locale is resolved once the preferences are loaded, so the strings fetched and
      // cached here are not thrown away
      setStoredLocale('auto');
      setNavigatorLanguages(['ja-JP']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'ja',
      });
    });

    it('should keep the browser language up to date for the automatic preference', async () => {
      setStoredLocale('auto');
      setNavigatorLanguages(['ja-JP']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockNavigatorLocale.current).toBe('ja');

      changeNavigatorLanguages(['fr-CA']);

      expect(mockNavigatorLocale.current).toBe('fr');
    });

    it('should fall back to navigator locale when no stored locale', async () => {
      setStoredLocale(null);
      setNavigatorLanguages(['ja-JP']);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
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

    it('should fall back to en when no stored preference and no navigator locale', async () => {
      setStoredLocale(null);
      setNavigatorLanguages([]);

      const { initAppLocale } = await import('./i18n.js');

      initAppLocale();

      expect(mockInit).toHaveBeenCalledWith({
        fallbackLocale: 'en-US',
        initialLocale: 'en-US',
      });
    });

    it('should handle empty navigator locale string', async () => {
      setStoredLocale(null);
      setNavigatorLanguages(['']);

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

  describe('getNavigatorLocale', () => {
    /**
     * Resolve the given browser languages against the available application locales.
     * @param {string[]} languages Language tags, in order of preference.
     * @returns {Promise<string>} Locale code.
     */
    const resolve = async (languages) => {
      setNavigatorLanguages(languages);

      const { getNavigatorLocale } = await import('./i18n.js');

      return getNavigatorLocale();
    };

    it('should pick an exact match', async () => {
      expect(await resolve(['pt-BR'])).toBe('pt-BR');
    });

    it('should pick a locale with the same language', async () => {
      expect(await resolve(['ja-JP'])).toBe('ja');
      expect(await resolve(['zh-Hans-CN'])).toBe('zh-CN');
    });

    it('should prefer the default locale over another variant of the same language', async () => {
      expect(await resolve(['en'])).toBe('en-US');
      expect(await resolve(['en-AU'])).toBe('en-US');
    });

    it('should honour the order of the browser languages', async () => {
      expect(await resolve(['sw', 'fi-FI', 'ja'])).toBe('fi');
    });

    it('should fall back to the default locale when nothing matches', async () => {
      expect(await resolve(['sw', 'yo'])).toBe('en-US');
    });
  });

  describe('updateLocaleCache', () => {
    /** @type {Record<string, Record<string, string>>} */
    const remoteStrings = {
      ja: { hello: 'こんにちは' },
      ru: { hello: 'Привет' },
    };

    /**
     * Get the loader registered for the given locale.
     * @param {string} locale Locale code.
     * @returns {() => Promise<any>} Loader.
     */
    const getLoader = (locale) =>
      /** @type {[string, () => Promise<any>]} */ (
        mockRegister.mock.calls.find(([code]) => code === locale)
      )[1];

    beforeEach(() => {
      vi.stubEnv('DEV', false);
      // Start with a clean module state, so the strings loaded by the other tests don’t leak in
      vi.resetModules();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (/** @type {string} */ url) => ({
          ok: true,
          // eslint-disable-next-line jsdoc/require-jsdoc
          json: async () => remoteStrings[/** @type {string} */ (url.match(/\/(\w+)\.json$/)?.[1])],
        })),
      );
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('should cache the strings again when switching back to a locale used earlier', async () => {
      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();

      // The user switches to Japanese, then to Russian; each loader caches the fetched strings
      await getLoader('ja')();
      await getLoader('ru')();

      expect(mockLocalStorage.set).toHaveBeenLastCalledWith('sveltia-cms.locale', {
        _locale: 'ru',
        _version: '1.2.3',
        ...remoteStrings.ru,
      });

      mockLocalStorage.get.mockResolvedValue({
        _locale: 'ru',
        _version: '1.2.3',
        ...remoteStrings.ru,
      });
      mockLocalStorage.set.mockClear();

      // Switching back to Japanese doesn’t call the loader again, because `sveltia-i18n` keeps the
      // strings in memory, but the cache still has to be updated
      await updateLocaleCache('ja');

      expect(mockLocalStorage.set).toHaveBeenCalledWith('sveltia-cms.locale', {
        _locale: 'ja',
        _version: '1.2.3',
        ...remoteStrings.ja,
      });
      // The strings are reused from memory, so the CDN is not hit again
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should keep the cache intact when the strings are not loaded', async () => {
      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();
      mockLocalStorage.get.mockClear();
      mockLocalStorage.set.mockClear();

      // A locale still being loaded is not cached here; its loader does that once done
      await updateLocaleCache('ja');

      expect(mockLocalStorage.get).not.toHaveBeenCalled();
      expect(mockLocalStorage.set).not.toHaveBeenCalled();
      expect(mockLocalStorage.delete).not.toHaveBeenCalled();
    });

    it('should discard the cache when switching back to the default locale', async () => {
      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();

      await getLoader('ja')();

      // The strings for the default locale are bundled with the app, so the cached Japanese strings
      // are of no use anymore
      await updateLocaleCache('en-US');

      expect(mockLocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.locale');
    });

    it('should keep the cache when the app starts with the default locale', async () => {
      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();

      // The app starts with the browser’s language, and the stored language preference is applied a
      // moment later, so the cached strings for that language must survive
      await updateLocaleCache('en-US');

      expect(mockLocalStorage.delete).not.toHaveBeenCalled();
    });

    it('should keep loading the strings when the cache cannot be discarded', async () => {
      mockLocalStorage.delete.mockRejectedValue(new Error('Permission denied'));

      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();

      await getLoader('ja')();
      await expect(updateLocaleCache('en-US')).resolves.toBeUndefined();
    });

    it('should skip the write when the cache is already up to date', async () => {
      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();

      await getLoader('ja')();

      mockLocalStorage.get.mockResolvedValue({
        _locale: 'ja',
        _version: '1.2.3',
        ...remoteStrings.ja,
      });
      mockLocalStorage.set.mockClear();

      await updateLocaleCache('ja');

      expect(mockLocalStorage.get).toHaveBeenCalledWith('sveltia-cms.locale');
      expect(mockLocalStorage.set).not.toHaveBeenCalled();
    });

    it('should reuse the cached strings when switching back to a locale loaded from the cache', async () => {
      const { initAppLocale, updateLocaleCache } = await import('./i18n.js');

      initAppLocale();

      // Japanese comes from the cache left by a previous session, so the CDN is not hit
      mockLocalStorage.get.mockResolvedValue({
        _locale: 'ja',
        _version: '1.2.3',
        ...remoteStrings.ja,
      });
      await getLoader('ja')();
      expect(globalThis.fetch).not.toHaveBeenCalled();

      // The user then switches to Russian, which overwrites the cache
      await getLoader('ru')();
      mockLocalStorage.get.mockResolvedValue({
        _locale: 'ru',
        _version: '1.2.3',
        ...remoteStrings.ru,
      });
      mockLocalStorage.set.mockClear();

      await updateLocaleCache('ja');

      expect(mockLocalStorage.set).toHaveBeenCalledWith('sveltia-cms.locale', {
        _locale: 'ja',
        _version: '1.2.3',
        ...remoteStrings.ja,
      });
    });
  });
});
