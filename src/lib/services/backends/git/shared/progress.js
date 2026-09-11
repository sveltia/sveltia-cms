import { dataLoadedProgress } from '$lib/services/contents';

/**
 * How often the simulated progress advances, in milliseconds. Each tick writes to a reactive state
 * that re-renders the progress bar, so this is kept at a rate the eye can follow rather than one
 * derived from the file count, which used to fire every few milliseconds for a small repository.
 */
export const PROGRESS_TICK_INTERVAL = 100;

/**
 * Time the simulated progress budgets for each file, in milliseconds. The bar reaches
 * {@link PROGRESS_CEILING} once this much time has passed per file, then holds there until the
 * fetch actually finishes.
 */
export const PROGRESS_TIME_PER_FILE = 10;

/**
 * Highest value the simulated progress reaches on its own. The bar only shows completion once the
 * files have really arrived.
 */
export const PROGRESS_CEILING = 99;

/**
 * Show a simulated progress bar while a batch request that reports no progress of its own is in
 * flight. The bar advances at a steady rate proportional to the number of files, and stops short
 * of the end until {@link stop} is called.
 * @param {number} fileCount Number of files being fetched.
 * @returns {() => void} Function that stops the simulation and hides the progress bar.
 */
export const startSimulatedProgress = (fileCount) => {
  // Advance by however much of the budget passes in one tick, but always by something
  const step = Math.max(
    (PROGRESS_TICK_INTERVAL / (Math.max(fileCount, 1) * PROGRESS_TIME_PER_FILE)) * 100,
    0.1,
  );

  let progress = 0;

  dataLoadedProgress.current = progress;

  const interval = window.setInterval(() => {
    progress = Math.min(progress + step, PROGRESS_CEILING);
    dataLoadedProgress.current = progress;
  }, PROGRESS_TICK_INTERVAL);

  return () => {
    window.clearInterval(interval);
    dataLoadedProgress.current = undefined;
  };
};
