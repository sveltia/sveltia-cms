/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-description */
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLocalStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockAppLocale = {
  current: '',
  set: vi.fn((/** @type {string} */ locale) => {
    mockAppLocale.current = locale;
  }),
};

const mockWaitLocale = vi.fn(async () => undefined);
/**
 * Loaded locales, keyed by locale code.
 * @type {Record<string, any>}
 */
const mockDictionary = {};

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}));

vi.mock('@sveltia/i18n', () => ({
  dictionary: mockDictionary,
  locale: mockAppLocale,
  locales: ['en-CA', 'en-GB', 'en-US', 'ja', 'fr'],
  waitLocale: mockWaitLocale,
}));

/** @param {number} [ms] */
const wait = (ms = 50) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe('prefs service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.get.mockResolvedValue({});
    mockAppLocale.current = '';

    // All the locales have their strings loaded unless a test says otherwise
    Object.keys(mockDictionary).forEach((key) => delete mockDictionary[key]);
    ['en-CA', 'en-GB', 'en-US', 'ja', 'fr'].forEach((key) => {
      mockDictionary[key] = {};
    });

    global.document = /** @type {any} */ ({
      documentElement: { dataset: {} },
    });

    global.window = /** @type {any} */ ({
      matchMedia: vi.fn(() => ({ matches: false })),
    });

    global.navigator = /** @type {any} */ ({
      languages: ['en-US', 'ja'],
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export prefs and prefsError', async () => {
    const module = await import('./prefs.svelte.js');

    expect(module.prefs).toBeDefined();
    expect(module).toHaveProperty('prefsError');
  });

  it('should populate prefs from LocalStorage on init', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    const { prefs } = await import('./prefs.svelte.js');

    await wait();

    expect(prefs.locale).toBe('ja');
  });

  it('should apply default values when loading from empty storage', async () => {
    mockLocalStorage.get.mockResolvedValue(null);

    const { prefs } = await import('./prefs.svelte.js');

    await wait();

    expect(prefs.useDraftBackup).toBe(true);
    expect(prefs.closeOnSave).toBe(true);
    expect(prefs.closeWithEscape).toBe(true);
    expect(prefs.underlineLinks).toBe(true);
    expect(prefs.beta).toBe(false);
    expect(prefs.devModeEnabled).toBe(false);
    expect(prefs.defaultTranslationService).toBe('google');
    expect(prefs.apiKeys).toEqual({});
    expect(prefs.locale).toBe('auto');
  });

  it('should set app locale when valid locale is loaded', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    await import('./prefs.svelte.js');

    await wait();

    expect(mockAppLocale.set).toHaveBeenCalledWith('ja');
  });

  it('should load the locale strings before setting the app locale', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    await import('./prefs.svelte.js');

    await wait();

    expect(mockWaitLocale).toHaveBeenCalledWith('ja');
    expect(mockWaitLocale.mock.invocationCallOrder[0]).toBeLessThan(
      mockAppLocale.set.mock.invocationCallOrder[0],
    );
  });

  it('should not reload the locale strings when an unrelated preference is updated', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    const { prefs } = await import('./prefs.svelte.js');

    await wait();

    expect(mockWaitLocale).toHaveBeenCalledTimes(1);
    mockWaitLocale.mockClear();
    mockAppLocale.set.mockClear();

    prefs.beta = true;

    await wait();

    // Retrying can be costly, as the strings for a locale that failed to load are fetched again
    expect(mockWaitLocale).not.toHaveBeenCalled();
    expect(mockAppLocale.set).not.toHaveBeenCalled();
  });

  it('should revert to the previous locale when a switch fails', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    const { prefs } = await import('./prefs.svelte.js');

    await wait();

    expect(mockAppLocale.set).toHaveBeenCalledWith('ja');

    // The strings for the newly selected locale can’t be loaded
    delete mockDictionary.fr;
    prefs.locale = 'fr';

    await wait();

    expect(mockAppLocale.set).not.toHaveBeenCalledWith('fr');
    expect(prefs.locale).toBe('ja');
    expect(mockAppLocale.current).toBe('ja');
  });

  it('should keep the stored locale when its strings cannot be loaded on startup', async () => {
    // `initAppLocale()` has already set the initial locale by the time the stored preference is
    // applied, so there is a “previous” locale that must not be persisted here
    mockAppLocale.current = 'en-US';
    delete mockDictionary.fr;
    mockLocalStorage.get.mockResolvedValue({ locale: 'fr' });

    const { prefs } = await import('./prefs.svelte.js');

    await wait();

    expect(mockAppLocale.set).not.toHaveBeenCalled();
    // The preference is kept as is, so that it can be retried on the next visit
    expect(prefs.locale).toBe('fr');
  });

  it('should not set app locale when invalid locale is loaded', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'zz' });

    await import('./prefs.svelte.js');

    await wait();

    expect(mockWaitLocale).not.toHaveBeenCalled();
    expect(mockAppLocale.set).not.toHaveBeenCalled();
  });

  it('should migrate legacy locale "en" to the automatic preference', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'en' });

    const { prefs, navigatorLocale } = await import('./prefs.svelte.js');

    navigatorLocale.current = 'en-GB';

    await wait();

    expect(prefs.locale).toBe('auto');
    expect(mockAppLocale.set).toHaveBeenCalledWith('en-GB');
  });

  it('should follow the browser language when the preference is automatic', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'auto' });

    const { navigatorLocale } = await import('./prefs.svelte.js');

    navigatorLocale.current = 'ja';

    await wait();

    expect(mockWaitLocale).toHaveBeenCalledWith('ja');
    expect(mockAppLocale.set).toHaveBeenCalledWith('ja');
  });

  it('should wait for the browser language to be resolved', async () => {
    // `initAppLocale()` populates `navigatorLocale`, which may not have happened yet
    mockLocalStorage.get.mockResolvedValue({ locale: 'auto' });

    await import('./prefs.svelte.js');

    await wait();

    expect(mockWaitLocale).not.toHaveBeenCalled();
    expect(mockAppLocale.set).not.toHaveBeenCalled();
  });

  it('should switch the app locale when the browser language settings change', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'auto' });

    const { prefs, navigatorLocale } = await import('./prefs.svelte.js');

    navigatorLocale.current = 'ja';

    await wait();

    expect(mockAppLocale.set).toHaveBeenCalledWith('ja');

    navigatorLocale.current = 'fr';

    await wait();

    expect(mockAppLocale.set).toHaveBeenCalledWith('fr');
    // The preference itself is untouched, so the UI keeps following the browser
    expect(prefs.locale).toBe('auto');
  });

  it('should keep the automatic preference when a switch fails', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'auto' });

    const { prefs, navigatorLocale } = await import('./prefs.svelte.js');

    navigatorLocale.current = 'ja';

    await wait();

    // The strings for the newly detected locale can’t be loaded
    delete mockDictionary.fr;
    navigatorLocale.current = 'fr';

    await wait();

    expect(mockAppLocale.set).not.toHaveBeenCalledWith('fr');
    // Reverting to the previously active locale would silently turn the automatic mode off
    expect(prefs.locale).toBe('auto');
    expect(mockAppLocale.current).toBe('ja');
  });

  it('should set app locale when prefs.locale is mutated directly', async () => {
    mockLocalStorage.get.mockResolvedValue({});

    const { prefs } = await import('./prefs.svelte.js');

    await wait();
    mockAppLocale.set.mockClear();

    prefs.locale = 'fr';

    await wait();

    expect(mockAppLocale.set).toHaveBeenCalledWith('fr');
  });

  it('should use dark theme when system prefers dark mode', async () => {
    global.window = /** @type {any} */ ({
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    mockLocalStorage.get.mockResolvedValue({ theme: 'auto' });

    await import('./prefs.svelte.js');

    await wait();

    expect(global.document.documentElement.dataset.theme).toBe('dark');
  });

  it('should use light theme when system prefers light mode', async () => {
    global.window = /** @type {any} */ ({
      matchMedia: vi.fn(() => ({ matches: false })),
    });

    mockLocalStorage.get.mockResolvedValue({ theme: 'auto' });

    await import('./prefs.svelte.js');

    await wait();

    expect(global.document.documentElement.dataset.theme).toBe('light');
  });

  it('should use an explicit theme without auto-detection', async () => {
    mockLocalStorage.get.mockResolvedValue({ theme: 'dark' });

    await import('./prefs.svelte.js');

    await wait();

    expect(global.document.documentElement.dataset.theme).toBe('dark');
  });

  it('should set prefsError on LocalStorage.get failure', async () => {
    mockLocalStorage.get.mockRejectedValue(new Error('Permission denied'));

    const module = await import('./prefs.svelte.js');

    await wait();

    expect(module.prefsError.current).toEqual({ type: 'permission_denied' });
  });

  it('should save prefs to LocalStorage when changed', async () => {
    mockLocalStorage.get.mockResolvedValue({});
    mockLocalStorage.set.mockResolvedValue(undefined);

    const { prefs } = await import('./prefs.svelte.js');

    await wait();
    mockLocalStorage.set.mockClear();
    mockLocalStorage.get.mockResolvedValue({ beta: false });

    prefs.beta = true;

    await wait();

    expect(mockLocalStorage.set).toHaveBeenCalled();
  });

  it('should handle LocalStorage.set failure gracefully', async () => {
    mockLocalStorage.get.mockResolvedValue({});
    mockLocalStorage.set.mockRejectedValue(new Error('Storage error'));

    const { prefs } = await import('./prefs.svelte.js');

    await wait();

    prefs.beta = true;

    // Should not throw
    await expect(wait()).resolves.toBeUndefined();
  });
});
