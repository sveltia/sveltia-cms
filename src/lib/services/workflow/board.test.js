import { describe, expect, test, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';
import {
  COLUMN_LABELS,
  getBoardAnnouncement,
  getCompanionNotes,
  getDiscardMessages,
  getPublishMessages,
  getUnpublishedEntryLabel,
  groupEntriesByStatus,
  STATUS_UPDATE_MESSAGES,
} from '$lib/services/workflow/board';

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({
    strings: {
      'workflow.companion_entries': 'Also adds {entries}',
      'workflow.edited_companion_entries': 'Also changes {entries}',
      'workflow.companion_entry': '{collection}: {title}',
    },
  }),
);
vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  getCollectionLabel: vi.fn((collection) => collection.label_singular),
}));
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn((_collection, entry) => entry.locales._default.content.title),
}));

describe('COLUMN_LABELS', () => {
  test('uses the plural heading for drafts', () => {
    expect(COLUMN_LABELS.draft).toBe('status.drafts');
    expect(COLUMN_LABELS.pending_review).not.toBe('status.drafts');
  });
});

describe('toast messages', () => {
  test('reports a status update', () => {
    expect(STATUS_UPDATE_MESSAGES.success).toBe('workflow.status_updated');
  });

  test('reports discarding an entry or calling a deletion off', () => {
    expect(getDiscardMessages(false).success).toBe('workflow.entry_deleted');
    expect(getDiscardMessages(true).success).toBe('workflow.deletion_cancelled');
  });

  test('reports publishing an entry or carrying a deletion out', () => {
    expect(getPublishMessages(false).success).toBe('workflow.entry_published');
    expect(getPublishMessages(true).success).toBe('workflow.entry_deleted');
  });
});

describe('groupEntriesByStatus()', () => {
  test('sorts entries into the stage columns and lists pending deletions separately', () => {
    /** @type {any[]} */
    const entries = [
      { id: 1, workflow: { status: 'draft' } },
      { id: 2, workflow: { status: 'pending_deletion' } },
      { id: 3, workflow: { status: 'pending_publish' } },
      { id: 4, workflow: { status: 'draft' } },
    ];

    expect(groupEntriesByStatus(['draft', 'pending_review', 'pending_publish'], entries)).toEqual({
      columns: [
        { status: 'draft', entries: [entries[0], entries[3]] },
        { status: 'pending_review', entries: [] },
        { status: 'pending_publish', entries: [entries[2]] },
      ],
      pendingDeletions: [entries[1]],
    });
  });

  test('places entries by the stage they’re in, adding a column for a stage that isn’t shown', () => {
    /** @type {any[]} */
    const entries = [
      { id: 1, workflow: { status: 'pending_review' } },
      { id: 2, workflow: { status: 'pending_publish' } },
    ];

    expect(
      groupEntriesByStatus(['draft'], entries, ({ workflow: { status } }) =>
        status === 'pending_review' ? 'draft' : status,
      ),
    ).toEqual({
      columns: [
        { status: 'draft', entries: [entries[0]] },
        { status: 'pending_publish', entries: [entries[1]] },
      ],
      pendingDeletions: [],
    });
  });
});

describe('getBoardAnnouncement()', () => {
  /**
   * Create columns with the given statuses, each holding as many entries as its position.
   * @param {...string} statuses Statuses.
   * @returns {any[]} Columns.
   */
  const createColumns = (...statuses) =>
    statuses.map((status, index) => ({ status, entries: Array(index + 1).fill({}) }));

  /** @type {any[]} */
  const deletions = [{}];

  test('announces every column of the Editorial Workflow board', () => {
    expect(
      getBoardAnnouncement(createColumns('draft', 'pending_review', 'pending_publish'), deletions),
    ).toEqual({
      key: 'viewing_editorial_workflow',
      values: { draft: 1, review: 2, ready: 3, deletion: 1 },
    });
  });

  test('leaves out the columns the board does not have', () => {
    expect(getBoardAnnouncement(createColumns('draft', 'pending_publish'), [])).toEqual({
      key: 'viewing_editorial_workflow_without_review',
      values: { draft: 1, ready: 2, deletion: 0 },
    });

    expect(getBoardAnnouncement(createColumns('draft', 'pending_review'), [])).toEqual({
      key: 'viewing_open_authoring_workflow',
      values: { draft: 1, review: 2, deletion: 0 },
    });

    expect(getBoardAnnouncement(createColumns('draft'), [])).toEqual({
      key: 'viewing_preview_workflow',
      values: { draft: 1, deletion: 0 },
    });
  });
});

