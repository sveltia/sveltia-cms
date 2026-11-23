import { afterEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import {
  BLOCK_BUTTONS,
  DEFAULT_BUTTONS,
  getValueFormat,
  HTML_ONLY_BUTTONS,
  INLINE_BUTTONS,
  OPTIONAL_BUTTONS,
  stripComponentNamePrefix,
} from '.';

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

describe('Test stripComponentNamePrefix()', () => {
  test('removes the component name prefix', () => {
    expect(stripComponentNamePrefix('body:c12:src')).toBe('src');
    expect(stripComponentNamePrefix('body:c12:items.0.title')).toBe('items.0.title');
  });

  test('keeps a key path without the prefix as is', () => {
    expect(stripComponentNamePrefix('items.0.title')).toBe('items.0.title');
    expect(stripComponentNamePrefix('')).toBe('');
  });
});

describe('Test DEFAULT_BUTTONS', () => {
  test('includes the inline and block buttons but the optional ones', () => {
    expect(INLINE_BUTTONS).toContain('underline');
    expect(BLOCK_BUTTONS).toContain('align');
    expect(BLOCK_BUTTONS).toContain('task-list');
    expect(HTML_ONLY_BUTTONS).toEqual(['underline', 'align']);
    expect(OPTIONAL_BUTTONS).toEqual(['underline', 'align', 'task-list']);
    expect(DEFAULT_BUTTONS).toEqual([
      'bold',
      'italic',
      'strikethrough',
      'code',
      'link',
      'heading-one',
      'heading-two',
      'heading-three',
      'heading-four',
      'heading-five',
      'heading-six',
      'bulleted-list',
      'numbered-list',
      'quote',
    ]);
  });
});
