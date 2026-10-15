// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  snapshotBulkEditGroups,
  updateBulkEditValue,
} from '$lib/services/contents/collection/entries/bulk-edit/session';

const { entryGroups, bulkEdits, bulkEditErrors, bulkEditedEntries } = vi.hoisted(() => ({
  entryGroups: { current: [] },
  bulkEdits: { current: {} },
  bulkEditErrors: { current: {} },
  bulkEditedEntries: { current: [] },
}));

vi.mock('$lib/services/contents/collection/view', () => ({
  entryGroups,
  bulkEdits,
  bulkEditErrors,
  bulkEditedEntries,
}));

vi.mock('$lib/services/contents/collection/entries/bulk-edit', () => ({
  isBulkEditableEntry: vi.fn((_collection, entry) => !entry.readonly),
  setBulkEditValue: vi.fn(({ keyPath, value }) => ({ e1: { [keyPath]: value } })),
  validateBulkEdits: vi.fn(() => ({ e1: { title: ['Invalid'] } })),
}));

describe('snapshotBulkEditGroups()', () => {
  test('keeps the editable entries and publishes them', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const locked = { id: 'c', readonly: true };

    entryGroups.current = [
      { name: '*', entries: [a, locked] },
      { name: 'x', entries: [locked] },
      { name: 'y', entries: [b] },
    ];

    expect(snapshotBulkEditGroups({})).toEqual([
      { name: '*', entries: [a] },
      { name: 'y', entries: [b] },
    ]);

    expect(bulkEditedEntries.current).toEqual([a, b]);
  });
});

describe('updateBulkEditValue()', () => {
  beforeEach(() => {
    bulkEdits.current = {};
    bulkEditErrors.current = {};
    bulkEditedEntries.current = [{ id: 'e1' }];
  });

  test('records the value without validating when there are no errors', () => {
    updateBulkEditValue({ collection: {}, entry: { id: 'e1' }, keyPath: 'title', value: 'A' });

    expect(bulkEdits.current).toEqual({ e1: { title: 'A' } });
    expect(bulkEditErrors.current).toEqual({});
  });

  test('validates the edits again when errors are shown', () => {
    bulkEditErrors.current = { e1: { title: ['Required'] } };
    updateBulkEditValue({ collection: {}, entry: { id: 'e1' }, keyPath: 'title', value: 'A' });

    expect(bulkEditErrors.current).toEqual({ e1: { title: ['Invalid'] } });
  });
});
