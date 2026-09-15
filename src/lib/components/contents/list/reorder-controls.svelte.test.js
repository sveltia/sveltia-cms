import { flushSync } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { reorderEntries } from '$lib/services/contents/collection/entries/reorder';
import {
  reorderDirty,
  reorderedEntries,
  reordering,
  setReorderMode,
} from '$lib/services/contents/collection/view';
import { initTestConfig } from '$lib/test/config';
import { waitForToastsToHide } from '$lib/test/toast';

import ReorderControls from './reorder-controls.svelte';

vi.mock('$lib/services/contents/collection/entries/reorder', () => ({
  sortEntriesByOrderField: vi.fn((entries) => entries),
  reorderEntries: vi.fn(),
  buildRenumberChanges: vi.fn(),
  renumberCollectionEntries: vi.fn(),
}));

describe('ReorderControls', () => {
  beforeEach(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          folder: 'content/posts',
          reorder: true,
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
    selectedCollection.current = getCollection('posts');
    // Let the view be restored for the collection before reorder mode adjusts it
    flushSync();
    setReorderMode(true);
    reorderedEntries.current = [];
    reorderDirty.current = false;
  });

  test('saves the new order once something has moved', async () => {
    vi.mocked(reorderEntries).mockResolvedValue(1);

    await render(ReorderControls, {});

    const done = page.getByRole('button', { name: 'Done Reordering Entries' });

    await expect.element(done).toHaveAttribute('aria-disabled', 'true');

    reorderDirty.current = true;
    await expect.element(done).toHaveAttribute('aria-disabled', 'false');
    await done.click();

    await vi.waitFor(() => expect(reorderEntries).toHaveBeenCalledWith(getCollection('posts'), []));
    await expect.poll(() => reordering.current).toBe(false);
  });

  test('leaves the reorder mode without saving when cancelled', async () => {
    await render(ReorderControls, {});
    await page.getByRole('button', { name: 'Cancel Reordering Entries' }).click();

    expect(reorderEntries).not.toHaveBeenCalled();
    expect(reordering.current).toBe(false);
  });

  test('reports a failure', async () => {
    vi.mocked(reorderEntries).mockRejectedValue(new Error('Boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reorderDirty.current = true;

    await render(ReorderControls, {});
    await page.getByRole('button', { name: 'Done Reordering Entries' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Failed to save new entry order. Please try again.');
    expect(reordering.current).toBe(true);
    await waitForToastsToHide();
  });
});
