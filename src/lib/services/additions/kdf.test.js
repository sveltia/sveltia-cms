import { describe, expect, test } from 'vitest';

import { derivePrehash, KDF_VERSION } from '$lib/services/additions/kdf';

/**
 * Test vectors from Sveltia CMS Additions’ `docs/kdf-test-vectors.json`. The CMS must derive the
 * same prehashes as the service’s reference implementation, or nobody could sign in.
 */
const TEST_VECTORS = {
  version: 'v1',
  vectors: [
    {
      siteId: '3f1c2a9e-5b7d-4e2f-9a6c-0d8b7e1f2a3c',
      username: 'admin',
      password: 'correct horse battery staple',
      prehash: 'XPK1eHEohNDYSiQWhvCyS1WdPfJgssPfGGgJUFhNccQ',
    },
    {
      siteId: '3f1c2a9e-5b7d-4e2f-9a6c-0d8b7e1f2a3c',
      username: 'Admin',
      password: 'correct horse battery staple',
      prehash: 'XPK1eHEohNDYSiQWhvCyS1WdPfJgssPfGGgJUFhNccQ',
    },
    {
      siteId: '3f1c2a9e-5b7d-4e2f-9a6c-0d8b7e1f2a3c',
      username: 'editor',
      // cspell:disable-next-line
      password: 'pässwörd 日本語',
      prehash: 'Hf4EB_mRItBTL5YBwG1XKo0z5FIXtidrZ16dK6zhBEI',
    },
    {
      siteId: '00000000-0000-0000-0000-000000000000',
      username: 'admin',
      password: 'correct horse battery staple',
      prehash: 'UHvKFO0Ed8y_0oWdBNn3FHvvwcbsSltPToYzmnVnMC4',
    },
  ],
};

describe('derivePrehash', () => {
  test('implements the version of the test vectors', () => {
    expect(KDF_VERSION).toBe(TEST_VECTORS.version);
  });

  test.each(TEST_VECTORS.vectors)('matches the vector for $username on $siteId', async (vector) => {
    await expect(derivePrehash(vector)).resolves.toBe(vector.prehash);
  });

  test('treats composed and decomposed characters alike', async () => {
    const args = { siteId: 'site', username: 'user', iterations: 1000 };

    await expect(derivePrehash({ ...args, password: 'e\u0301' })).resolves.toBe(
      await derivePrehash({ ...args, password: '\u00e9' }),
    );
  });
});
