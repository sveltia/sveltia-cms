import { beforeEach, describe, expect, test, vi } from 'vitest';

import { detectWorkflowConflict } from '$lib/services/workflow/conflict';
import { loadUnpublishedEntries } from '$lib/services/workflow/load';

// `backend.current` is derived state, so it’s read-only on the real module. The mock stands in
// with a plain object the tests can point at whichever backend they need
const { backend, getUnpublishedEntryByDraft } = vi.hoisted(() => ({
  backend: /** @type {{ current: any }} */ ({ current: undefined }),
  getUnpublishedEntryByDraft: vi.fn(),
}));

vi.mock('$lib/services/backends', () => ({ backend }));
vi.mock('$lib/services/workflow', () => ({ getUnpublishedEntryByDraft }));
vi.mock('$lib/services/workflow/load', () => ({ loadUnpublishedEntries: vi.fn() }));

/** The branch head the draft last committed. */
const HEAD = 'abc123';

/**
 * Build a draft editing an entry that already has a pull request.
 * @param {object} [overrides] Draft properties to override.
 * @returns {any} Draft.
 */
const createDraft = (overrides = {}) => ({
  isNew: false,
  collectionName: 'posts',
  fileName: undefined,
  originalEntry: {
    id: 'posts/hello',
    slug: 'hello',
    locales: { _default: { content: { title: 'Hello' } } },
    workflow: { pullRequest: { branch: 'cms/posts/hello', headSHA: HEAD } },
  },
  ...overrides,
});

describe('detectWorkflowConflict', () => {
  /** @type {any} */
  let fetchBranchHead;

  beforeEach(() => {
    fetchBranchHead = vi.fn(async () => HEAD);
    backend.current = { workflow: { fetchBranchHead } };
    vi.mocked(loadUnpublishedEntries).mockResolvedValue(undefined);
    getUnpublishedEntryByDraft.mockReturnValue(undefined);
  });

  test('reports nothing when the branch is where the draft left it', async () => {
    await expect(detectWorkflowConflict(createDraft())).resolves.toBeUndefined();

    expect(fetchBranchHead).toHaveBeenCalledWith('cms/posts/hello');
    // The head is a small request; only a branch that has moved costs the reload
    expect(loadUnpublishedEntries).not.toHaveBeenCalled();
  });

  test('reports a colleague’s change to the entry', async () => {
    const current = {
      id: 'posts/hello',
      locales: { _default: { content: { title: 'Hello again' } } },
    };

    fetchBranchHead.mockResolvedValue('def456');
    getUnpublishedEntryByDraft.mockReturnValue(current);

    await expect(detectWorkflowConflict(createDraft())).resolves.toEqual({
      type: 'modified',
      entry: current,
      canOverwrite: true,
    });

    expect(loadUnpublishedEntries).toHaveBeenCalled();
  });

  test('reports the entry as deleted when it’s gone from the branch', async () => {
    fetchBranchHead.mockResolvedValue('def456');
    getUnpublishedEntryByDraft.mockReturnValue(undefined);

    await expect(detectWorkflowConflict(createDraft())).resolves.toEqual({
      type: 'deleted',
      canOverwrite: true,
    });
  });

  test('reports nothing when the branch moved without touching the entry', async () => {
    // Someone committed an asset, or rewrote the file without changing what it says
    const draft = createDraft();

    fetchBranchHead.mockResolvedValue('def456');
    getUnpublishedEntryByDraft.mockReturnValue({
      id: 'posts/hello',
      locales: draft.originalEntry.locales,
    });

    await expect(detectWorkflowConflict(draft)).resolves.toBeUndefined();
  });

  test('refuses to save over the change to an entry stored with the others', async () => {
    const draft = createDraft();

    draft.originalEntry.arrayIndex = 2;
    fetchBranchHead.mockResolvedValue('def456');
    getUnpublishedEntryByDraft.mockReturnValue({
      id: 'posts/hello',
      locales: { _default: { content: { title: 'Hello again' } } },
    });

    await expect(detectWorkflowConflict(draft)).resolves.toMatchObject({ canOverwrite: false });
  });

  test('leaves a branch that is gone to the pull request listing', async () => {
    // Merged or closed outside the CMS: a separate known issue, not a change to save over
    fetchBranchHead.mockResolvedValue(undefined);

    await expect(detectWorkflowConflict(createDraft())).resolves.toBeUndefined();
    expect(loadUnpublishedEntries).not.toHaveBeenCalled();
  });

  test('lets the save go ahead when the branch can’t be read', async () => {
    const error = new Error('Failed to send the request');
    const spy = vi.spyOn(console, 'error').mockReturnValue(undefined);

    fetchBranchHead.mockRejectedValue(error);

    await expect(detectWorkflowConflict(createDraft())).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith('Failed to check the workflow branch for changes.', error);
    spy.mockRestore();
  });

  test('reports nothing for a draft with nothing to overwrite', async () => {
    // A new entry has no branch yet, and neither has one whose first save hasn’t landed
    await expect(detectWorkflowConflict(createDraft({ isNew: true }))).resolves.toBeUndefined();
    await expect(
      detectWorkflowConflict(createDraft({ originalEntry: undefined })),
    ).resolves.toBeUndefined();
    await expect(
      detectWorkflowConflict(createDraft({ originalEntry: { id: 'posts/hello', locales: {} } })),
    ).resolves.toBeUndefined();
    await expect(
      detectWorkflowConflict(
        createDraft({
          originalEntry: {
            id: 'posts/hello',
            locales: {},
            workflow: { pullRequest: { branch: 'cms/posts/hello' } },
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(fetchBranchHead).not.toHaveBeenCalled();
  });

  test('reports nothing without a backend that supports the workflow', async () => {
    backend.current = {};

    await expect(detectWorkflowConflict(createDraft())).resolves.toBeUndefined();
  });
});
