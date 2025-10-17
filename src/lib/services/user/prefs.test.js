// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockLocalStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

/** @type {any} */
let prefsSubscribeCallback;

const mockPrefsErrorStore = {
  subscribe: vi.fn(),
  set: vi.fn(),
};

const mockPrefsStore = {
  subscribe: vi.fn((callback) => {
    prefsSubscribeCallback = callback;

    return vi.fn();
  }),
};

const mockWritable = vi.fn((initialValue, startCallback) => {
  if (startCallback) {
    // Save the start callback and invoke it
    const setter = vi.fn((value) => {
      // Call the subscribe callback when set is called
      if (prefsSubscribeCallback) {
        prefsSubscribeCallback(value);
      }
    });

    setTimeout(() => startCallback(setter), 0);

    return mockPrefsStore;
  }

  // Return error store for prefsError
  return mockPrefsErrorStore;
});

const mockAppLocale = { set: vi.fn() };
const mockAppLocales = { subscribe: vi.fn() };
const mockGet = vi.fn(() => ['en', 'ja', 'fr']);

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}));

vi.mock('svelte/store', () => ({
  get: mockGet,
  writable: mockWritable,
}));

vi.mock('svelte-i18n', () => ({
  locale: mockAppLocale,
  locales: mockAppLocales,
}));

describe('prefs service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.get.mockResolvedValue({});
    mockWritable.mockClear();
    prefsSubscribeCallback = undefined;

    // Setup document.documentElement.dataset
    global.document = /** @type {any} */ ({
      documentElement: {
        dataset: {},
      },
    });

    // Setup window.matchMedia
    global.window = /** @type {any} */ ({
      matchMedia: vi.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export prefs and prefsError stores', async () => {
    const module = await import('./prefs.js');

    expect(module.prefs).toBeDefined();
    expect(module.prefsError).toBeDefined();
  });

  it('should handle LocalStorage.set failure gracefully', async () => {
    mockLocalStorage.get.mockResolvedValue({ locale: 'en' });
    mockLocalStorage.set.mockRejectedValue(new Error('Storage error'));

    await import('./prefs.js');

    // Wait for async initialization
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    // Manually trigger subscribe callback with different prefs to test save failure
    if (prefsSubscribeCallback) {
      const testPrefs = { locale: 'fr', theme: 'dark' };

      prefsSubscribeCallback(testPrefs);

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // Should not throw even if set fails (catch block on lines 54-55)
      expect(mockLocalStorage.set).toHaveBeenCalled();
    }
  });

  it('should set app locale when valid locale is provided', async () => {
    mockLocalStorage.get.mockResolvedValue({});
    mockGet.mockReturnValue(['en', 'ja', 'fr']);

    await import('./prefs.js');

    // Wait for initialization
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    // Trigger the subscribe callback with a valid locale
    if (prefsSubscribeCallback) {
      prefsSubscribeCallback({ locale: 'ja' });

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // Lines 67-68 should be covered
      expect(mockAppLocale.set).toHaveBeenCalledWith('ja');
    }
  });

  it('should not set app locale when invalid locale is provided', async () => {
    mockLocalStorage.get.mockResolvedValue({});
    mockGet.mockReturnValue(['en', 'ja', 'fr']);

    await import('./prefs.js');

    // Wait for initialization
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    mockAppLocale.set.mockClear();

    // Trigger the subscribe callback with an invalid locale
    if (prefsSubscribeCallback) {
      prefsSubscribeCallback({ locale: 'invalid-locale' });

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(mockAppLocale.set).not.toHaveBeenCalled();
    }
  });

  it('should use dark theme when system prefers dark mode', async () => {
    mockLocalStorage.get.mockResolvedValue({});

    // Mock matchMedia to return dark mode preference
    global.window = /** @type {any} */ ({
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    await import('./prefs.js');

    // Wait for initialization
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    // Trigger the subscribe callback with auto theme
    if (prefsSubscribeCallback) {
      prefsSubscribeCallback({ theme: 'auto' });

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // Should set theme to 'dark' based on matchMedia result (line 71)
      expect(global.document.documentElement.dataset.theme).toBe('dark');
    }
  });
});
