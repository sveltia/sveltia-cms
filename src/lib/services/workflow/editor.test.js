import { beforeEach, describe, expect, test, vi } from 'vitest';

import { goBack } from '$lib/services/app/navigation';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import {
  closeWorkflowEntryEditor,
  handleEntryAlreadyPublished,
} from '$lib/services/workflow/editor';
import { ENTRY_ALREADY_PUBLISHED } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/app/navigation', () => ({ goBack: vi.fn() }));

const BRANCH = 'cms/contributor/repo/posts/hello';

/**
 * Create an editor’s draft state with a draft of the entry on the given branch open in it.
 * @param {string} [branch] Workflow branch of the entry being edited.
 * @returns {any} Draft state.
 */
const createEntryDraft = (branch = BRANCH) => ({
  current: { originalEntry: { workflow: { pullRequest: { branch } } } },
});

describe('workflow/editor', () => {
  beforeEach(() => {
    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
  });

  describe('closeWorkflowEntryEditor', () => {
    test('closes the draft of the entry and goes back to its collection', () => {
      const entryDraft = createEntryDraft();

      closeWorkflowEntryEditor({ entryDraft, branch: BRANCH, collectionName: 'posts' });

      expect(entryDraft.current).toBeNull();
      expect(goBack).toHaveBeenCalledWith('/collections/posts');
    });

    test('leaves another entry’s draft alone', () => {
      const entryDraft = createEntryDraft('cms/contributor/repo/posts/world');
      const draft = entryDraft.current;

      closeWorkflowEntryEditor({ entryDraft, branch: BRANCH, collectionName: 'posts' });

      expect(entryDraft.current).toBe(draft);
      expect(goBack).not.toHaveBeenCalled();
    });

    test('does nothing once the editor has closed', () => {
      const entryDraft = /** @type {any} */ ({ current: null });

      closeWorkflowEntryEditor({ entryDraft, branch: BRANCH, collectionName: 'posts' });

      expect(goBack).not.toHaveBeenCalled();
    });
  });

  describe('handleEntryAlreadyPublished', () => {
    test('closes the editor and says the entry has been published', () => {
      const entryDraft = createEntryDraft();

      expect(
        handleEntryAlreadyPublished(new Error(ENTRY_ALREADY_PUBLISHED), {
          entryDraft,
          branch: BRANCH,
          collectionName: 'posts',
        }),
      ).toBe(true);

      expect(entryDraft.current).toBeNull();
      expect(goBack).toHaveBeenCalledWith('/collections/posts');
      expect(contentUpdatesToast.current).toEqual({
        ...UPDATE_TOAST_DEFAULT_STATE,
        alreadyPublished: true,
      });
    });

    test('keeps the editor open on unsaved changes, which would otherwise be lost', () => {
      const entryDraft = { ...createEntryDraft(), modified: true };
      const draft = entryDraft.current;

      expect(
        handleEntryAlreadyPublished(new Error(ENTRY_ALREADY_PUBLISHED), {
          entryDraft,
          branch: BRANCH,
          collectionName: 'posts',
        }),
      ).toBe(true);

      expect(entryDraft.current).toBe(draft);
      expect(goBack).not.toHaveBeenCalled();
      expect(contentUpdatesToast.current.alreadyPublished).toBe(true);
    });

    test('leaves any other error to the caller', () => {
      const entryDraft = createEntryDraft();

      expect(
        handleEntryAlreadyPublished(new Error('Boom'), {
          entryDraft,
          branch: BRANCH,
          collectionName: 'posts',
        }),
      ).toBe(false);

      expect(entryDraft.current).not.toBeNull();
      expect(goBack).not.toHaveBeenCalled();
      expect(contentUpdatesToast.current.alreadyPublished).toBe(false);
    });
  });
});
