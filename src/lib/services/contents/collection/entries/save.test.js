import { beforeEach, describe, expect, test, vi } from 'vitest';

import { saveChanges } from '$lib/services/backends/save';
import { contentUpdatesToast } from '$lib/services/contents/collection/data';
import { saveEntryUpdates } from '$lib/services/contents/collection/entries/save';

vi.mock('$lib/services/backends/save', () => ({
  saveChanges: vi.fn().mockResolvedValue({}),
}));

vi.mock('$lib/services/contents/collection/data', () => ({
  contentUpdatesToast: { current: undefined },
  UPDATE_TOAST_DEFAULT_STATE: { count: 0, saved: false, deleted: false },
}));

describe('saveEntryUpdates()', () => {
  const collection = /** @type {any} */ ({ name: 'posts' });

  beforeEach(() => {
    contentUpdatesToast.current = /** @type {any} */ (undefined);
  });

  test('commits the changes and reports the number of entries saved', async () => {
    const changes = /** @type {any[]} */ ([{ action: 'update', path: 'a.md' }]);
    const savingEntries = /** @type {any[]} */ ([{ id: 'a' }, { id: 'b' }]);

    expect(await saveEntryUpdates({ collection, changes, savingEntries })).toBe(2);
    expect(saveChanges).toHaveBeenCalledWith({
      changes,
      savingEntries,
      options: { commitType: 'update', collection },
    });
    expect(contentUpdatesToast.current).toEqual({ count: 2, saved: true, deleted: false });
  });

  test('does nothing without changes', async () => {
    expect(await saveEntryUpdates({ collection, changes: [], savingEntries: [] })).toBe(0);
    expect(saveChanges).not.toHaveBeenCalled();
    expect(contentUpdatesToast.current).toBeUndefined();
  });
});
