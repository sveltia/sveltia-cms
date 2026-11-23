import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { assignAutoIncrementValues } from '$lib/services/contents/fields/number/auto-increment';

import { assignSaveTimeValues } from './save-time';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

vi.mock('$lib/services/contents/draft/save/sort-order', () => ({
  assignManualSortOrder: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/date-time/auto-now', () => ({
  assignAutoNowValues: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/number/auto-increment', () => ({
  assignAutoIncrementValues: vi.fn(),
}));

describe('assignSaveTimeValues', () => {
  /** @type {EntryDraft} */
  let draft;

  beforeEach(() => {
    draft = /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({ isNew: true, collection: { name: 'posts', _type: 'entry' } })
    );
  });

  it('should assign the sort order, numbers and dates of a new entry', () => {
    /** @type {string[]} */
    const order = [];

    vi.mocked(assignManualSortOrder).mockImplementation(() => {
      order.push('sortOrder');
    });
    vi.mocked(assignAutoIncrementValues).mockImplementation(() => {
      order.push('autoIncrement');
    });
    vi.mocked(assignAutoNowValues).mockImplementation(() => {
      order.push('autoNow');
    });

    assignSaveTimeValues(draft, 2);

    expect(assignManualSortOrder).toHaveBeenCalledWith(draft, 2);
    expect(assignAutoIncrementValues).toHaveBeenCalledWith(draft, 2);
    expect(assignAutoNowValues).toHaveBeenCalledWith(draft);
    expect(order).toEqual(['sortOrder', 'autoIncrement', 'autoNow']);
  });

  it('should keep the sort order of an existing entry', () => {
    draft.isNew = false;

    assignSaveTimeValues(draft, 0);

    expect(assignManualSortOrder).not.toHaveBeenCalled();
    expect(assignAutoIncrementValues).toHaveBeenCalledWith(draft, 0);
    expect(assignAutoNowValues).toHaveBeenCalledWith(draft);
  });

  it('should not assign a sort order in a file collection', () => {
    draft.collection = /** @type {any} */ ({ name: 'pages', _type: 'file' });

    assignSaveTimeValues(draft, 0);

    expect(assignManualSortOrder).not.toHaveBeenCalled();
    expect(assignAutoIncrementValues).toHaveBeenCalledWith(draft, 0);
  });
});
