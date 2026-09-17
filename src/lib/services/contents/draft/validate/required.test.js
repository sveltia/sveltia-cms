import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import { isWorkflowDraft, unpublishedEntries } from '$lib/services/workflow';

vi.mock('$lib/services/workflow', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  isWorkflowDraft: vi.fn(),
}));

const entries = /** @type {any} */ (unpublishedEntries);
const collection = { name: 'posts' };

/**
 * Build a minimal draft for an entry with the given workflow status.
 * @param {string} [status] Status recorded on the entry when the editor opened it.
 * @returns {any} Draft.
 */
const draftFor = (status) => ({
  collection,
  collectionName: 'posts',
  fileName: undefined,
  originalEntry: {
    id: 'entry-1',
    slug: 'my-post',
    ...(status ? { workflow: { status, pullRequest: { branch: 'cms/posts/my-post' } } } : {}),
  },
});

describe('contents/draft/validate/required', () => {
  beforeEach(() => {
    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    entries.current = [];
  });

  test('enforces the required fields without Editorial Workflow', () => {
    vi.mocked(isWorkflowDraft).mockReturnValue(false);

    expect(isRequiredEnforced(draftFor('draft'))).toBe(true);
    expect(isRequiredEnforced(/** @type {any} */ ({}))).toBe(true);
  });

  test('asks whether the draft itself goes through Editorial Workflow', () => {
    // A collection can opt out of the workflow while it’s enabled for the site, and an entry that
    // already has a pull request stays in it
    const draft = draftFor('draft');

    isRequiredEnforced(draft);

    expect(isWorkflowDraft).toHaveBeenCalledWith(draft);
  });

  test('relaxes them for an entry that has no pull request yet', () => {
    expect(isRequiredEnforced(/** @type {any} */ ({ collection, collectionName: 'posts' }))).toBe(
      false,
    );
    expect(isRequiredEnforced(draftFor())).toBe(false);
  });

  test('relaxes them for an entry still in the drafting stage', () => {
    expect(isRequiredEnforced(draftFor('draft'))).toBe(false);
  });

  test('enforces them once the entry has left the drafting stage', () => {
    expect(isRequiredEnforced(draftFor('pending_review'))).toBe(true);
    expect(isRequiredEnforced(draftFor('pending_publish'))).toBe(true);
  });

  test('follows a status changed while the editor is open', () => {
    const draft = draftFor('draft');

    // The entry was opened as a draft and handed over for review since, from the status menu or the
    // Editorial Workflow page. The draft still holds the entry as it was, so the state decides
    entries.current = [
      {
        id: 'entry-1',
        workflow: { status: 'pending_review', pullRequest: { branch: 'cms/posts/my-post' } },
      },
    ];

    expect(isRequiredEnforced(draft)).toBe(true);
  });

  test('finds the entry by the branch derived from its slug', () => {
    const draft = draftFor();

    entries.current = [
      {
        id: 'entry-1',
        workflow: { status: 'pending_publish', pullRequest: { branch: 'cms/posts/my-post' } },
      },
    ];

    expect(isRequiredEnforced(draft)).toBe(true);
  });

  test('finds the entry by its branch after the slug has been edited', () => {
    const draft = draftFor('pending_review');

    // The branch keeps the slug the pull request was opened with
    draft.originalEntry.slug = 'renamed';

    entries.current = [
      {
        id: 'entry-1',
        workflow: { status: 'pending_review', pullRequest: { branch: 'cms/posts/my-post' } },
      },
    ];

    expect(isRequiredEnforced(draft)).toBe(true);
  });
});
