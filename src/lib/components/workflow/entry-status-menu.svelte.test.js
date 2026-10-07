import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { env } from '$lib/services/user/env.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { updateWorkflowStatus } from '$lib/services/workflow/save';
import { canMoveToStatus } from '$lib/services/workflow/validate';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';
import { waitForToastsToHide } from '$lib/test/toast';

import EntryStatusMenu from './entry-status-menu.svelte';

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
vi.mock('$lib/services/workflow/validate', () => ({ canMoveToStatus: vi.fn(() => true) }));

const entry = /** @type {any} */ ({
  id: 'posts/hello',
  slug: 'hello',
  subPath: 'hello',
  locales: {},
  workflow: {
    status: 'draft',
    collectionName: 'posts',
    pullRequest: { number: 1, branch: 'cms/posts/hello' },
  },
});

describe('EntryStatusMenu', () => {
  beforeEach(() => {
    env.isLargeScreen = true;
    forkedRepository.current = undefined;
    vi.mocked(canMoveToStatus).mockReturnValue(true);
  });

  test('shows the status and offers the other stages', async () => {
    vi.mocked(updateWorkflowStatus).mockResolvedValue(entry);

    await renderWithDraft(EntryStatusMenu, { draft: createMockDraft(), props: { entry } });

    const button = page.getByRole('button', { name: 'Status: \u2068Draft\u2069' });

    await expect.element(button).toHaveTextContent('Status: \u2068Draft\u2069 arrow_drop_down');
    await button.click();

    const items = page.getByRole('menuitemradio');

    // The checked item shows a check icon
    expect(items.elements().map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Draft check',
      'In Review',
      'Ready',
    ]);
    await expect.element(items.nth(0)).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('menuitemradio', { name: 'In Review' }).click();
    await vi.waitFor(() =>
      expect(updateWorkflowStatus).toHaveBeenCalledWith(entry, 'pending_review'),
    );
  });

  test('shows the status alone on a small screen', async () => {
    env.isLargeScreen = false;

    await renderWithDraft(EntryStatusMenu, { draft: createMockDraft(), props: { entry } });
    await expect
      .element(page.getByRole('button', { name: 'Status: \u2068Draft\u2069' }))
      .toHaveTextContent('Draft arrow_drop_down');
  });

  test('offers the Open Authoring stages only while contributing via a fork', async () => {
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });

    await renderWithDraft(EntryStatusMenu, { draft: createMockDraft(), props: { entry } });
    await page.getByRole('button').click();

    expect(page.getByRole('menuitemradio').elements()).toHaveLength(2);
  });

  test('blocks moving an invalid entry forward', async () => {
    vi.mocked(canMoveToStatus).mockReturnValue(false);

    await renderWithDraft(EntryStatusMenu, { draft: createMockDraft(), props: { entry } });
    await page.getByRole('button').click();
    await page.getByRole('menuitemradio', { name: 'Ready' }).click();

    expect(updateWorkflowStatus).not.toHaveBeenCalled();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error The entry has errors. Please correct them before changing the status.',
      );
    await waitForToastsToHide();
  });

  test('reports a failure', async () => {
    vi.mocked(updateWorkflowStatus).mockRejectedValue(new Error('Boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await renderWithDraft(EntryStatusMenu, { draft: createMockDraft(), props: { entry } });
    await page.getByRole('button').click();
    await page.getByRole('menuitemradio', { name: 'In Review' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('error Error Couldn’t change the status. Please try again.');
    await waitForToastsToHide();
  });

  test('says what stands in the way when trying again wouldn’t help', async () => {
    vi.mocked(updateWorkflowStatus).mockRejectedValue(
      createLocalizedError('The workflow branch is in use.', 'workflow.branch_in_use', {
        number: '!3',
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await renderWithDraft(EntryStatusMenu, { draft: createMockDraft(), props: { entry } });
    await page.getByRole('button').click();
    await page.getByRole('menuitemradio', { name: 'In Review' }).click();

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'error Error Another request (\u2068!3\u2069) is already open for this entry outside the CMS. Ask a developer to close it first.',
      );
    await waitForToastsToHide();
  });

  test('closes the editor on an entry that turned out to have been published', async () => {
    // A maintainer merged the contributor’s request since the editor was opened
    vi.mocked(updateWorkflowStatus).mockRejectedValue(new Error('entry_already_published'));
    window.location.hash = '#/collections/posts/entries/hello';

    const { entryDraft } = await renderWithDraft(EntryStatusMenu, {
      draft: createMockDraft({ draft: { isNew: false, originalEntry: entry } }),
      props: { entry },
    });

    await page.getByRole('button').click();
    await page.getByRole('menuitemradio', { name: 'In Review' }).click();

    await expect.poll(() => entryDraft.current).toBe(null);
    await expect.poll(() => window.location.hash).toBe('#/collections/posts');
    // The global toast says why, as this menu goes away with the entry
    expect(contentUpdatesToast.current.alreadyPublished).toBe(true);
    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
  });
});
