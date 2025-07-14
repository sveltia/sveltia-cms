/**
 * Format the given duration in the `hh:mm:ss` format. Note that it assumes the duration is less
 * than 24 hours.
 * @param {number} duration Duration in seconds.
 * @returns {string} Formatted duration.
 */
export const formatDuration = (duration) => new Date(duration * 1000).toISOString().substr(11, 8);
