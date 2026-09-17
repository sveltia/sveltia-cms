import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';
import { createState } from '$lib/services/utils/state.svelte';

import { getReferencedPendingEntries, isPendingEntryReferenced } from './pending-entries';

/**
 * @import { EntryDraft, PendingEntry } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

/**
 * Field configurations by collection and top-level key path, which is what the mocked
 * {@link getField} resolves. A key path of a list item, e.g. `tags.0`, resolves to the list’s
 * field.
 * @type {Record<string, Record<string, Field>>}
 */
const fields = {
  posts: {
    title: { name: 'title', widget: 'string' },
    author: { name: 'author', widget: 'relation', collection: 'authors' },
    tags: { name: 'tags', widget: 'relation', collection: 'tags', multiple: true },
    category: { name: 'category', widget: 'relation', collection: 'categories' },
  },
  authors: {
    team: { name: 'team', widget: 'relation', collection: 'teams' },
  },
  teams: {
    parent: { name: 'parent', widget: 'relation', collection: 'teams' },
  },
};

/**
 * Build a pending entry.
 * @param {string} collectionName Collection name.
 * @param {string} slug Entry slug, which is also the value the entry goes by.
 * @param {object} [options] Options.
 * @param {any[]} [options.values] Values the entry goes by, if not the slug.
 * @param {Record<string, any>} [options.content] Content of the entry.
 * @returns {PendingEntry} Pending entry.
 */
const createPendingEntry = (collectionName, slug, { values = [slug], content = {} } = {}) => ({
  collectionName,
  entry: /** @type {any} */ ({
    id: `${collectionName}/${slug}`,
    slug,
    subPath: slug,
    locales: { en: { slug, path: `${collectionName}/${slug}.md`, content }, fr: { path: '' } },
  }),
  changes: [{ action: 'create', path: `${collectionName}/${slug}.md`, data: `title: ${slug}` }],
  savingAssets: [],
  values,
});

/**
 * Build a post draft.
 * @param {object} [options] Options.
 * @param {Record<string, Record<string, any>>} [options.currentValues] Field values by locale.
 * @param {Record<string, Record<string, any>>} [options.extraValues] Rich text editor component
 * values by locale.
 * @param {PendingEntry[]} [options.pendingEntries] Pending entries.
 * @returns {EntryDraft} Draft.
 */
const createDraft = ({ currentValues = { en: {} }, extraValues = {}, pendingEntries = [] } = {}) =>
  /** @type {EntryDraft} */ (
    /** @type {unknown} */ ({
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      currentValues,
      extraValues,
      pendingEntries,
    })
  );

beforeEach(() => {
  vi.mocked(getField).mockImplementation(
    ({ collectionName, keyPath }) => fields[collectionName]?.[keyPath.split('.')[0]],
  );
});

describe('isPendingEntryReferenced', () => {
  it('finds the value in any locale', () => {
    const draft = createDraft({
      currentValues: {
        en: { title: 'Hello', 'tags.0': 'svelte' },
        fr: { title: 'Bonjour', 'tags.0': 'vite' },
      },
    });

    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'svelte'))).toBe(true);
    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'vite'))).toBe(true);
    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'react'))).toBe(false);
    expect(getField).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      valueMap: draft.currentValues.en,
      keyPath: 'tags.0',
    });
  });

  it('only counts a Relation field pointing at the entry’s collection', () => {
    // The tag and the category go by the same slug
    const draft = createDraft({ currentValues: { en: { title: 'news', category: 'news' } } });

    expect(isPendingEntryReferenced(draft, createPendingEntry('categories', 'news'))).toBe(true);
    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'news'))).toBe(false);
  });

  it('gives a value in a field that can’t be looked up the benefit of the doubt', () => {
    const draft = createDraft({ currentValues: { en: { translationKey: 'svelte' } } });

    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'svelte'))).toBe(true);
  });

  it('finds the value held by a rich text editor component', () => {
    const draft = createDraft({
      currentValues: { en: { body: '<!-- component -->' } },
      extraValues: { en: { 'body:abc.tag': 'svelte' } },
    });

    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'svelte'))).toBe(true);
    expect(isPendingEntryReferenced(draft, createPendingEntry('tags', 'react'))).toBe(false);
    // The component’s field isn’t looked up
    expect(getField).not.toHaveBeenCalledWith(expect.objectContaining({ keyPath: 'body:abc.tag' }));
  });

  it('matches any of the values the entry goes by', () => {
    const draft = createDraft({ currentValues: { en: { 'tags.0': 'en/svelte' } } });

    expect(
      isPendingEntryReferenced(
        draft,
        createPendingEntry('tags', 'svelte', { values: ['en/svelte', 'fr/svelte'] }),
      ),
    ).toBe(true);
    expect(
      isPendingEntryReferenced(
        draft,
        createPendingEntry('tags', 'svelte', { values: ['fr/svelte'] }),
      ),
    ).toBe(false);
  });
});

describe('getReferencedPendingEntries', () => {
  it('returns the referenced entries as plain objects', () => {
    const svelte = createPendingEntry('tags', 'svelte');
    const react = createPendingEntry('tags', 'react');

    const draft = createState(
      createDraft({
        currentValues: { en: { title: 'Hello', 'tags.0': 'svelte' } },
        pendingEntries: [svelte, react],
      }),
    );

    const result = getReferencedPendingEntries(draft);

    expect(result).toEqual([svelte]);
    // A snapshot rather than the reactive proxy, so it can be cloned
    expect(result[0]).not.toBe(draft.pendingEntries[0]);
    expect(() => structuredClone(result[0])).not.toThrow();
  });

  it('follows the references between the pending entries', () => {
    // The post refers to the author, the author to the team, the team to a parent team; another
    // team is only referred to by the deselected co-author
    const parentTeam = createPendingEntry('teams', 'acme');
    const team = createPendingEntry('teams', 'devs', { content: { parent: 'acme' } });
    const author = createPendingEntry('authors', 'jane', { content: { team: 'devs' } });
    const otherTeam = createPendingEntry('teams', 'sales');
    const coAuthor = createPendingEntry('authors', 'john', { content: { team: 'sales' } });

    const draft = createDraft({
      currentValues: { en: { author: 'jane' } },
      pendingEntries: [coAuthor, otherTeam, parentTeam, team, author],
    });

    expect(getReferencedPendingEntries(draft)).toEqual([parentTeam, team, author]);
    expect(getField).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'authors', keyPath: 'team' }),
    );
  });

  it('returns an empty list when nothing is pending', () => {
    expect(getReferencedPendingEntries(createDraft())).toEqual([]);
  });
});
