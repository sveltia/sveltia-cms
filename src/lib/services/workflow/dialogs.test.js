import { describe, expect, test, vi } from 'vitest';

import { getDiscardDialogStrings, getPublishDialogStrings } from '$lib/services/workflow/dialogs';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => (values ? `${key}:${values.count}` : key)),
}));

describe('getDiscardDialogStrings', () => {
  test('cancels a pending removal', () => {
    expect(
      getDiscardDialogStrings({ pendingDeletion: true, publishedVersionExists: true }),
    ).toEqual({
      label: 'workflow.cancel_deletion',
      title: 'workflow.cancel_deletion',
      message: 'workflow.confirm_cancelling_deletion',
    });
  });

  test('discards the changes to a published entry', () => {
    expect(
      getDiscardDialogStrings({ pendingDeletion: false, publishedVersionExists: true }),
    ).toEqual({
      label: 'discard',
      title: 'workflow.discard_changes',
      message: 'workflow.confirm_discarding_entry_changes',
    });
  });

  test('deletes an entry that was never published', () => {
    expect(
      getDiscardDialogStrings({ pendingDeletion: false, publishedVersionExists: false }),
    ).toEqual({
      label: 'delete',
      title: 'delete_entries:1',
      message: 'workflow.confirm_deleting_unpublished_entry',
    });
  });
});

describe('getPublishDialogStrings', () => {
  test('publishes an entry', () => {
    expect(getPublishDialogStrings({ deletion: false })).toEqual({
      label: 'publish',
      title: 'workflow.publish_entry',
      message: 'workflow.confirm_publishing_entry',
    });
  });

  test('presents publishing a removal as a deletion', () => {
    expect(getPublishDialogStrings({ deletion: true })).toEqual({
      label: 'delete',
      title: 'delete_entries:1',
      message: 'workflow.confirm_completing_deletion',
    });
  });
});
