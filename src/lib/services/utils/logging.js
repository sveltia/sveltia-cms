/**
 * @typedef {(message: string, ...details: any[]) => void} DebugLogger Function that logs one step
 * of a process to the browser console, with any extra details appended as they are.
 */

/**
 * Create a logger that traces a long-running process, such as the initial site data loading, in
 * the browser console. Every message goes out at the `debug` level, which the console hides until
 * it’s set to show verbose output, so the trace costs nothing unless someone is looking for it —
 * typically a user asked to report where a slow start spends its time. Each message is prefixed
 * with the scope and suffixed with the time since the previous message and since the logger was
 * created, so the slow step stands out without a stopwatch.
 * @param {string} scope Label for the process, prefixed to every message.
 * @returns {DebugLogger} Logger.
 */
export const createDebugLogger = (scope) => {
  const startTime = performance.now();
  let lastTime = startTime;

  return (message, ...details) => {
    const now = performance.now();
    const step = Math.round(now - lastTime);
    const total = Math.round(now - startTime);

    lastTime = now;

    // eslint-disable-next-line no-console
    console.debug(`[${scope}] ${message} (+${step} ms, ${total} ms total)`, ...details);
  };
};
