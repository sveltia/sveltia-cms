import { describe, expect, test, vi } from 'vitest';

import { formatNames } from '$lib/services/additions/people';

vi.mock('@sveltia/i18n', async (importOriginal) => ({
  ...(await importOriginal()),
  locale: { current: 'en-US' },
}));

describe('formatNames', () => {
  test('joins names into a list in the app locale', () => {
    expect(formatNames([{ name: 'Ada' }, { name: 'Bob' }, { name: 'Carol' }])).toBe(
      'Ada, Bob, and Carol',
    );
  });
});
