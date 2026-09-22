import { _ } from '@sveltia/i18n';

/**
 * Strings of a confirmation dialog, and of the control that opens it.
 * @typedef {object} WorkflowDialogStrings
 * @property {string} label Short label of the control and the dialog’s OK button, e.g. `Discard`.
 * @property {string} title Dialog title, which is also the control’s accessible name because the
 * short label alone doesn’t say what it acts on.
 * @property {string} message Confirmation message.
 */

/**
 * Get the strings of the dialog that throws an unpublished entry away. What that means depends on
 * the entry: a pending removal is cancelled, the changes to an entry that is already published are
 * discarded, and an entry that only exists in the pull request is deleted outright.
 * @param {object} args Arguments.
 * @param {boolean} args.pendingDeletion Whether the entry is a pending removal.
 * @param {boolean} args.publishedVersionExists Whether the entry has a published version.
 * @returns {WorkflowDialogStrings} Strings.
 */
export const getDiscardDialogStrings = ({ pendingDeletion, publishedVersionExists }) => {
  if (pendingDeletion) {
    return {
      label: _('workflow.cancel_deletion'),
      title: _('workflow.cancel_deletion'),
      message: _('workflow.confirm_cancelling_deletion'),
    };
  }

  if (publishedVersionExists) {
    return {
      label: _('discard'),
      title: _('workflow.discard_changes'),
      message: _('workflow.confirm_discarding_entry_changes'),
    };
  }

  return {
    label: _('delete'),
    title: _('delete_entries', { values: { count: 1 } }),
    message: _('workflow.confirm_deleting_unpublished_entry'),
  };
};

/**
 * Get the strings of the dialog that publishes an unpublished entry. Publishing a pending removal
 * is what deletes the entry, so it’s presented as a deletion.
 * @param {object} args Arguments.
 * @param {boolean} args.deletion Whether the entry is a pending removal.
 * @returns {WorkflowDialogStrings} Strings.
 */
export const getPublishDialogStrings = ({ deletion }) =>
  deletion
    ? {
        label: _('delete'),
        title: _('delete_entries', { values: { count: 1 } }),
        message: _('workflow.confirm_completing_deletion'),
      }
    : {
        label: _('publish'),
        title: _('workflow.publish_entry'),
        message: _('workflow.confirm_publishing_entry'),
      };
