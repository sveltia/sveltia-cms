import { describe, expect, test } from 'vitest';

import { getPreviewType } from './preview.js';

/**
 * @import { StringField } from '$lib/types/public';
 */

/**
 * Build a String field configuration.
 * @param {StringField['type']} [type] Input type.
 * @returns {StringField} Field configuration.
 */
const createField = (type) => ({ name: 'link', widget: 'string', type });
// eslint-disable-next-line no-script-url
const UNSAFE_URL = 'javascript:alert(1)';

describe('getPreviewType()', () => {
  test('embeds a YouTube video', () => {
    expect(
      getPreviewType({ fieldConfig: createField(), value: 'https://www.youtube.com/watch?v=abc' }),
    ).toBe('youtube');
    expect(getPreviewType({ fieldConfig: createField('url'), value: 'https://youtu.be/abc' })).toBe(
      'youtube',
    );
  });

  test('links a URL with a safe protocol', () => {
    expect(getPreviewType({ fieldConfig: createField(), value: 'https://example.com/' })).toBe(
      'link',
    );
    expect(getPreviewType({ fieldConfig: createField(), value: 'mailto:hello@example.com' })).toBe(
      'link',
    );
    expect(getPreviewType({ fieldConfig: createField('url'), value: 'tel:+15555551234' })).toBe(
      'link',
    );
  });

  test('shows a URL with an unsafe protocol as text', () => {
    expect(getPreviewType({ fieldConfig: createField(), value: 'http://example.com/' })).toBe(
      'text',
    );
    expect(getPreviewType({ fieldConfig: createField('url'), value: UNSAFE_URL })).toBe('text');
    // A `url` field is not linked unless the value is a safe URL
    expect(getPreviewType({ fieldConfig: createField('url'), value: 'not a url' })).toBe('text');
  });

  test('links an email address', () => {
    expect(getPreviewType({ fieldConfig: createField('email'), value: 'hello@example.com' })).toBe(
      'email',
    );
  });

  test('shows anything else as text', () => {
    expect(getPreviewType({ fieldConfig: createField(), value: 'Hello, world!' })).toBe('text');
    expect(getPreviewType({ fieldConfig: createField('text'), value: 'hello@example.com' })).toBe(
      'text',
    );
  });
});
