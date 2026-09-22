import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkForRemoteChanges, MIN_CHECK_GAP } from '$lib/services/backends/refresh';
import { isDraftModified } from '$lib/services/contents/draft';
import { deleteBackup, getBackup } from '$lib/services/contents/draft/backup';
import { createDraft } from '$lib/services/contents/draft/create';
import { compareWithStore } from '$lib/services/contents/draft/save/conflict';
import { isWorkflowDraft } from '$lib/services/workflow';

import { refreshOpenedDraft, reloadDraft } from './reload';

vi.mock('$lib/services/backends/refresh', () => ({
  checkForRemoteChanges: vi.fn(),
  MIN_CHECK_GAP: 10 * 1000,
}));
vi.mock('$lib/services/contents/draft', () => ({ isDraftModified: vi.fn(() => false) }));
vi.mock('$lib/services/contents/draft/backup', () => ({
  deleteBackup: vi.fn(),
  getBackup: vi.fn(),
  getBackupSlug: vi.fn(({ originalEntry }) => originalEntry.slug),
}));
vi.mock('$lib/services/contents/draft/create', () => ({ createDraft: vi.fn() }));
vi.mock('$lib/services/contents/draft/save/conflict', () => ({ compareWithStore: vi.fn() }));
vi.mock('$lib/services/workflow', () => ({ isWorkflowDraft: vi.fn(() => false) }));

const collection = { name: 'posts' };
const collectionFile = undefined;
const expanderStates = { _: { 'body#': true } };
const originalEntry = { id: 'a', slug: 'hello', locales: {} };
const entry = { id: 'a', slug: 'hello', locales: {} };

/**
 * Make a draft state holding a draft of the “hello” entry.
 * @param {Record<string, any>} [props] Draft properties to override.
 * @returns {any} Draft state.
 */
const makeEntryDraft = (props = {}) => ({
  current: {
    isNew: false,
    interacted: false,
    collectionName: 'posts',
    collection,
    collectionFile,
    expanderStates,
    originalEntry,
    ...props,
  },
});

describe('reloadDraft', () => {
  test('drops the backup, then makes a new draft from the given entry', async () => {
    const newDraft = { id: 'a' };
    const entryDraft = makeEntryDraft();

    vi.mocked(createDraft).mockReturnValue(/** @type {any} */ (newDraft));

    expect(await reloadDraft({ entryDraft, entry: /** @type {any} */ (entry) })).toBe(newDraft);
    expect(deleteBackup).toHaveBeenCalledWith('posts', 'hello');
    expect(deleteBackup).toHaveBeenCalledBefore(vi.mocked(createDraft));
    expect(createDraft).toHaveBeenCalledWith({
      entryDraft,
      collection,
      collectionFile,
      originalEntry: entry,
      expanderStates,
    });
  });
});

describe('refreshOpenedDraft', () => {
  beforeEach(() => {
    vi.mocked(checkForRemoteChanges).mockResolvedValue(undefined);
    vi.mocked(isDraftModified).mockReturnValue(false);
    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(compareWithStore).mockReturnValue({
      type: 'modified',
      entry: /** @type {any} */ (entry),
    });
    vi.mocked(getBackup).mockResolvedValue(null);
  });

  test('makes the draft again from the entry as it is now', async () => {
    const entryDraft = makeEntryDraft();

    await refreshOpenedDraft(entryDraft);

    // In passing: an entry opened right after another costs nothing
    expect(checkForRemoteChanges).toHaveBeenCalledWith({ maxAge: MIN_CHECK_GAP });
    expect(compareWithStore).toHaveBeenCalledWith(originalEntry);
    expect(createDraft).toHaveBeenCalledWith({
      entryDraft,
      collection,
      collectionFile,
      originalEntry: entry,
      expanderStates,
    });
    // The backup is left alone
    expect(deleteBackup).not.toHaveBeenCalled();
  });

  test('leaves the draft alone when the entry is unchanged or gone', async () => {
    vi.mocked(compareWithStore).mockReturnValue(undefined);
    await refreshOpenedDraft(makeEntryDraft());

    // A deletion is reported by the notice in the editor instead
    vi.mocked(compareWithStore).mockReturnValue({ type: 'deleted' });
    await refreshOpenedDraft(makeEntryDraft());

    expect(createDraft).not.toHaveBeenCalled();
  });

  test('has nothing to check for a new entry or a workflow draft', async () => {
    await refreshOpenedDraft(makeEntryDraft({ isNew: true, originalEntry: undefined }));
    await refreshOpenedDraft(/** @type {any} */ ({ current: null }));

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    await refreshOpenedDraft(makeEntryDraft());

    expect(checkForRemoteChanges).not.toHaveBeenCalled();
  });

  test('leaves the draft alone once the user has started on it', async () => {
    await refreshOpenedDraft(makeEntryDraft({ interacted: true }));

    vi.mocked(isDraftModified).mockReturnValue(true);
    await refreshOpenedDraft(makeEntryDraft());

    expect(createDraft).not.toHaveBeenCalled();
  });

  test('leaves the draft alone when there is a backup to be asked about', async () => {
    vi.mocked(getBackup).mockResolvedValue(/** @type {any} */ ({ timestamp: new Date() }));
    await refreshOpenedDraft(makeEntryDraft());

    expect(getBackup).toHaveBeenCalledWith('posts', 'hello');
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('leaves the editor alone when the user has moved on during the check', async () => {
    const entryDraft = makeEntryDraft();
    const draft = entryDraft.current;

    vi.mocked(checkForRemoteChanges).mockImplementation(async () => {
      // Another entry has been opened in the meantime
      entryDraft.current = { ...draft, originalEntry: { id: 'b' } };

      return undefined;
    });

    await refreshOpenedDraft(entryDraft);

    expect(createDraft).not.toHaveBeenCalled();
  });

  test('gives up quietly when the repository can’t be reached', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('offline');

    vi.mocked(checkForRemoteChanges).mockRejectedValue(error);
    await refreshOpenedDraft(makeEntryDraft());

    expect(consoleSpy).toHaveBeenCalledWith('Failed to check the repository for changes.', error);
    expect(createDraft).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
