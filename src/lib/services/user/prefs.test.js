// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockLocalStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockWritable = vi.fn();
const mockAppLocale = { set: vi.fn() };
const mockAppLocales = ['en', 'ja', 'fr'];
const mockGet = vi.fn();

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
  it('should export prefs and prefsError stores', async () => {
    mockWritable.mockReturnValue({ subscribe: vi.fn() });

    const module = await import('./prefs.js');

    expect(module.prefs).toBeDefined();
    expect(module.prefsError).toBeDefined();
  });

  it('should create stores with proper initialization', async () => {
    mockWritable.mockReturnValue({ subscribe: vi.fn() });
    mockLocalStorage.get.mockResolvedValue({ locale: 'ja' });

    await import('./prefs.js');

    expect(mockWritable).toHaveBeenCalledTimes(2);
  });
});
