/**
 * How long to wait between re-checks while a build is pending, in milliseconds. The interval is
 * fixed rather than widening: a build finishing is what the editor is waiting on, so noticing it
 * late is worse than the cost of asking, and one request per check keeps that cost small.
 */
export const POLL_INTERVAL = 5000;

/**
 * How long to keep re-checking a pending build before giving up, in milliseconds. Once it elapses,
 * the UI offers a manual re-check instead, so a stuck or very long build doesn’t poll forever.
 */
export const POLL_MAX_DURATION = 10 * 60 * 1000;

/**
 * How long a resolved deployment stays fresh, in milliseconds. Reopening a view within this window
 * reuses the cached result instead of querying the backend again.
 */
export const DEPLOY_TTL = 30000;

/** How long a page liveness result is cached per URL, in milliseconds. */
export const PING_TTL = 30000;
