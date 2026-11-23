import { beforeEach, describe, expect, test, vi } from 'vitest';

import { goBack } from '$lib/services/app/navigation';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import {
  closeWorkflowEntryEditor,
  handleEntryAlreadyPublished,
  runWorkflowEditorAction,
} from '$lib/services/workflow/editor';
import { ENTRY_ALREADY_PUBLISHED } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/app/navigation', () => ({ goBack: vi.fn() }));
vi.mock('$lib/services/workflow/verify', () => ({
  getWorkflowErrorMessage: vi.fn((ex, fallback) => `${fallback}: ${ex.message}`),
}));

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

  describe('runWorkflowEditorAction', () => {
    const entry = /** @type {any} */ ({
      workflow: { collectionName: 'posts', pullRequest: { branch: BRANCH } },
    });

    test('refuses the action when the draft hasn’t passed the validation', async () => {
      const action = vi.fn();

      await expect(
        runWorkflowEditorAction({
          entry,
          entryDraft: createEntryDraft(),
          valid: false,
          action,
          failure: 'workflow.publishing_entry_failed',
        }),
      ).resolves.toEqual({ blocked: true, errorMessage: undefined });
      expect(action).not.toHaveBeenCalled();
    });

    test('runs the action, leaving the editor open by default', async () => {
      const entryDraft = createEntryDraft();
      const action = vi.fn(async () => {});

      await expect(
        runWorkflowEditorAction({
          entry,
          entryDraft,
          valid: true,
          action,
          failure: 'workflow.status_change_failed',
        }),
      ).resolves.toEqual({ blocked: false, errorMessage: undefined });
      expect(action).toHaveBeenCalledOnce();
      expect(entryDraft.current).not.toBeNull();
      expect(goBack).not.toHaveBeenCalled();
    });

    test('calls the action synchronously', () => {
      const action = vi.fn(async () => {});

      runWorkflowEditorAction({
        entry,
        entryDraft: createEntryDraft(),
        valid: true,
        action,
        failure: 'workflow.status_change_failed',
      });

      expect(action).toHaveBeenCalledOnce();
    });

    test('closes the editor once the action has succeeded, if asked', async () => {
      // The entry leaves the board once published, so its details are read up front
      const leavingEntry = structuredClone(entry);
      const entryDraft = createEntryDraft();

      await runWorkflowEditorAction({
        entry: leavingEntry,
        entryDraft,
        valid: true,
        action: vi.fn(async () => {
          leavingEntry.workflow = undefined;
        }),
        failure: 'workflow.publishing_entry_failed',
        closeOnSuccess: true,
      });

      expect(entryDraft.current).toBeNull();
      expect(goBack).toHaveBeenCalledWith('/collections/posts');
    });

    test('logs a failure and returns its message, leaving the editor open', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const entryDraft = createEntryDraft();
      const ex = new Error('Boom');

      try {
        await expect(
          runWorkflowEditorAction({
            entry,
            entryDraft,
            valid: true,
            action: vi.fn(async () => {
              throw ex;
            }),
            failure: 'workflow.publishing_entry_failed',
            closeOnSuccess: true,
          }),
        ).resolves.toEqual({
          blocked: false,
          errorMessage: 'workflow.publishing_entry_failed: Boom',
        });
        expect(error).toHaveBeenCalledWith(ex);
        expect(entryDraft.current).not.toBeNull();
        expect(goBack).not.toHaveBeenCalled();
      } finally {
        error.mockRestore();
      }
    });

    test('reports an already published entry as a failure unless asked to handle it', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const { errorMessage } = await runWorkflowEditorAction({
          entry,
          entryDraft: createEntryDraft(),
          valid: true,
          action: vi.fn(async () => {
            throw new Error(ENTRY_ALREADY_PUBLISHED);
          }),
          failure: 'workflow.publishing_entry_failed',
        });

        expect(errorMessage).toBe(`workflow.publishing_entry_failed: ${ENTRY_ALREADY_PUBLISHED}`);
        expect(contentUpdatesToast.current.alreadyPublished).toBe(false);
      } finally {
        error.mockRestore();
      }
    });

    test('closes the editor on an entry published since it was opened, if asked', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const entryDraft = createEntryDraft();

      try {
        await expect(
          runWorkflowEditorAction({
            entry,
            entryDraft,
            valid: true,
            action: vi.fn(async () => {
              throw new Error(ENTRY_ALREADY_PUBLISHED);
            }),
            failure: 'workflow.status_change_failed',
            handleAlreadyPublished: true,
          }),
        ).resolves.toEqual({ blocked: false, errorMessage: undefined });
        expect(error).not.toHaveBeenCalled();
        expect(entryDraft.current).toBeNull();
        expect(goBack).toHaveBeenCalledWith('/collections/posts');
        expect(contentUpdatesToast.current.alreadyPublished).toBe(true);
      } finally {
        error.mockRestore();
      }
    });
  });
});
