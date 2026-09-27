import { describe, expect, test } from 'vitest';

import { encodePath } from '$lib/services/backends/git/shared/url';

describe('encodePath', () => {
  test('keeps the slashes between segments', () => {
    expect(encodePath('cms/posts/hello')).toBe('cms/posts/hello');
  });

  test('encodes characters that would end the path or change its meaning', () => {
    expect(encodePath('cms/posts/c#-tips')).toBe('cms/posts/c%23-tips');
    expect(encodePath('images/photo #1?.jpg')).toBe('images/photo%20%231%3F.jpg');
    expect(encodePath('cms/pages/about%2Fus')).toBe('cms/pages/about%252Fus');
    expect(encodePath('a&b')).toBe('a%26b');
  });

  test('handles an empty string', () => {
    expect(encodePath('')).toBe('');
  });
});
