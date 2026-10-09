import { describe, expect, test } from 'vitest';

import { decodeURIComponentSafely, decodeURISafely } from './url';

describe('Test decodeURISafely()', () => {
  test('decodes a valid URI like decodeURI()', () => {
    expect(decodeURISafely('/images/my%20photo.png')).toBe('/images/my photo.png');
    // Reserved characters are kept encoded
    expect(decodeURISafely('/images/a%3Fb%23c.png')).toBe('/images/a%3Fb%23c.png');
  });

  test('leaves a malformed escape sequence as is, decoding the valid ones only', () => {
    expect(decodeURISafely('/images/50%off.jpg')).toBe('/images/50%off.jpg');
    expect(decodeURISafely('/images/50%off%20sale%E9%3F.jpg')).toBe(
      '/images/50%off sale%E9%3F.jpg',
    );
  });
});

describe('Test decodeURIComponentSafely()', () => {
  test('decodes a valid URI component like decodeURIComponent()', () => {
    expect(decodeURIComponentSafely('a%3Fb%23c%20d.png')).toBe('a?b#c d.png');
  });

  test('leaves a malformed escape sequence as is, decoding the valid ones only', () => {
    expect(decodeURIComponentSafely('50%off.jpg')).toBe('50%off.jpg');
    expect(decodeURIComponentSafely('50%off%20sale%E9%3F.jpg')).toBe('50%off sale%E9%3F.jpg');
  });
});
