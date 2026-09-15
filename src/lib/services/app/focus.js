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
