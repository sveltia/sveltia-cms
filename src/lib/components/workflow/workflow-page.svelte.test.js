import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { announcedPageStatus } from '$lib/services/app/navigation';
import { backendName } from '$lib/services/backends';
import { deployments, productionSHA } from '$lib/services/deployments';
import {
  publishingBranches,
  unpublishedEntries,
  unpublishedEntriesLoaded,
} from '$lib/services/workflow';
import { resetDeployingEntries, trackDeployingEntry } from '$lib/services/workflow/deploy';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import {
  discardWorkflowEntry,
  publishWorkflowEntry,
  updateWorkflowStatus,
} from '$lib/services/workflow/save';
import { validateWorkflowEntry } from '$lib/services/workflow/validate';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import WorkflowPage from './workflow-page.svelte';

vi.mock('$lib/services/deployments/poll', () => ({
  retainDeployPolling: vi.fn(() => () => {}),
  recheckDeployments: vi.fn(),
}));
vi.mock('$lib/services/deployments/resolve', () => ({
  canResolveDeployments: vi.fn(() => true),
}));
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
vi.mock('$lib/services/workflow/validate', () => ({ validateWorkflowEntry: vi.fn(() => true) }));

/**
 * Build an unpublished entry.
 * @param {string} slug Slug.
 * @param {string} status Workflow status.
 * @returns {any} Entry.
 */
const createEntry = (slug, status) => ({
  ...createMockEntry({ slug, content: { _default: { title: slug } } }),
  workflow: {
    status,
    collectionName: 'posts',
    pullRequest: { number: 1, branch: `cms/posts/${slug}`, updatedDate: new Date() },
  },
});

/**
 * Simulate dragging a card to a column.
 * @param {HTMLElement} card Card.
 * @param {HTMLElement} column Column list.
 * @returns {void}
 */
const dragTo = (card, column) => {
  const dataTransfer = /** @type {any} */ ({
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn(),
  });

  card.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer }));
  column.dispatchEvent(
    Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), { dataTransfer }),
  );
  column.dispatchEvent(
    Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer }),
  );
  card.dispatchEvent(new Event('dragend', { bubbles: true }));
};

