import { describe, expect, test, vi } from 'vitest';

import { getFileTypeLabel } from '$lib/services/assets/file-type';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn(
    (key, { default: fallback }) =>
      /** @type {Record<string, string>} */ ({
        'file_type_labels.png': 'PNG image',
        'file_type_labels.svg': 'SVG image',
      })[key] ?? fallback,
  ),
}));

describe('Test getFileTypeLabel()', () => {
  test('labels a file by its extension, regardless of the case', () => {
    expect(getFileTypeLabel('photo.png')).toBe('PNG image');
    expect(getFileTypeLabel('/uploads/LOGO.SVG')).toBe('SVG image');
  });

  test('falls back to the extension in upper case for an unknown type', () => {
    expect(getFileTypeLabel('data.xyz')).toBe('XYZ');
    expect(getFileTypeLabel('README')).toBe('');
  });

  test('uses the given fallback for an unknown type', () => {
    expect(getFileTypeLabel('data.xyz', { fallback: 'Other' })).toBe('Other');
    expect(getFileTypeLabel('photo.png', { fallback: 'Other' })).toBe('PNG image');
  });
});
