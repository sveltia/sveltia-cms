import { describe, expect, test } from 'vitest';

import { decodeMagicLinkData, encodeMagicLinkData } from './magic-link';

describe('encodeMagicLinkData', () => {
  test('encodes text outside Latin-1, which `btoa()` throws on', () => {
    const data = {
      token: 'abc',
      prefs: { deployHookURL: 'https://例え.jp/フック?q=🚀', password: 'pässwörd€' },
    };

    const encoded = encodeMagicLinkData(data);

    expect(() => btoa(JSON.stringify(data))).toThrow();
    expect(decodeMagicLinkData(encoded)).toEqual(data);
  });

  test('uses the URL-safe alphabet without padding', () => {
    // The standard alphabet has `+` and `/`, and the router trims a trailing slash
    const encoded = encodeMagicLinkData('?>?');

    expect(btoa(JSON.stringify('?>?'))).toMatch(/[+/=]/);
    expect(encoded).toMatch(/^[\w-]+$/);
    expect(decodeMagicLinkData(encoded)).toBe('?>?');
  });
});

describe('decodeMagicLinkData', () => {
  test('decodes a link made with `btoa()` by an earlier version', () => {
    const data = { token: 'abc', prefs: { theme: 'dark', note: '?>?~' } };
    const encoded = btoa(JSON.stringify(data));

    expect(encoded).toMatch(/[+/=]/);
    expect(decodeMagicLinkData(encoded)).toEqual(data);
  });

  test('reads Latin-1 text of a link made with `btoa()` as `atob()` does', () => {
    const data = { token: 'abc', prefs: { password: 'café\u0080' } };

    expect(decodeMagicLinkData(btoa(JSON.stringify(data)))).toEqual(data);
  });

  test('throws on invalid data', () => {
    expect(() => decodeMagicLinkData('!!!')).toThrow();
    expect(() => decodeMagicLinkData(btoa('invalid json'))).toThrow();
  });
});
