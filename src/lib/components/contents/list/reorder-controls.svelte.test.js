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
    // Take long enough for the browser to drop the focus of the button disabled meanwhile
    vi.mocked(reorderEntries).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Boom')), 200);
        }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reorderDirty.current = true;

    await render(ReorderControls, {});
    await page.getByRole('button', { name: 'Done Reordering Entries' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Failed to save new entry order. Please try again.');
    expect(reordering.current).toBe(true);
    // The button lost the focus while it was disabled during the save, and gets it back
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toHaveFocus();
    await waitForToastsToHide();
  });

  test('stays in the reorder mode quietly when the commit is cancelled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Take long enough for the browser to drop the focus of the button disabled meanwhile
    vi.mocked(reorderEntries).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('commit_cancelled')), 200);
        }),
    );
    reorderDirty.current = true;

    await render(ReorderControls, {});
    await page.getByRole('button', { name: 'Done Reordering Entries' }).click();

    // The button lost the focus while it was disabled during the save, and gets it back
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toHaveFocus();
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toBeEnabled();
    expect(reordering.current).toBe(true);
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
  });

  test('takes the focus on the Done button once something has moved', async () => {
    const { component } = await render(ReorderControls, {});

    // The Done button is disabled until then
    component.focus();
    await expect
      .element(page.getByRole('button', { name: 'Cancel Reordering Entries' }))
      .toHaveFocus();

    reorderDirty.current = true;
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toBeEnabled();
    component.focus();
    await expect
      .element(page.getByRole('button', { name: 'Done Reordering Entries' }))
      .toHaveFocus();
  });

  test('tells the parent once the reorder mode has been left', async () => {
    vi.mocked(reorderEntries).mockResolvedValue(1);

    const onExit = vi.fn();

    reorderDirty.current = true;
    await render(ReorderControls, { onExit });
    await page.getByRole('button', { name: 'Done Reordering Entries' }).click();
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledOnce());

    setReorderMode(true);
    await page.getByRole('button', { name: 'Cancel Reordering Entries' }).click();
    expect(onExit).toHaveBeenCalledTimes(2);
  });
});
