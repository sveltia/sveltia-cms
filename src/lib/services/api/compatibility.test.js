import { describe, expect, test } from 'vitest';

import { COMPATIBILITY_URL, UNSUPPORTED_FUNC_NAMES } from '$lib/services/api/compatibility';

describe('COMPATIBILITY_URL', () => {
  test('points to the unsupported features section of the migration guide', () => {
    const url = new URL(COMPATIBILITY_URL);

    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('sveltiacms.app');
    expect(url.hash).toBe('#features-not-to-be-implemented');
  });
});

describe('UNSUPPORTED_FUNC_NAMES', () => {
  test('lists each function name only once', () => {
    expect(new Set(UNSUPPORTED_FUNC_NAMES).size).toBe(UNSUPPORTED_FUNC_NAMES.length);
  });

  test('includes the undocumented and unplanned functions', () => {
    expect(UNSUPPORTED_FUNC_NAMES).toEqual(
      expect.arrayContaining(['getBackend', 'moment', 'registerLocale', 'registerRemarkPlugin']),
    );
  });

  test('does not include `getWidget`, which is supported', () => {
    expect(UNSUPPORTED_FUNC_NAMES).not.toContain('getWidget');
  });
});
