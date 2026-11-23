import { vi } from 'vitest';

import { getDraftFieldArgs } from '$lib/services/contents/entry/fields';

/**
 * In a test file that automocks `$lib/services/contents/entry/fields`, build the `getField()`
 * arguments for real, so the calls can be checked with what the code under test passes.
 * @returns {Promise<void>}
 */
export const useActualDraftFieldArgs = async () => {
  /** @type {typeof import('$lib/services/contents/entry/fields')} */
  const actual = await vi.importActual('$lib/services/contents/entry/fields');

  vi.mocked(getDraftFieldArgs).mockImplementation(actual.getDraftFieldArgs);
};
