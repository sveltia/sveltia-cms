import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { buildDraft } from '$lib/services/contents/draft/create';
import { validateDraft, validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';
import { validateWorkflowEntry } from '$lib/services/workflow/validate';

vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));
vi.mock('$lib/services/contents/collection');
vi.mock('$lib/services/contents/collection/files');
vi.mock('$lib/services/contents/draft', () => ({ entryDraft: { subscribe: vi.fn() } }));
vi.mock('$lib/services/contents/draft/create');
vi.mock('$lib/services/contents/draft/validate');
vi.mock('$lib/services/contents/editor/fields');

/** @type {any} */
const collection = { name: 'posts', _type: 'entry' };

/** @type {any} */
const entry = {
  id: 'entry-1',
  slug: 'my-post',
  locales: { en: { slug: 'my-post', path: 'content/posts/my-post.md', content: {} } },
  workflow: { collectionName: 'posts', status: 'draft' },
};

describe('workflow/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(get).mockReturnValue(undefined);
    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(buildDraft).mockReturnValue(/** @type {any} */ ({ collectionName: 'posts' }));
    vi.mocked(validateDraft).mockReturnValue({
      valid: true,
      validities: {},
      validationMessages: {},
    });
  });

  describe('with the entry open in the editor', () => {
    /** @type {any} */
    const openDraft = {
      collectionName: 'posts',
      fileName: undefined,
      currentValues: { en: { title: '' } },
      originalEntry: entry,
    };

    test('validates the values being edited rather than the saved content', () => {
      vi.mocked(get).mockReturnValue(openDraft);
      vi.mocked(validateEntry).mockReturnValue(true);

      expect(validateWorkflowEntry(entry)).toBe(true);
      expect(validateEntry).toHaveBeenCalled();
      expect(buildDraft).not.toHaveBeenCalled();
      expect(expandInvalidFields).not.toHaveBeenCalled();
    });

    test('expands the invalid fields when the entry is incomplete', () => {
      vi.mocked(get).mockReturnValue(openDraft);
      vi.mocked(validateEntry).mockReturnValue(false);

      expect(validateWorkflowEntry(entry)).toBe(false);
      expect(expandInvalidFields).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        currentValues: openDraft.currentValues,
      });
    });
  });

  describe('with the entry shown on the board', () => {
    test('validates a throwaway draft built from the saved content', () => {
      expect(validateWorkflowEntry(entry)).toBe(true);

      expect(buildDraft).toHaveBeenCalledWith({
        collection,
        collectionFile: undefined,
        originalEntry: entry,
      });

      expect(validateEntry).not.toHaveBeenCalled();
      expect(expandInvalidFields).not.toHaveBeenCalled();
    });

    test('returns false when the entry is incomplete', () => {
      vi.mocked(validateDraft).mockReturnValue({
        valid: false,
        validities: {},
        validationMessages: {},
      });

      expect(validateWorkflowEntry(entry)).toBe(false);
    });

    test('ignores a draft open for a different entry', () => {
      vi.mocked(get).mockReturnValue(
        /** @type {any} */ ({ originalEntry: { id: 'entry-2' }, currentValues: {} }),
      );

      expect(validateWorkflowEntry(entry)).toBe(true);
      expect(validateEntry).not.toHaveBeenCalled();
      expect(buildDraft).toHaveBeenCalled();
    });

    test('looks the collection file up for a file collection entry', () => {
      /** @type {any} */
      const collectionFile = { name: 'about', file: 'content/about.md' };
      /** @type {any} */
      const fileEntry = { ...entry, workflow: { ...entry.workflow, fileName: 'about' } };

      vi.mocked(getCollectionFile).mockReturnValue(collectionFile);

      expect(validateWorkflowEntry(fileEntry)).toBe(true);

      expect(buildDraft).toHaveBeenCalledWith({
        collection,
        collectionFile,
        originalEntry: fileEntry,
      });
    });

    test('leaves an entry alone when its collection is no longer configured', () => {
      vi.mocked(getCollection).mockReturnValue(undefined);

      expect(validateWorkflowEntry(entry)).toBe(true);
      expect(buildDraft).not.toHaveBeenCalled();
    });

    test('leaves an entry alone when its collection file is no longer configured', () => {
      /** @type {any} */
      const fileEntry = { ...entry, workflow: { ...entry.workflow, fileName: 'about' } };

      vi.mocked(getCollectionFile).mockReturnValue(undefined);

      expect(validateWorkflowEntry(fileEntry)).toBe(true);
      expect(buildDraft).not.toHaveBeenCalled();
    });
  });
});
