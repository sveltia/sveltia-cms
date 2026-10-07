import { describe, expect, test } from 'vitest';

import { getValueFormat } from '.';

describe('Test getValueFormat()', () => {
  test('returns `html` for a RichText field with the `html` format', () => {
    expect(getValueFormat({ name: 'body', widget: 'richtext', format: 'html' })).toBe('html');
  });

  test('returns `markdown` for a RichText field with the `markdown` format', () => {
    expect(getValueFormat({ name: 'body', widget: 'richtext', format: 'markdown' })).toBe(
      'markdown',
    );
  });

  test('returns `markdown` for a RichText field without the format', () => {
    expect(getValueFormat({ name: 'body', widget: 'richtext' })).toBe('markdown');
  });

  test('returns `markdown` for a Markdown field, which does not support the option', () => {
    expect(
      // @ts-expect-error The Markdown field type doesn’t have the option
      getValueFormat({ name: 'body', widget: 'markdown', format: 'html' }),
    ).toBe('markdown');
  });
});
