import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { backendName } from '$lib/services/backends';
import { getCollection } from '$lib/services/contents/collection';
import { reloadDraft } from '$lib/services/contents/draft/reload';
import { formatDate } from '$lib/services/utils/date';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import RemoteChangeInfobar from './remote-change-infobar.svelte';

vi.mock('$lib/services/contents/draft/reload', () => ({ reloadDraft: vi.fn() }));

const fields = [{ name: 'title', widget: 'string' }];
const postsCollection = { name: 'posts', label: 'Posts', folder: 'content/posts', fields };
const helloEntry = createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } });
const commitDate = new Date('2026-03-04T05:06:00Z');

const changedEntry = createMockEntry({
  slug: 'hello',
  content: { _default: { title: 'Hello, revised' } },
  entry: { commitAuthor: { name: 'Alex', email: 'alex@example.com' }, commitDate },
});

/**
 * Render the infobar for a draft of the “hello” entry.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 * @returns {Promise<{ draft: any, entryDraft: any }>} Draft and its state.
 */
const renderInfobar = async (draftProps = {}) => {
  const draft = createMockDraft({
    fields,
    values: { _default: { title: 'Hello' } },
    draft: {
      isNew: false,
      originalEntry: helloEntry,
      collection: getCollection('posts'),
      ...draftProps,
    },
  });

  const { entryDraft } = await renderWithDraft(RemoteChangeInfobar, { draft });

  return { draft, entryDraft };
};

describe('RemoteChangeInfobar', () => {
  beforeEach(async () => {
    await initTestConfig({ collections: [postsCollection] });
    backendName.current = undefined;
    unpublishedEntries.current = [];
    setEntries([helloEntry]);
  });

  test('shows nothing while the entry is as it was', async () => {
    await renderInfobar();

    expect(page.getByRole('alert').query()).toBeNull();
  });

  test('says who changed the entry, and reloads it', async () => {
    const { entryDraft } = await renderInfobar();

    // Someone else’s commit lands
    setEntries([changedEntry]);

    const alert = page.getByRole('alert');

    await expect
      .element(alert)
      .toHaveTextContent(
        `warning Warning \u2068Alex\u2069 changed this entry on \u2068${formatDate(commitDate, 'en-US')}\u2069, ` +
          'after you opened it. If you save now, their changes will be lost. Reload Entry',
      );

    // Nothing has been edited, so no need to ask
    await alert.getByRole('button', { name: 'Reload Entry' }).click();
    await vi.waitFor(() =>
      expect(reloadDraft).toHaveBeenCalledWith({ entryDraft, entry: changedEntry }),
    );
  });

  test('asks before reloading over unsaved changes', async () => {
    const { draft, entryDraft } = await renderInfobar();

    setEntries([changedEntry]);
    draft.currentValues._default.title = 'Hi';

    const reload = page.getByRole('alert').getByRole('button', { name: 'Reload Entry' });

    await reload.click();

    const dialog = page.getByRole('alertdialog', { name: 'Reload Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Reload Entry Are you sure you want to reload the entry? Your unsaved changes will be ' +
          'lost. Reload Entry Cancel',
      );

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    expect(reloadDraft).not.toHaveBeenCalled();

    await reload.click();
    await dialog.getByRole('button', { name: 'Reload Entry' }).click();
    await vi.waitFor(() =>
      expect(reloadDraft).toHaveBeenCalledWith({ entryDraft, entry: changedEntry }),
    );
  });

  test('says when the entry was deleted, with nothing to reload', async () => {
    await renderInfobar();

    setEntries([]);

    const alert = page.getByRole('alert');

    await expect
      .element(alert)
      .toHaveTextContent(
        'warning Warning This entry has been deleted from the repository after you opened it. ' +
          'If you save now, the entry will be created again.',
      );
    expect(alert.getByRole('button', { name: 'Reload Entry' }).query()).toBeNull();
  });

  test('can be dismissed, and comes back when the entry is changed again', async () => {
    await renderInfobar();

    setEntries([changedEntry]);

    const alert = page.getByRole('alert');

    await expect.element(alert).toBeInTheDocument();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect.element(alert).not.toBeInTheDocument();

    // Another commit
    setEntries([
      createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello, revised twice' } } }),
    ]);
    await expect
      .element(alert)
      .toMatchTextContent(
        'This entry has been changed in the repository after you opened it. ' +
          'If you save now, their changes will be lost.',
      );
  });

  test('shows nothing for a new entry', async () => {
    await renderInfobar({ isNew: true, originalEntry: undefined });

    setEntries([]);
    // Give any update a chance to render
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(page.getByRole('alert').query()).toBeNull();
  });

  test('shows nothing for an Editorial Workflow draft', async () => {
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site' },
      publish_mode: 'editorial_workflow',
      collections: [postsCollection],
    });
    backendName.current = 'github';

    await renderInfobar();

    setEntries([changedEntry]);
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(page.getByRole('alert').query()).toBeNull();
  });
});
