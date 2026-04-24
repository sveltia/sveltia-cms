/**
 * Open a URL in a new tab/window without giving the destination access to `window.opener`.
 * @param {string | undefined | null} url URL to open.
 * @returns {Window | null} Opened window, if available.
 */
export const openNewTab = (url) => (url ? window.open(url, '_blank', 'noopener,noreferrer') : null);
