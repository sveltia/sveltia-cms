/**
 * Open a URL in a new tab/window.
 * @param {string | undefined | null} url URL to open.
 * @param {object} [options] Options.
 * @param {boolean} [options.noopener] Whether to prevent the destination from accessing
 * `window.opener`. Defaults to `true`. Set to `false` for OAuth flows that require `postMessage`
 * communication.
 * @returns {Window | null} Opened window, if available.
 */
export const openNewTab = (url, { noopener = true } = {}) => {
  if (!url) {
    return null;
  }

  const features = noopener ? 'noopener,noreferrer' : '';

  return window.open(url, '_blank', features);
};