describe('getUnpublishedEntryLabel()', () => {
  const entry = /** @type {any} */ ({
    slug: 'hello',
    locales: { _default: { content: { title: 'Hello' } } },
    workflow: { collectionName: 'posts' },
  });

  test('names the entry by its summary, or the collection file by its label', () => {
    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ ({ name: 'posts' }));
    expect(getUnpublishedEntryLabel(entry)).toBe('Hello');

    vi.mocked(getCollection).mockReturnValue(
      /** @type {any} */ ({
        name: 'pages',
        _fileMap: { about: { name: 'about', label: 'About' } },
      }),
    );
    expect(
      getUnpublishedEntryLabel({
        ...entry,
        workflow: { collectionName: 'pages', fileName: 'about' },
      }),
    ).toBe('About');
  });

  test('falls back to the slug when the collection has been removed', () => {
    vi.mocked(getCollection).mockReturnValue(undefined);
    expect(getUnpublishedEntryLabel(entry)).toBe('hello');
  });
});

describe('getCompanionNotes()', () => {
  /**
   * Create an entry of the given collection.
   * @param {string} collectionName Collection name.
   * @param {string} slug Slug.
   * @param {string} title Title.
   * @param {boolean} [edited] Whether the entry is an existing one changed in the pull request.
   * @returns {any} Companion entry.
   */
  const createCompanion = (collectionName, slug, title, edited = false) => ({
    collectionName,
    entry: { slug, locales: { _default: { content: { title } } } },
    ...(edited ? { edited } : {}),
  });

  test('lists the new entries riding along in the pull request', () => {
    vi.mocked(getCollection).mockImplementation(
      (name) =>
        /** @type {any} */ ({
          sections: { _type: 'entry', label_singular: 'Section' },
          tiles: { _type: 'entry', label_singular: 'Tile' },
        })[name],
    );

    const entry = /** @type {any} */ ({
      workflow: {
        companions: [
          createCompanion('sections', 'guides', 'Guides'),
          createCompanion('tiles', 'help', 'Help'),
          // A collection removed from the configuration since leaves the slug to go by
          createCompanion('gone', 'faq', 'FAQ'),
        ],
      },
    });

    expect(getCompanionNotes(entry, 'en')).toEqual(['Also adds Section: Guides, Tile: Help, faq']);
    // Nothing is listed until the app locale is set
    expect(getCompanionNotes(entry, undefined)).toEqual([]);
  });

  test('lists the existing entries changed in the pull request apart from the new ones', () => {
    vi.mocked(getCollection).mockImplementation(
      (name) =>
        /** @type {any} */ ({
          sections: { _type: 'entry', label_singular: 'Section' },
          authors: { _type: 'entry', label_singular: 'Author' },
        })[name],
    );

    const entry = /** @type {any} */ ({
      workflow: {
        companions: [
          createCompanion('authors', 'ada', 'Ada', true),
          createCompanion('sections', 'guides', 'Guides'),
        ],
      },
    });

    expect(getCompanionNotes(entry, 'en')).toEqual([
      'Also adds Section: Guides',
      'Also changes Author: Ada',
    ]);

    entry.workflow.companions.pop();
    expect(getCompanionNotes(entry, 'en')).toEqual(['Also changes Author: Ada']);
  });

  test('returns nothing when there’s nothing riding along', () => {
    expect(getCompanionNotes(/** @type {any} */ ({ workflow: {} }), 'en')).toEqual([]);
    expect(getCompanionNotes(/** @type {any} */ ({ workflow: { companions: [] } }), 'en')).toEqual(
      [],
    );
  });
});
