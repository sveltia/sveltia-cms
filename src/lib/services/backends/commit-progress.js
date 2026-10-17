import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * Progress of a save that takes long enough to be worth reporting: an entry with many new files.
 * @typedef {object} SaveProgress
 * @property {'preparing' | 'committing'} phase What the save is doing. `preparing` is reading and
 * hashing the files to be saved; `committing` is sending them to the repository.
 * @property {number} done Number of files prepared, or commits made.
 * @property {number} total Number of files to prepare, or the estimated number of commits.
 * @property {boolean} approximate Whether `total` is an estimate: the size of each commit follows
 * the upload speed, so the number of commits is only known roughly.
 */

/**
 * A save with fewer files, or commits, than this isn’t worth reporting, as it ends in a moment.
 */
const MIN_REPORTED_TOTAL = 2;

/**
 * Progress of the save in flight. It’s `undefined` while nothing is worth reporting.
 * @type {{ current: SaveProgress | undefined }}
 */
export const saveProgress = createRawState();

/**
 * Report that the files of a save are being prepared.
 * @param {number} total Number of files to prepare.
 */
export const startPreparing = (total) => {
  saveProgress.current =
    total >= MIN_REPORTED_TOTAL
      ? { phase: 'preparing', done: 0, total, approximate: false }
      : undefined;
};

/**
 * Report that a file has been prepared. A file saved for several fields is only counted once, so
 * the count never goes past the total.
 */
export const advancePreparing = () => {
  const progress = saveProgress.current;

  if (progress?.phase === 'preparing') {
    saveProgress.current = { ...progress, done: Math.min(progress.done + 1, progress.total) };
  }
};

/**
 * Report the commits made so far, and how many there are likely to be in all.
 * @param {number} done Number of commits made.
 * @param {number} estimatedTotal Estimated number of commits in all. Raised to `done` if lower.
 */
export const reportCommits = (done, estimatedTotal) => {
  const total = Math.max(done, estimatedTotal);

  saveProgress.current =
    total >= MIN_REPORTED_TOTAL
      ? { phase: 'committing', done, total, approximate: true }
      : undefined;
};

/**
 * Clear the progress, once the save has ended.
 */
export const clearSaveProgress = () => {
  saveProgress.current = undefined;
};
