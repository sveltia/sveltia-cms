import { beforeEach, describe, expect, test, vi } from 'vitest';

import { duplicateDraft } from '$lib/services/contents/draft/create/duplicate';
import { saveEntry } from '$lib/services/contents/draft/save';
import { validateDraft } from '$lib/services/contents/draft/validate';
import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';
import { duplicateEntryDraft, saveEntryDraftFlow } from '$lib/services/contents/editor/save';
import { updateWorkflowStatus } from '$lib/services/workflow/save';

vi.mock('$lib/services/contents/draft/create/duplicate', () => ({ duplicateDraft: vi.fn() }));
vi.mock('$lib/services/contents/draft/save', () => ({ saveEntry: vi.fn() }));
vi.mock('$lib/services/contents/draft/validate', () => ({ validateDraft: vi.fn() }));
vi.mock('$lib/services/contents/draft/validate/reveal', () => ({
  countInvalidFields: vi.fn(() => 3),
}));
vi.mock('$lib/services/contents/editor/pending', () => ({
  awaitPendingFieldUpdates: vi.fn(async () => {}),
}));
vi.mock('$lib/services/workflow/save', () => ({ updateWorkflowStatus: vi.fn() }));
vi.mock('$lib/services/workflow/verify', () => ({
  getWorkflowErrorMessage: vi.fn((ex, fallback) => `${fallback}: ${ex.message}`),
}));

/**
 * Create a draft and the state holding it.
 * @param {Record<string, any>} [props] Draft properties.
 * @returns {any} Entry draft state.
 */
const createState = (props = {}) => ({
  current: {
    isNew: false,
    collection: { name: 'posts' },
    collectionName: 'posts',
    validities: {},
    ...props,
  },
  modified: true,
});

/**
 * Get the default arguments.
 * @param {any} entryDraft Entry draft state.
 * @returns {any} Arguments.
 */
const getArgs = (entryDraft) => ({
  entryDraft,
  useWorkflow: vi.fn(() => false),
  askForReview: vi.fn(async () => true),
  closeOnSave: vi.fn(() => true),
});

