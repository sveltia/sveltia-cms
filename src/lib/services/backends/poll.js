import { checkForRemoteChanges, MIN_CHECK_GAP } from '$lib/services/backends/refresh';

/**
 * How often to ask the backend whether the configured branch has moved, in milliseconds. One small
 * request per check keeps the cost negligible against any service’s rate limit, while a minute is
 * soon enough to notice a colleague’s change before much is built on stale data.
 */
export const REMOTE_CHECK_INTERVAL = 60 * 1000;

/** Handle of the scheduled check, or `0` while nothing is scheduled. */
let timer = 0;
/** When the polling was started, as a Unix timestamp in milliseconds. */
let startTime = 0;
/**
 * Whether the tab is showing. Nobody is looking at a hidden tab, so a change found there would only
 * be a wasted request, and the tab is checked as soon as it’s shown again.
 * @returns {boolean} Result.
 */
const isVisible = () => document.visibilityState === 'visible';

/**
 * Check the repository, reporting a failure rather than letting it escape the timer.
 * @param {number} [maxAge] Skip the check if one was started within this many milliseconds.
 */
const check = async (maxAge = 0) => {
  try {
    await checkForRemoteChanges({ maxAge });
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to check the repository for changes.', ex);
  }
};

/**
 * Check the repository on schedule, unless the tab is hidden.
 */
const checkOnSchedule = () => {
  if (isVisible()) {
    check();
  }
};

/**
 * Check the repository as the user comes back to the tab, unless a check was made only moments ago,
 * or the polling has only just started — the data was fresh then. The last check may have been
 * made by a save or an entry being opened rather than by this loop, which counts just as well.
 */
const checkOnReturn = () => {
  if (isVisible() && Date.now() - startTime >= MIN_CHECK_GAP) {
    check(MIN_CHECK_GAP);
  }
};

/**
 * Start checking the repository for someone else’s commits, on schedule and whenever the user
 * comes back to the tab. Called once the site data has been loaded, which is when the data is
 * fresh, so the first check is a full interval away. Starting again is a no-op.
 */
export const startRemoteChangePolling = () => {
  if (timer) {
    return;
  }

  startTime = Date.now();
  timer = window.setInterval(checkOnSchedule, REMOTE_CHECK_INTERVAL);
  document.addEventListener('visibilitychange', checkOnReturn);
  window.addEventListener('focus', checkOnReturn);
};

/**
 * Stop the checks. Called when the user signs out.
 */
export const stopRemoteChangePolling = () => {
  if (!timer) {
    return;
  }

  window.clearInterval(timer);
  document.removeEventListener('visibilitychange', checkOnReturn);
  window.removeEventListener('focus', checkOnReturn);
  timer = 0;
};
