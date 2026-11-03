import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { getCollection } from '$lib/services/contents/collection';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import PendingEditInfobar from './pending-edit-infobar.svelte';

const fields = [{ name: 'title', widget: 'string' }];
const postsCollection = { name: 'posts', label: 'Posts', folder: 'content/posts', fields };
const authorsCollection = { name: 'authors', label: 'Authors', folder: 'content/authors', fields };
const adaEntry = createMockEntry({ slug: 'ada', content: { _default: { title: 'Ada' } } });

/**
 * Render the infobar for a draft of the “ada” entry.
 * @param {Record<string, any>} [draftProps] Draft properties to override.
 */
const renderInfobar = async (draftProps = {}) => {
  const draft = createMockDraft({
    fields,
    values: { _default: { title: 'Ada' } },
    draft: {
      isNew: false,
      originalEntry: adaEntry,
      collection: getCollection('authors'),
      collectionName: 'authors',
      ...draftProps,
    },
  });

  await renderWithDraft(PendingEditInfobar, { draft });
};

/**
 * Put a pull request of a post that changes the given entry on the board.
 * @param {any} entry Entry the pull request changes.
 */
const addPostPullRequest = (entry) => {
  unpublishedEntries.current = [
    /** @type {any} */ ({
      ...createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello World' } } }),
      workflow: {
        collectionName: 'posts',
        status: 'draft',
        pullRequest: { branch: 'cms/posts/hello', files: [] },
        companions: [{ collectionName: 'authors', entry, edited: true }],
      },
    }),
  ];
};

describe('PendingEditInfobar', () => {
  beforeEach(async () => {
    await initTestConfig({ collections: [postsCollection, authorsCollection] });
    unpublishedEntries.current = [];
    setEntries([adaEntry]);
  });

  test('shows nothing while no other pull request changes the entry', async () => {
    await renderInfobar();

    expect(page.getByRole('alert').query()).toBeNull();
  });

  test('warns that the entry has changes waiting in the pull request of another entry', async () => {
    // @see https://github.com/sveltia/sveltia-cms/issues/1129
    addPostPullRequest({ ...adaEntry, slug: 'ada' });
    await renderInfobar();

    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent(/waiting to be published along with .*Hello World/);
  });

  test('shows nothing for a new entry', async () => {
    addPostPullRequest(adaEntry);
    await renderInfobar({ isNew: true, originalEntry: undefined });

    expect(page.getByRole('alert').query()).toBeNull();
  });
});
