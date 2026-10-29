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
 * How many times each input is measured, taking turns with the base input. The shortest of the
 * measurements is compared: a busy machine, a garbage collection or a move to a slower core can
 * only make a measurement longer, so the shortest one is the closest to what the function costs.
 * The measurements are short, so it takes little time to make enough of them for one to be spared.
 */
const RUNS = 9;
/**
 * The least time, in microseconds, that a measurement of the base input should take. A function is
 * repeated until it does, so the cost of reading the clock and calling the function is negligible.
 */
const MIN_DURATION = 1000;
/**
 * The most times a measurement repeats its function.
 */
const MAX_REPEATS = 1_000_000;
/**
 * The time, in microseconds, after which a measurement of a larger input stops the runs for its
 * scale, instead of spending minutes on a function that has clearly failed. The measurements taken
 * so far are compared as usual.
 */
const GIVE_UP_DURATION = 250_000;
/**
 * Get the time from a high-resolution clock. The CPU time of the thread would leave out the time
 * spent waiting for a core, but Linux only updates it at each scheduler tick, every few
 * milliseconds, so a short measurement reads as nothing or as a whole tick. Taking the shortest of
 * several measurements leaves out the waiting time instead.
 * @returns {number} Microseconds.
 */
const getTime = () => Number(process.hrtime.bigint()) / 1000;

/**
 * Measure the time a function takes on an input.
 * @template T
 * @param {(input: T) => any} run Function to measure.
 * @param {T} input Input to pass to it.
 * @param {number} repeats How many times to call it.
 * @returns {number} Microseconds.
 */
const measure = (run, input, repeats) => {
  const start = getTime();

  for (let i = 0; i < repeats; i += 1) {
    run(input);
  }

  return getTime() - start;
};

/**
 * Find how many times a function has to be repeated on an input for a measurement to take at least
 * {@link MIN_DURATION}, by measuring it with more repeats until it does.
 * @template T
 * @param {(input: T) => any} run Function to measure.
 * @param {T} input Input to pass to it.
 * @returns {number} Number of repeats.
 */
const getRepeats = (run, input) => {
  let repeats = 1;
  let duration = measure(run, input, repeats);

  while (duration < MIN_DURATION && repeats < MAX_REPEATS) {
    // Aim a little past the target, but grow by at most ten times at once in case the measurement
    // was too short to tell
    repeats = Math.min(
      Math.ceil(repeats * Math.min((MIN_DURATION * 1.2) / Math.max(duration, 1), 10)),
      MAX_REPEATS,
    );
    duration = measure(run, input, repeats);
  }

  return repeats;
};

/**
 * Assert that a function takes time linear in the size of its input, to catch catastrophic
 * backtracking in a regular expression (ReDoS). The function runs on an input of the given size and
 * on ones {@link SCALES} times larger, and the time it takes on each may grow by up to
 * {@link TOLERANCE} times the scale. Comparing the times rather than holding them to a fixed limit
 * keeps the test from failing on a slow or busy machine, and each larger input is measured in turn
 * with the base one, so a change in the machine’s speed affects both alike. A larger input is
 * repeated fewer times, so its measurements take as long as those of the base input: a longer
 * measurement would be more likely to be interrupted, which would make the time look like it grows
 * faster on a busy machine.
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

  const repeats = getRepeats(run, base);

  SCALES.forEach((scale) => {
    const input = build(size * scale);
    const limit = scale * TOLERANCE;
    const inputRepeats = Math.max(Math.round(repeats / scale), 1);
    let baseDuration = Infinity;
    let inputDuration = Infinity;

    for (let i = 0; i < RUNS; i += 1) {
      baseDuration = Math.min(baseDuration, measure(run, base, repeats));

      const duration = measure(run, input, inputRepeats);

      inputDuration = Math.min(inputDuration, duration);

      if (duration > GIVE_UP_DURATION) {
        break;
      }
    }

    // Compare the time a call takes
    const growth = inputDuration / inputRepeats / (Math.max(baseDuration, 1) / repeats);

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
