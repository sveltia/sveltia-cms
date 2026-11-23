/**
 * Format the given duration in the `hh:mm:ss` format. Note that it assumes the duration is less
 * than 24 hours.
 * @param {number} duration Duration in seconds.
 * @returns {string} Formatted duration, or `–` if the duration is not a finite number. A media
 * element reports `Infinity` for a stream or a WebM file recorded with `MediaRecorder`, which has
 * no duration in its header, and a `Date` can’t hold that.
 */
export const formatDuration = (duration) =>
  Number.isFinite(duration) ? new Date(duration * 1000).toISOString().substr(11, 8) : '–';
