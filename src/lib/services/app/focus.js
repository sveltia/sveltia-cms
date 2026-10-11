import { tick } from 'svelte';

/**
 * Move the focus to the page container, which is made focusable first.
 */
const focusPageContainer = () => {
  const container = document.querySelector('#page-container');

  if (container instanceof HTMLElement) {
    container.tabIndex = -1;
    container.focus();
  }
};

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

    focusPageContainer();
  };
};

/**
 * Move the focus to the entry or asset list on the page. A control acting on the selected items,
 * like the Delete button, is disabled once they are gone, which drops its focus on `<body>`, so a
 * keyboard or screen reader user would have to work their way back from the top of the document.
 * The row of the list that is in the tab order takes the focus, or the page container if the list
 * is empty. The list may still be updated after that, e.g. the row of a deleted entry removed, so
 * the page is watched for a moment to move the focus on to a row again if it has been dropped on
 * `<body>`, or if a row shows up while the page container has it.
 * @param {object} [options] Options.
 * @param {number} [options.timeout] How long to watch the page, in milliseconds.
 */
export const focusList = ({ timeout = 2000 } = {}) => {
  const container = document.querySelector('#page-container');

  if (!(container instanceof HTMLElement)) {
    return;
  }

  const startTime = performance.now();

  /**
   * Focus the row in the tab order, or the page container if there is none.
   */
  const focus = () => {
    const row = container.querySelector('[role="grid"] [tabindex="0"]');

    if (row instanceof HTMLElement) {
      row.focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }
  };

  /**
   * Check where the focus is, once the list has been updated.
   */
  const check = () => {
    const { activeElement } = document;

    if (activeElement === document.body || activeElement === container) {
      focus();
    } else if (!container.contains(activeElement)) {
      // The user has moved the focus elsewhere
      return;
    }

    if (performance.now() - startTime < timeout) {
      window.requestAnimationFrame(check);
    }
  };

  focus();
  window.requestAnimationFrame(check);
};

/**
 * Move the focus to an overlay once it has been opened, so a keyboard or screen reader user can
 * start working with its content right away. The overlay wrapper is made focusable first.
 * @param {() => HTMLElement | null | undefined} getWrapper Function returning the overlay wrapper.
 * It’s called after the next tick, because the element may be unmounted in the meantime, e.g. if
 * the overlay has been closed.
 */
export const focusOverlay = async (getWrapper) => {
  // Wait until `inert` is updated
  await tick();

  const wrapper = getWrapper();

  if (wrapper) {
    wrapper.tabIndex = 0;
    wrapper.focus();
  }
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
