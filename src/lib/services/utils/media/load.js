/**
 * Wait for a media element to load its source, or to fail to. An element is guaranteed to fire
 * either the given event or `error`, so the promise never stays pending once a source is set.
 * @param {HTMLImageElement | HTMLMediaElement} element Image, video or audio element.
 * @param {string} eventType Event that indicates the media is loaded, e.g. `load` for an image or
 * `loadedmetadata` for a video.
 * @returns {Promise<boolean>} Whether the media has been loaded, `false` if it has failed to.
 */
export const waitForMediaLoad = (element, eventType) =>
  new Promise((resolve) => {
    element.addEventListener(eventType, () => resolve(true), { once: true });
    element.addEventListener('error', () => resolve(false), { once: true });
  });
