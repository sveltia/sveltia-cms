import { describe, expect, test, vi } from 'vitest';

import { formatSize } from '$lib/services/assets/file-size';

// Mock i18n dependencies
vi.mock('@sveltia/i18n', () => ({
  locale: { current: 'en', set: vi.fn() },
  _: vi.fn((key, options) => `${key}(${options?.values?.size || ''})`),
}));

describe('Test formatSize()', () => {
  test('should format file sizes correctly', () => {
    // The formatSize function returns i18n translated strings, not just numbers
    // Test bytes
    expect(formatSize(500)).toBe('file_size_units.b(500)');
    expect(formatSize(999)).toBe('file_size_units.b(999)');

    // Test kilobytes
    expect(formatSize(1000)).toBe('file_size_units.kb(1)');
    expect(formatSize(1500)).toBe('file_size_units.kb(1.5)');
    expect(formatSize(999999)).toBe('file_size_units.kb(1,000)');

    // Test megabytes
    expect(formatSize(1000000)).toBe('file_size_units.mb(1)');
    expect(formatSize(1500000)).toBe('file_size_units.mb(1.5)');
    expect(formatSize(999999999)).toBe('file_size_units.mb(1,000)');

    // Test gigabytes
    expect(formatSize(1000000000)).toBe('file_size_units.gb(1)');
    expect(formatSize(1500000000)).toBe('file_size_units.gb(1.5)');
    expect(formatSize(999999999999)).toBe('file_size_units.gb(1,000)');

    // Test terabytes
    expect(formatSize(1000000000000)).toBe('file_size_units.tb(1)');
    expect(formatSize(1500000000000)).toBe('file_size_units.tb(1.5)');
  });

  test('should handle edge cases', () => {
    expect(formatSize(0)).toBe('file_size_units.b(0)');
    expect(formatSize(1)).toBe('file_size_units.b(1)');
  });

  test('should reuse the cached Intl.NumberFormat instance for the same locale', () => {
    // After the tests above, 'en' is already in fileSizeFormatterCache.
    // Subsequent calls for the same locale must hit the cache, not invoke the constructor.
    const spy = vi.spyOn(Intl, 'NumberFormat');

    formatSize(1000);
    formatSize(5000000);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