describe('WorkflowPage', () => {
  beforeEach(async () => {
    await initTestConfig({
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
    });
    setEntries([]);
    backendName.current = undefined;
    forkedRepository.current = undefined;
    unpublishedEntriesLoaded.current = true;
    publishingBranches.current = [];
    resetDeployingEntries();
    deployments.current = {};
    productionSHA.current = '';
    unpublishedEntries.current = [
      createEntry('draft-1', 'draft'),
      createEntry('draft-2', 'draft'),
      createEntry('review-1', 'pending_review'),
      createEntry('ready-1', 'pending_publish'),
      createEntry('gone-1', 'pending_deletion'),
    ];
    vi.mocked(validateWorkflowEntry).mockReturnValue(true);
    vi.mocked(updateWorkflowStatus).mockResolvedValue(/** @type {any} */ ({}));
    vi.mocked(publishWorkflowEntry).mockResolvedValue(undefined);
    vi.mocked(discardWorkflowEntry).mockResolvedValue(undefined);
  });

  test('lays the entries out by stage, with the pending deletions below', async () => {
    await render(WorkflowPage);

    const board = page.getByRole('group', { name: 'Editorial Workflow' });

    /**
     * Get the titles of the cards in the given column.
     * @param {string} name Column label.
     * @returns {(string | null | undefined)[]} Titles.
     */
    const getCards = (name) =>
      board
        .getByRole('list', { name })
        .getByRole('listitem')
        .elements()
        .map((el) => el.querySelector('.title')?.textContent);

    await expect.poll(() => getCards('Drafts')).toEqual(['draft-1', 'draft-2']);
    expect(getCards('In Review')).toEqual(['review-1']);
    expect(getCards('Ready')).toEqual(['ready-1']);
    expect(getCards('Pending Deletion')).toEqual(['gone-1']);
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing the Editorial Workflow board. Drafts: 2. In Review: 1. Ready: 1. Pending Deletion: 1.',
    );
  });

  test('moves an entry to another stage by dragging', async () => {
    const { container } = await render(WorkflowPage);

    await expect.poll(() => container.querySelectorAll('.card').length).toBe(5);

    const card = /** @type {HTMLElement} */ (container.querySelector('.card'));

    const column = /** @type {HTMLElement} */ (
      page.getByRole('list', { name: 'In Review' }).element()
    );

    dragTo(card, column);

    await vi.waitFor(() =>
      expect(updateWorkflowStatus).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'draft-1' }),
        'pending_review',
      ),
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Status updated.');
    // The toast goes away on its own
    await expect
      .poll(() => document.querySelector('.sui.toast')?.getAttribute('aria-hidden'), {
        timeout: 7000,
      })
      .toBe('true');
  });

  test('ignores a drop in the same stage, or from elsewhere', async () => {
    const { container } = await render(WorkflowPage);

    await expect.poll(() => container.querySelectorAll('.card').length).toBe(5);

    const card = /** @type {HTMLElement} */ (container.querySelector('.card'));

    const drafts = /** @type {HTMLElement} */ (
      page.getByRole('list', { name: 'Drafts' }).element()
    );

    const review = /** @type {HTMLElement} */ (
      page.getByRole('list', { name: 'In Review' }).element()
    );

    // Nothing is being dragged, so the column doesn’t take a drop
    const event = new Event('dragover', { bubbles: true, cancelable: true });

    review.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    // Leaving a column while dragging over it
    card.dispatchEvent(new Event('dragstart', { bubbles: true }));
    review.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    await expect.poll(() => review.classList.contains('drop-target')).toBe(true);
    // Leaving another column changes nothing
    drafts.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(review.classList.contains('drop-target')).toBe(true);
    review.dispatchEvent(new Event('dragleave', { bubbles: true }));
    await expect.poll(() => review.classList.contains('drop-target')).toBe(false);

    // Dropping the entry back where it was
    dragTo(card, drafts);
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(updateWorkflowStatus).not.toHaveBeenCalled();
  });

  test('refuses to move an invalid entry forward', async () => {
    vi.mocked(validateWorkflowEntry).mockReturnValue(false);

    const { container } = await render(WorkflowPage);

    await expect.poll(() => container.querySelectorAll('.card').length).toBe(5);
    dragTo(
      /** @type {HTMLElement} */ (container.querySelector('.card')),
      /** @type {HTMLElement} */ (page.getByRole('list', { name: 'Ready' }).element()),
    );

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error The entry has errors. Please correct them before changing the status.',
      );
    expect(updateWorkflowStatus).not.toHaveBeenCalled();
  });

  test('publishes an entry after confirmation', async () => {
    await render(WorkflowPage);

    await page
      .getByRole('list', { name: 'Ready' })
      .getByRole('button', { name: 'Publish Entry' })
      .click();

    const dialog = page.getByRole('alertdialog', { name: 'Publish Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Publish Entry Are you sure you want to publish this entry? Your changes will take effect right away. Publish Cancel',
      );

    // An invalid entry can’t be published
    vi.mocked(validateWorkflowEntry).mockReturnValueOnce(false);
    await dialog.getByRole('button', { name: 'Publish' }).click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error The entry has errors. Please correct them before publishing it.',
      );
    expect(publishWorkflowEntry).not.toHaveBeenCalled();

    await page
      .getByRole('list', { name: 'Ready' })
      .getByRole('button', { name: 'Publish Entry' })
      .click();
    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish' }).click();

    await vi.waitFor(() =>
      expect(publishWorkflowEntry).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'ready-1' }),
      ),
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Entry published.');
  });

  test('lists the merged entries until the site has caught up', async () => {
    productionSHA.current = 'prod';
    trackDeployingEntry(createEntry('live-1', 'pending_publish'));
    trackDeployingEntry(createEntry('gone-2', 'pending_deletion'));

    const { container } = await render(WorkflowPage);
    const tray = page.getByRole('list', { name: 'Deploying' });

    await expect.poll(() => tray.getByRole('listitem').elements().length).toBe(2);

    const [published, deleted] = tray.getByRole('listitem').elements();

    expect(published.querySelector('.title')).toHaveTextContent('live-1');
    expect(published.querySelector('.note')).toBeNull();
    expect(deleted.querySelector('.title')).toHaveTextContent('gone-2');
    expect(deleted.querySelector('.note')).toHaveTextContent('Deletion');
    // Nothing to do with them
    expect(tray.getByRole('button', { name: 'Publish Entry' }).elements()).toHaveLength(0);
    expect(tray.getByRole('button', { name: 'Delete Entry' }).elements()).toHaveLength(0);

    deployments.current = { prod: { state: 'pending', checkedTime: 0 } };
    await expect.poll(() => container.querySelectorAll('.deploy-status-badge').length).toBe(2);

    // The tray goes with the last of them
    deployments.current = { prod: { state: 'ready', checkedTime: 0 } };
    await expect.poll(() => tray.elements().length).toBe(0);
  });

  test('keeps a card busy while a merge started elsewhere is in flight', async () => {
    // A merge can take minutes and outlive the page it was started from
    publishingBranches.current = ['cms/posts/ready-1'];

    await render(WorkflowPage);

    const ready = page.getByRole('list', { name: 'Ready' });

    await expect
      .element(ready.getByRole('button', { name: 'Publish Entry' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(ready.getByRole('button', { name: 'Delete Entry' }))
      .toHaveAttribute('aria-disabled', 'true');

    publishingBranches.current = [];

    await expect
      .element(ready.getByRole('button', { name: 'Publish Entry' }))
      .toHaveAttribute('aria-disabled', 'false');
  });

  test('deletes a draft after confirmation, reporting a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(discardWorkflowEntry).mockRejectedValue(new Error('Boom'));

    await render(WorkflowPage);

    await page
      .getByRole('list', { name: 'Drafts' })
      .getByRole('button', { name: 'Delete Entry' })
      .nth(0)
      .click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Delete Entry This entry hasn’t been published yet, so deleting it will discard it completely. Delete Cancel',
      );
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() =>
      expect(discardWorkflowEntry).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'draft-1' }),
      ),
    );
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Couldn’t delete the entry. Please try again.');
  });

  test('discards the changes to a published entry after confirmation', async () => {
    setEntries([createMockEntry({ slug: 'draft-1' })]);

    await render(WorkflowPage);

    await page
      .getByRole('list', { name: 'Drafts' })
      .getByRole('button', { name: 'Discard Changes' })
      .nth(0)
      .click();

    const dialog = page.getByRole('alertdialog', { name: 'Discard Changes' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Discard Changes This entry has unpublished changes. Discarding them will restore the published version. The entry itself won’t be deleted. Discard Cancel',
      );
    await dialog.getByRole('button', { name: 'Discard' }).click();

    await vi.waitFor(() =>
      expect(discardWorkflowEntry).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'draft-1' }),
      ),
    );
  });

  test('cancels or carries out a pending deletion', async () => {
    await render(WorkflowPage);

    const list = page.getByRole('list', { name: 'Pending Deletion' });

    await list.getByRole('button', { name: 'Cancel Deletion' }).click();
    await page
      .getByRole('alertdialog', { name: 'Cancel Deletion' })
      .getByRole('button', { name: 'Cancel Deletion' })
      .click();
    await vi.waitFor(() =>
      expect(discardWorkflowEntry).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'gone-1' }),
      ),
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Deletion cancelled.');

    await list.getByRole('button', { name: 'Delete Entry' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect
      .element(dialog)
      .toHaveTextContent(
        'Delete Entry Are you sure you want to delete this entry? It will be removed right away. Delete Cancel',
      );
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await vi.waitFor(() =>
      expect(publishWorkflowEntry).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'gone-1' }),
      ),
    );
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('check_circle Success Entry deleted.');
  });

  test('leaves out the Ready stage while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await render(WorkflowPage);

    await expect.element(page.getByRole('list', { name: 'In Review' })).toBeInTheDocument();
    expect(page.getByRole('list', { name: 'Ready' }).elements()).toHaveLength(0);
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing the Editorial Workflow board. Drafts: 2. In Review: 1. Pending Deletion: 1.',
    );
  });

  test('shows a loading state until the pull requests are fetched', async () => {
    // The data is only awaited when the workflow is enabled, which takes a Git backend
    await initTestConfig({
      backend: { name: 'github', repo: 'me/site' },
      publish_mode: 'editorial_workflow',
    });
    backendName.current = 'github';
    unpublishedEntriesLoaded.current = false;
    unpublishedEntries.current = [];

    await render(WorkflowPage);

    await expect.element(page.getByText('Loading entries…')).toBeInTheDocument();

    unpublishedEntriesLoaded.current = true;
    await expect
      .element(page.getByRole('list', { name: 'Drafts' }))
      .toHaveTextContent('No entries.');
  });
});
