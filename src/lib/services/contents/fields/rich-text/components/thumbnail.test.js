import { describe, expect, test, vi } from 'vitest';

import { getComponentThumbnail } from '$lib/services/contents/fields/rich-text/components/thumbnail';

const { mockGetObjectThumbnail } = vi.hoisted(() => ({ mockGetObjectThumbnail: vi.fn() }));

vi.mock('$lib/services/contents/fields/object/thumbnail', () => ({
  getObjectThumbnail: mockGetObjectThumbnail,
}));

const baseArgs = { componentName: 'x-icon', collectionName: 'posts' };

describe('getComponentThumbnail()', () => {
  test('returns nothing without the option or values', () => {
    expect(getComponentThumbnail({ ...baseArgs, values: { icon: '/a.svg' } })).toBeUndefined();
    expect(getComponentThumbnail({ ...baseArgs, thumbnailFieldName: 'icon' })).toBeUndefined();
    expect(mockGetObjectThumbnail).not.toHaveBeenCalled();
  });

  test('looks up the field among the component values', () => {
    const entry = /** @type {any} */ ({ id: 'post' });
    const files = /** @type {any} */ ({});

    mockGetObjectThumbnail.mockReturnValue({ url: 'https://example.com/a.svg' });

    expect(
      getComponentThumbnail({
        ...baseArgs,
        thumbnailFieldName: 'media.src',
        values: { media: { src: '/a.svg' }, title: 'A' },
        fileName: 'about',
        isIndexFile: true,
        entry,
        files,
      }),
    ).toEqual({ url: 'https://example.com/a.svg' });

    expect(mockGetObjectThumbnail).toHaveBeenCalledExactlyOnceWith({
      thumbnailFieldName: 'media.src',
      keyPath: '',
      typedKeyPath: '',
      valueMap: { 'media.src': '/a.svg', title: 'A' },
      componentName: 'x-icon',
      collectionName: 'posts',
      fileName: 'about',
      isIndexFile: true,
      entry,
      files,
    });
  });
});
