import { afterEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import { getValueFormat } from '.';

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

describe('Test getValueFormat()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

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

  test('falls back to the `field_defaults` option for a RichText field', () => {
    cmsConfig.current = /** @type {any} */ ({ field_defaults: { richtext: { format: 'html' } } });

    expect(getValueFormat({ name: 'body', widget: 'richtext' })).toBe('html');
    // The field option takes precedence
    expect(getValueFormat({ name: 'body', widget: 'richtext', format: 'markdown' })).toBe(
      'markdown',
    );
    // The Markdown field type ignores the default
    expect(getValueFormat({ name: 'body', widget: 'markdown' })).toBe('markdown');
  });
});
