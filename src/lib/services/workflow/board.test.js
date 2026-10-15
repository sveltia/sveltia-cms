import { describe, expect, test } from 'vitest';

import {
  COLUMN_LABELS,
  getBoardAnnouncement,
  getDiscardMessages,
  getPublishMessages,
  groupEntriesByStatus,
  STATUS_UPDATE_MESSAGES,
} from '$lib/services/workflow/board';

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
