import { describe, expect, test } from 'vitest';

import { decodeURIComponentSafely, decodeURISafely, encodeURLSafely } from './url';

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

describe('Test encodeURLSafely()', () => {
  test('encodes what needs encoding, keeping the escape sequences already there', () => {
    expect(encodeURLSafely('https://example.com/café?q=a b')).toBe(
      'https://example.com/caf%C3%A9?q=a%20b',
    );
    expect(encodeURLSafely('https://example.com/caf%C3%A9')).toBe('https://example.com/caf%C3%A9');
    expect(encodeURLSafely('mailto:alice@example.com')).toBe('mailto:alice@example.com');
    expect(encodeURLSafely('mailto:jos%C3%A9@example.com')).toBe('mailto:jos%C3%A9@example.com');
  });

  test('decodes and encodes again a URL that can’t be parsed', () => {
    expect(encodeURLSafely('/images/caf%C3%A9 1.jpg')).toBe('/images/caf%C3%A9%201.jpg');
    expect(encodeURLSafely('/images/50%off.jpg')).toBe('/images/50%25off.jpg');
    expect(encodeURLSafely('/images/\uD800.jpg')).toBe('/images/%EF%BF%BD.jpg');
  });
});
