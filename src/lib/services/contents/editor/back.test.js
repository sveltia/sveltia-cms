import { beforeEach, describe, expect, test, vi } from 'vitest';

import { goBack } from '$lib/services/app/navigation';
import { getCollection } from '$lib/services/contents/collection';
import { hasNestedEntries, nestedFilterPath } from '$lib/services/contents/collection/nested';
import { goBackFromEntryEditor } from '$lib/services/contents/editor/back';

vi.mock('$lib/services/app/navigation', () => ({ goBack: vi.fn() }));
vi.mock('$lib/services/contents/collection', () => ({ getCollection: vi.fn() }));
vi.mock('$lib/services/contents/collection/nested', () => ({
  hasNestedEntries: vi.fn(),
  nestedFilterPath: { current: '' },
}));

describe('goBackFromEntryEditor()', () => {
  beforeEach(() => {
    nestedFilterPath.current = 'guides/getting started';
    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ ({ name: 'docs' }));
  });

  test('goes back to the folder being browsed in a collection with nested entries', () => {
    vi.mocked(hasNestedEntries).mockReturnValue(true);
    goBackFromEntryEditor('docs');

    expect(getCollection).toHaveBeenCalledWith('docs');
    expect(goBack).toHaveBeenCalledWith('/collections/docs/filter/guides/getting%20started', {
      returnTo: expect.any(Function),
    });
  });

  test('goes back to the entry list of another collection, or from a singleton', () => {
    vi.mocked(hasNestedEntries).mockReturnValue(false);
    goBackFromEntryEditor('posts');
    expect(goBack).toHaveBeenLastCalledWith('/collections/posts', {
      returnTo: expect.any(Function),
    });

    goBackFromEntryEditor('_singletons');
    expect(goBack).toHaveBeenLastCalledWith('/collections', { returnTo: expect.any(Function) });
  });

  test('looks no collection up without a name', () => {
    goBackFromEntryEditor(undefined);

    expect(getCollection).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledWith('/collections/undefined', {
      returnTo: expect.any(Function),
    });
  });
});