describe('saveEntryDraftFlow()', () => {
  beforeEach(() => {
    vi.mocked(validateDraft).mockReturnValue(/** @type {any} */ ({ valid: true }));
  });

  test('saves the draft and closes the editor', async () => {
    const entryDraft = createState();
    const savedEntry = { subPath: 'hello' };

    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ (savedEntry));

    expect(await saveEntryDraftFlow({ ...getArgs(entryDraft), skipCI: true })).toEqual({
      type: 'saved',
      savedEntry,
      statusError: undefined,
      path: undefined,
      next: 'close',
    });
    expect(awaitPendingFieldUpdates).toHaveBeenCalled();
    expect(saveEntry).toHaveBeenCalledWith({
      draft: entryDraft.current,
      skipCI: true,
      overwrite: false,
    });
  });

  test('resets the draft when the editor stays open', async () => {
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({}));

    expect(
      await saveEntryDraftFlow({ ...getArgs(createState()), closeOnSave: vi.fn(() => false) }),
    ).toMatchObject({ type: 'saved', next: 'reset' });
  });

  test('gives the path of a new entry', async () => {
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({ subPath: 'a b/c' }));

    expect(await saveEntryDraftFlow(getArgs(createState({ isNew: true })))).toMatchObject({
      path: '/collections/posts/entries/a%20b/c',
    });
    expect(
      await saveEntryDraftFlow(
        getArgs(createState({ isNew: true, collectionFile: { name: 'about' } })),
      ),
    ).toMatchObject({ path: '/collections/posts/entries/about' });
  });

  test('skips an unchanged entry or a closed draft', async () => {
    const entryDraft = createState();

    entryDraft.modified = false;
    expect(await saveEntryDraftFlow(getArgs(entryDraft))).toEqual({ type: 'skipped' });

    const closed = createState();

    vi.mocked(awaitPendingFieldUpdates).mockImplementationOnce(async () => {
      closed.current = null;
    });
    expect(await saveEntryDraftFlow(getArgs(closed))).toEqual({ type: 'skipped' });
    expect(saveEntry).not.toHaveBeenCalled();
  });

  test('leaves the editor alone when another draft has been opened during the save', async () => {
    const entryDraft = createState();
    const savedEntry = {};

    vi.mocked(saveEntry).mockImplementation(async () => {
      entryDraft.current = {};

      return /** @type {any} */ (savedEntry);
    });

    expect(await saveEntryDraftFlow(getArgs(entryDraft))).toEqual({ type: 'saved', savedEntry });
  });

  test('sends a draft for review when the user agrees', async () => {
    const savedEntry = { workflow: { status: 'draft' } };
    const args = { ...getArgs(createState()), useWorkflow: vi.fn(() => true) };

    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ (savedEntry));

    expect(await saveEntryDraftFlow(args)).toMatchObject({ type: 'saved', next: 'close' });
    expect(args.askForReview).toHaveBeenCalled();
    expect(updateWorkflowStatus).toHaveBeenCalledWith(savedEntry, 'pending_review');
  });

  test('doesn’t offer review when it doesn’t apply', async () => {
    const args = getArgs(createState());

    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({ workflow: { status: 'draft' } }));
    await saveEntryDraftFlow(args);
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({ workflow: { status: 'x' } }));
    await saveEntryDraftFlow({ ...args, useWorkflow: vi.fn(() => true) });
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({}));
    await saveEntryDraftFlow({ ...args, useWorkflow: vi.fn(() => true) });
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({ workflow: { status: 'draft' } }));
    vi.mocked(validateDraft).mockReturnValue(/** @type {any} */ ({ valid: false }));
    await saveEntryDraftFlow({ ...args, useWorkflow: vi.fn(() => true) });
    expect(args.askForReview).not.toHaveBeenCalled();

    args.askForReview.mockResolvedValue(false);
    vi.mocked(validateDraft).mockReturnValue(/** @type {any} */ ({ valid: true }));
    await saveEntryDraftFlow({ ...args, useWorkflow: vi.fn(() => true) });
    expect(args.askForReview).toHaveBeenCalled();
    expect(updateWorkflowStatus).not.toHaveBeenCalled();
  });

  test('keeps the editor open when the status change fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ ({ workflow: { status: 'draft' } }));
    vi.mocked(updateWorkflowStatus).mockRejectedValue(new Error('boom'));

    expect(
      await saveEntryDraftFlow({ ...getArgs(createState()), useWorkflow: vi.fn(() => true) }),
    ).toMatchObject({
      type: 'saved',
      statusError: 'workflow.status_change_failed: boom',
      next: 'reset',
    });
    expect(error).toHaveBeenCalled();
  });

  test('reports a failed status change after another draft has been opened', async () => {
    const entryDraft = createState();
    const savedEntry = { workflow: { status: 'draft' } };

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveEntry).mockResolvedValue(/** @type {any} */ (savedEntry));
    vi.mocked(updateWorkflowStatus).mockImplementation(async () => {
      entryDraft.current = {};
      throw new Error('boom');
    });

    expect(
      await saveEntryDraftFlow({ ...getArgs(entryDraft), useWorkflow: vi.fn(() => true) }),
    ).toEqual({
      type: 'saved',
      savedEntry,
      statusError: 'workflow.status_change_failed: boom',
    });
  });

  test('counts the invalid fields', async () => {
    vi.mocked(saveEntry).mockRejectedValue(new Error('validation_failed'));

    expect(await saveEntryDraftFlow(getArgs(createState()))).toEqual({
      type: 'invalid',
      errorCount: 3,
    });
  });

  test('reports a conflict, or an error once another draft has been opened', async () => {
    const conflict = { type: 'modified' };
    const entryDraft = createState();

    vi.mocked(saveEntry).mockRejectedValue(new Error('save_conflict', { cause: conflict }));
    expect(await saveEntryDraftFlow(getArgs(entryDraft))).toEqual({ type: 'conflict', conflict });

    vi.mocked(saveEntry).mockImplementation(async () => {
      entryDraft.current = {};
      throw new Error('save_conflict', { cause: conflict });
    });
    expect(await saveEntryDraftFlow(getArgs(entryDraft))).toEqual({ type: 'error', message: '' });
  });

  test('reports other errors, logging unexpected ones', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(saveEntry).mockRejectedValue(
      new Error('saving_failed', { cause: new Error('Forbidden') }),
    );
    expect(await saveEntryDraftFlow(getArgs(createState()))).toEqual({
      type: 'error',
      message: 'Forbidden',
    });
    expect(error).not.toHaveBeenCalled();

    vi.mocked(saveEntry).mockRejectedValue(new TypeError('oops'));
    expect(await saveEntryDraftFlow(getArgs(createState()))).toEqual({
      type: 'error',
      message: '',
    });
    expect(error).toHaveBeenCalled();
  });
});

describe('duplicateEntryDraft()', () => {
  test('gives the path of the duplicate', async () => {
    vi.mocked(duplicateDraft).mockResolvedValue(/** @type {any} */ ({}));
    expect(await duplicateEntryDraft(createState())).toBe('/collections/posts/new');
  });

  test('gives nothing when the duplicate isn’t in place', async () => {
    vi.mocked(duplicateDraft).mockResolvedValue(undefined);
    expect(await duplicateEntryDraft(createState())).toBeUndefined();
  });
});
