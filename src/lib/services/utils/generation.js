/**
 * Create a generation counter, which tells whether something has been reset since a request
 * started, e.g. a user who has signed out while it was on its way, so its response is dropped
 * rather than brought back for whoever comes next.
 * @returns {{ capture: () => () => boolean, bump: () => void }} Counter.
 */
export const createGeneration = () => {
  let generation = 0;

  return {
    /**
     * Take the current generation.
     * @returns {() => boolean} Function that tells whether it’s still current.
     */
    capture: () => {
      const captured = generation;

      return () => captured === generation;
    },
    /**
     * Start a new generation, so those taken before are no longer current.
     */
    bump: () => {
      generation += 1;
    },
  };
};
