// @ts-nocheck
import { describe, expect, test, vi } from 'vitest';

import { getPreviewPath } from '$lib/services/contents/entry';
import { getSitePath } from '$lib/services/contents/entry/site-path';

vi.mock('$lib/services/contents/entry', () => ({
  getPreviewPath: vi.fn(),
}));

describe('Test getSitePath()', () => {
  test('should add a leading slash', () => {
    vi.mocked(getPreviewPath).mockReturnValue('posts/foo/');

    expect(getSitePath({ slug: 'foo' })).toBe('/posts/foo/');
    expect(getPreviewPath).toHaveBeenCalledWith({ slug: 'foo' });
  });

  test('should not double a leading slash', () => {
    vi.mocked(getPreviewPath).mockReturnValue('/posts/foo');

    expect(getSitePath({})).toBe('/posts/foo');
  });

  test('should return `undefined` if the path is not available', () => {
    vi.mocked(getPreviewPath).mockReturnValue(undefined);

    expect(getSitePath({})).toBeUndefined();
  });
});
