import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { publishingBranches } from '$lib/services/workflow';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { publishWorkflowEntry } from '$lib/services/workflow/save';
import { canPublish } from '$lib/services/workflow/validate';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';
import { waitForToastsToHide } from '$lib/test/toast';

import PublishEntryButton from './publish-entry-button.svelte';

vi.mock('$lib/services/workflow/save', () => ({
  upsertUnpublishedEntry: vi.fn(),
  removeUnpublishedEntry: vi.fn(),
  saveWorkflowChanges: vi.fn(),
  updateWorkflowStatus: vi.fn(),
  publishWorkflowEntry: vi.fn(),
  discardWorkflowEntry: vi.fn(),
  deleteWorkflowEntry: vi.fn(),
  discardWorkflowEntries: vi.fn(),
  deleteWorkflowEntries: vi.fn(),
}));
vi.mock('$lib/services/workflow/validate', () => ({ canPublish: vi.fn(() => true) }));

/**
 * Build an unpublished entry.
 * @param {string} status Workflow status.
 * @param {string} [slug] Entry slug.
 * @returns {any} Entry.
 */
const createEntry = (status, slug = 'hello') => ({
  id: `posts/${slug}`,
  slug,
  subPath: slug,
  locales: {},
  workflow: {
    status,
    collectionName: 'posts',
    pullRequest: { number: 1, branch: `cms/posts/${slug}` },
  },
});

/**
 * Build a draft editing the given unpublished entry.
 * @param {any} entry Entry.
 * @returns {any} Draft.
 */
const createEntryDraft = (entry) =>
  createMockDraft({ draft: { isNew: false, originalEntry: entry } });

describe('PublishEntryButton', () => {
  beforeAll(async () => {
    await initTestConfig();
  });

  beforeEach(() => {
    forkedRepository.current = undefined;
    publishingBranches.current = [];
    vi.mocked(canPublish).mockReturnValue(true);
    window.location.hash = '#/collections/posts/entries/hello';
  });

  test('is hidden until the entry is ready to publish', async () => {
    const { container } = await renderWithDraft(PublishEntryButton, {
      draft: createMockDraft(),
      props: { entry: createEntry('pending_review') },
    });

    expect(container.querySelector('button')).toBeNull();
  });

  test('publishes the entry after confirmation, then leaves the editor', async () => {
    vi.mocked(publishWorkflowEntry).mockResolvedValue(undefined);

    const entry = createEntry('pending_publish');

    const { entryDraft } = await renderWithDraft(PublishEntryButton, {
      draft: createEntryDraft(entry),
      props: { entry },
    });

    await page.getByRole('button', { name: 'Publish Entry' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Publish Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Publish Entry Are you sure you want to publish this entry? Your changes will take effect right away. Publish Cancel',
      );
    await dialog.getByRole('button', { name: 'Publish' }).click();

    await vi.waitFor(() => expect(publishWorkflowEntry).toHaveBeenCalledWith(entry));
    await expect.poll(() => entryDraft.current).toBe(null);
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
  });

  test('leaves another entry’s draft alone when the merge lands late', async () => {
    const { promise: merging, resolve: merge } = /** @type {PromiseWithResolvers<void>} */ (
      Promise.withResolvers()
    );

    vi.mocked(publishWorkflowEntry).mockReturnValue(merging);

    const entry = createEntry('pending_publish');
    const otherEntry = createEntry('draft', 'world');

    const { entryDraft } = await renderWithDraft(PublishEntryButton, {
      draft: createEntryDraft(entry),
      props: { entry },
    });

    await page.getByRole('button', { name: 'Publish Entry' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
    await vi.waitFor(() => expect(publishWorkflowEntry).toHaveBeenCalledWith(entry));

    // The merge waits for a pipeline, and the author opens another entry meanwhile
    const otherDraft = createEntryDraft(otherEntry);

    entryDraft.current = otherDraft;
    window.location.hash = '#/collections/posts/entries/world';
    merge();
    // Let the merge settle. A change would happen right after, so the checks would otherwise pass
    // too early
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(entryDraft.current).toBe(otherDraft);
    expect(window.location.hash).toBe('#/collections/posts/entries/world');
  });

  test('is disabled while a merge started elsewhere is in flight', async () => {
    const entry = createEntry('pending_publish');

    // A merge can take minutes and outlive the editor, which the service keeps track of
    publishingBranches.current = ['cms/posts/hello'];

    await renderWithDraft(PublishEntryButton, {
      draft: createEntryDraft(entry),
      props: { entry },
    });

    const button = page.getByRole('button', { name: 'Publish Entry' });

    await expect.element(button).toHaveTextContent('Publishing…');
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');

    publishingBranches.current = [];

    await expect.element(button).toHaveTextContent('Publish');
    await expect.element(button).toHaveAttribute('aria-disabled', 'false');
  });

  test('reports a failure to publish', async () => {
    vi.mocked(publishWorkflowEntry).mockRejectedValue(new Error('Boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { entryDraft } = await renderWithDraft(PublishEntryButton, {
      draft: createMockDraft(),
      props: { entry: createEntry('pending_publish') },
    });

    await page.getByRole('button', { name: 'Publish Entry' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Couldn’t publish the entry. Please try again.');
    expect(entryDraft.current).not.toBeNull();
    await waitForToastsToHide();
  });

  test('is presented as Delete for a pending deletion', async () => {
    await renderWithDraft(PublishEntryButton, {
      draft: createMockDraft(),
      props: { entry: createEntry('pending_deletion'), modified: true },
    });

    const button = page.getByRole('button', { name: 'Delete Entry' });

    await expect.element(button).toHaveTextContent('Delete');
    // Unsaved changes don’t matter for a deletion
    await expect.element(button).toHaveAttribute('aria-disabled', 'false');

    await button.click();
    await expect
      .element(page.getByRole('alertdialog', { name: 'Delete Entry' }))
      .toHaveTextContent(
        'Delete Entry Are you sure you want to delete this entry? It will be removed right away. Delete Cancel',
      );
  });

  test('is disabled while the entry has unsaved changes', async () => {
    await renderWithDraft(PublishEntryButton, {
      draft: createMockDraft(),
      props: { entry: createEntry('pending_publish'), modified: true },
    });

    await expect
      .element(page.getByRole('button', { name: 'Publish Entry' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('blocks publishing an invalid entry', async () => {
    vi.mocked(canPublish).mockReturnValue(false);

    await renderWithDraft(PublishEntryButton, {
      draft: createMockDraft(),
      props: { entry: createEntry('pending_publish') },
    });

    await page.getByRole('button', { name: 'Publish Entry' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();

    expect(publishWorkflowEntry).not.toHaveBeenCalled();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error The entry has errors. Please correct them before publishing it.',
      );
    await waitForToastsToHide();
  });

  test('is hidden for an Open Authoring contributor', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    const { container } = await renderWithDraft(PublishEntryButton, {
      draft: createMockDraft(),
      props: { entry: createEntry('pending_publish') },
    });

    expect(container.querySelector('button')).toBeNull();
  });
});
