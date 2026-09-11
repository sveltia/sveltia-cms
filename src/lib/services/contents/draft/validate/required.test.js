import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import { unpublishedEntries, workflowEnabled } from '$lib/services/workflow';

vi.mock('$lib/services/workflow', async () => {
  const entries = { current: [] };

  return {
    workflowEnabled: { current: false },
    unpublishedEntries: entries,
    getUnpublishedEntryBySlug: vi.fn(({ collectionName, slug }) =>
      entries.current.find(
        (/** @type {any} */ entry) =>
          entry.workflow.pullRequest.branch === `cms/${collectionName}/${slug}`,
      ),
    ),
  };
});

/** The mocked state, which is writable unlike the derived state it stands in for. */
const enabled = /** @type {any} */ (workflowEnabled);
const entries = /** @type {any} */ (unpublishedEntries);

/**
 * Build a minimal draft for an entry with the given workflow status.
 * @param {string} [status] Status recorded on the entry when the editor opened it.
 * @returns {any} Draft.
 */
const draftFor = (status) => ({
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
    enabled.current = true;
    entries.current = [];
  });

  test('enforces the required fields without Editorial Workflow', () => {
    enabled.current = false;

    expect(isRequiredEnforced(draftFor('draft'))).toBe(true);
    expect(isRequiredEnforced(/** @type {any} */ ({}))).toBe(true);
  });

  test('relaxes them for an entry that has no pull request yet', () => {
    expect(isRequiredEnforced(/** @type {any} */ ({ collectionName: 'posts' }))).toBe(false);
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
});
