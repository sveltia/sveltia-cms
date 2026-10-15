import { describe, expect, test } from 'vitest';

import {
  COLUMN_LABELS,
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
