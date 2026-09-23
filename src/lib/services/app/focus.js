/**
 * Remember the element that has the focus as an overlay opens, and return a function that gives it
 * the focus back once the overlay has closed. Without this, closing the entry editor or the asset
 * details drops the focus on `<body>`, and a keyboard or screen reader user has to work their way
 * back from the top of the document to the row they opened.
 * @returns {() => void} Function to call once the overlay is gone. It focuses the element that
 * opened the overlay if it’s still in the document — the row of an entry that has been deleted is
 * gone by then — and the page container otherwise, so the focus at least stays near the list.
 */
export const rememberFocus = () => {
  // `<body>` when nothing has the focus; never `null` in a rendered document
  const opener = /** @type {HTMLElement} */ (document.activeElement);

  return () => {
    if (opener.isConnected && opener !== document.body && !opener.closest('[inert]')) {
      opener.focus();

      return;
    }

    const container = document.querySelector('#page-container');

    if (container instanceof HTMLElement) {
      container.tabIndex = -1;
      container.focus();
    }
  };
};

/**
 * Keep the focus within a container whose content is about to be replaced, such as the pane of the
 * asset picker when a folder is opened. If the element that has the focus is removed along with
 * the old content, the focus would drop on `<body>`, and a keyboard or screen reader user would
 * have to work their way back from the top of the document. It goes to the first list box in the
 * container instead, which is the list of folders or files, or the container itself if there is
 * none yet, while the new content is still loading. The container is watched for a moment after
 * that, so the focus can move on to a list box that shows up in the meantime.
 * @param {HTMLElement} container Container that stays in the document.
 * @param {object} [options] Options.
 * @param {number} [options.timeout] How long to watch the container, in milliseconds.
 */
export const keepFocusIn = (container, { timeout = 2000 } = {}) => {
  const startTime = performance.now();

  /**
   * Check where the focus is, once the content has been updated.
   */
  const check = () => {
    const { activeElement } = document;

    // The focus has stayed within the new content, or the user has moved it elsewhere
    if (activeElement !== document.body && activeElement !== container) {
      return;
    }

    const listbox = container.querySelector('[role="listbox"]');

    if (listbox instanceof HTMLElement) {
      listbox.focus();

      return;
    }

    if (activeElement === document.body && container.isConnected) {
      container.tabIndex = -1;
      container.focus();
    }

    if (performance.now() - startTime < timeout) {
      window.requestAnimationFrame(check);
    }
  };

  window.requestAnimationFrame(check);
};
