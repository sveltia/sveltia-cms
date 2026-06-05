/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-description */
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLocalStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockAppLocale = { set: vi.fn() };

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}));

vi.mock('@sveltia/i18n', () => ({
  locale: mockAppLocale,
  locales: ['en', 'ja', 'fr'],
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

    global.document = /** @type {any} */ ({
      documentElement: { dataset: {} },
    });

    global.window = /** @type {any} */ ({
      matchMedia: vi.fn(() => ({ matches: false })),
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
  });

  it('should set app locale when valid locale is loaded', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    await import('./prefs.svelte.js');

    await wait();

    expect(mockAppLocale.set).toHaveBeenCalledWith('ja');
  });

  it('should not set app locale when invalid locale is loaded', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'zz' });

    await import('./prefs.svelte.js');

    await wait();

    expect(mockAppLocale.set).not.toHaveBeenCalled();
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
