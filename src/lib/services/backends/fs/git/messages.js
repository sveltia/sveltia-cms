import { _ } from '@sveltia/i18n';

/**
 * @import { LocalGitNotice, LocalGitStatus } from '$lib/types/private';
 */

/**
 * Get the localized explanation of why changes can’t be committed to the local Git repository.
 * @param {LocalGitNotice} notice Reason, and its details if any: the operation for
 * `operation_in_progress`, the file path for `lfs`, and the error message for `error`.
 * @returns {string} Explanation.
 */
export const getLocalGitReasonLabel = ({ reason, detail = '' }) =>
  reason === 'operation_in_progress'
    ? _(`local_git_skip_reasons.operation_in_progress.${detail}`)
    : _(`local_git_skip_reasons.${reason}`, { values: { path: detail, message: detail } });

/**
 * Get the localized summary of whether changes can be committed to the local Git repository, for
 * the Settings.
 * @param {LocalGitStatus} status Status.
 * @returns {string} Summary.
 */
export const getLocalGitStatusLabel = ({ ready, reason, detail, branch, author }) => {
  if (!ready) {
    return _('prefs.developer.local_git.not_ready', {
      values: {
        reason: getLocalGitReasonLabel(/** @type {LocalGitNotice} */ ({ reason, detail })),
      },
    });
  }

  // The branch and author are always known once the changes can be committed
  const { name, email } = /** @type {NonNullable<LocalGitStatus['author']>} */ (author);

  return _('prefs.developer.local_git.ready', {
    values: { branch: /** @type {string} */ (branch).replace(/^refs\/heads\//, ''), name, email },
  });
};
