/**
 * A step that changes something outside the CMS, such as a file on a cloud storage service, along
 * with the way to undo it.
 * @template T
 * @typedef {object} ReversibleStep
 * @property {() => Promise<T>} run Function making the change and returning its result.
 * @property {(result: T) => Promise<unknown>} undo Function undoing the change, given its result.
 */

/**
 * Run the given steps one at a time, then finish with the results, e.g. by saving the entries that
 * point at the files the steps have uploaded or moved. If a step or the finish fails, the steps
 * run so far are undone, in the order they were run, and the error is thrown again. A step that
 * can’t be undone is left as it is, and the error is logged, so the other steps are still undone.
 * @template T
 * @param {ReversibleStep<T>[]} steps Steps.
 * @param {(results: T[]) => Promise<unknown>} finish Function called with the results of every
 * step, in the same order.
 * @returns {Promise<T[]>} Results.
 * @throws {Error} When a step or the finish fails.
 */
export const runWithUndo = async (steps, finish) => {
  /** @type {T[]} */
  const results = [];

  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const { run } of steps) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await run());
    }

    await finish(results);
  } catch (ex) {
    // eslint-disable-next-line no-restricted-syntax
    for (const [index, result] of results.entries()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await steps[index].undo(result);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    throw ex;
  }

  return results;
};
