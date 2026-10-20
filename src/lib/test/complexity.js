import { expect } from 'vitest';

/**
 * How many times larger than the base input the larger inputs are. The input is doubled in steps
 * rather than enlarged at once, so a pattern that takes exponential time fails on a small input
 * instead of running for hours on the largest.
 */
const SCALES = [2, 4, 8];
/**
 * How many times the time may grow faster than the input before it’s taken for backtracking: a
 * linear function stays well within it, even on a busy machine, while a quadratic one grows by the
 * square of the scale, which exceeds it from 4 on.
 */
const TOLERANCE = 3;
/**
 * How many times each input is measured. The median of the measurements is compared, so a stray
 * garbage collection or a move to a slower core in a few of them doesn’t count.
 */
const RUNS = 5;
/**
 * The least CPU time, in microseconds, that a measurement of the base input should take. A shorter
 * one is repeated until it does, as the clock is too coarse for a single short run.
 */
const MIN_DURATION = 1000;
/**
 * The most times a measurement repeats its function.
 */
const MAX_REPEATS = 1000;

/**
 * Get the CPU time the current thread has used. Unlike the wall-clock time, it doesn’t advance
 * while the thread waits for a core, so a busy machine doesn’t inflate it.
 * @returns {number} Microseconds.
 */
const getCpuTime = () => {
  const { user, system } = process.threadCpuUsage();

  return user + system;
};

/**
 * Measure the CPU time a function takes on an input.
 * @template T
 * @param {(input: T) => any} run Function to measure.
 * @param {T} input Input to pass to it.
 * @param {number} repeats How many times to call it.
 * @returns {number} Microseconds.
 */
const measure = (run, input, repeats) => {
  const start = getCpuTime();

  for (let i = 0; i < repeats; i += 1) {
    run(input);
  }

  return getCpuTime() - start;
};

/**
 * Get the median of numbers.
 * @param {number[]} values Numbers.
 * @returns {number} Median.
 */
const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Assert that a function takes time linear in the size of its input, to catch catastrophic
 * backtracking in a regular expression (ReDoS). The function runs on an input of the given size and
 * on ones {@link SCALES} times larger, and the CPU time it takes on each may grow by up to
 * {@link TOLERANCE} times the scale. Comparing the times rather than holding them to a fixed limit
 * keeps the test from failing on a slow or busy machine, and each larger input is measured in turn
 * with the base one, so a change in the machine’s speed affects both alike.
 * @template T
 * @param {(size: number) => T} build Function that builds an input of the given size.
 * @param {(input: T) => any} run Function to measure.
 * @param {number} size Size of the base input. A quadratic function should take at least a few
 * milliseconds on the largest one, so the growth stands out from the fixed cost of a call.
 */
export const expectLinearTime = (build, run, size) => {
  const base = build(size);

  // Warm up, so no measurement includes compiling the function or the pattern
  measure(run, base, 1);

  const once = Math.max(measure(run, base, 1), 1);
  const repeats = Math.min(Math.ceil(MIN_DURATION / once), MAX_REPEATS);

  SCALES.forEach((scale) => {
    const input = build(size * scale);
    const limit = scale * TOLERANCE;
    const growths = [];

    for (let i = 0; i < RUNS; i += 1) {
      const baseDuration = Math.max(measure(run, base, repeats), 1);

      growths.push(measure(run, input, repeats) / baseDuration);

      // Stop at once when the time is far over the limit, instead of spending minutes on the rest
      if (growths[i] > limit * 4) {
        break;
      }
    }

    // The last measurement alone if it stopped the loop, as the median could hide it
    const growth = growths.length < RUNS ? /** @type {number} */ (growths.at(-1)) : median(growths);

    expect(growth, `Time grew ${growth.toFixed(1)}× for ${scale}× the input`).toBeLessThan(limit);
  });
};

/**
 * Count the matches of a global regular expression in a string without keeping them. Holding on to
 * thousands of match arrays makes the garbage collector’s work grow faster than the input, which
 * {@link expectLinearTime} would take for backtracking.
 * @param {string} string String to search.
 * @param {RegExp} regex Regular expression with the `g` flag.
 * @returns {number} Number of matches.
 */
export const countMatches = (string, regex) =>
  string.matchAll(regex).reduce((count) => count + 1, 0);
