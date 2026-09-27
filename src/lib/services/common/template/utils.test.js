import { describe, expect, test } from 'vitest';

import { stripFieldTagPrefix } from '$lib/services/common/template/utils';

describe('Test stripFieldTagPrefix()', () => {
  test('removes the `fields.` prefix', () => {
    expect(stripFieldTagPrefix('fields.title')).toBe('title');
    expect(stripFieldTagPrefix('fields.author.name')).toBe('author.name');
  });

  test('returns a tag without the prefix as is', () => {
    expect(stripFieldTagPrefix('title')).toBe('title');
    expect(stripFieldTagPrefix('slug')).toBe('slug');
  });

  test('only removes the prefix at the start', () => {
    expect(stripFieldTagPrefix('author.fields.name')).toBe('author.fields.name');
    expect(stripFieldTagPrefix('fields.fields.name')).toBe('fields.name');
  });
});
