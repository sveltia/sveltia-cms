import {
  findLazyFieldElement,
  getFieldAlignedScrollTop,
  getProportionalScrollTop,
  getRevealingScrollTop,
} from '$lib/services/contents/editor/scroll';
import { createLatestGuard } from '$lib/services/utils/scheduling';

/**
 * @import { EntryEditorPane } from '$lib/types/private';
 */

/**
 * Content area the user is scrolling, with the mouse wheel or a touch. Only its scroll events are
 * synced to the other pane: the other pane’s own scroll events come from being synced, and syncing
 * them back would make the panes chase each other. It’s shared by the two panes.
 * @type {HTMLElement | undefined}
 */
let scrollSource;
/**
 * Guard to leave the other pane alone once another field has been focused or either pane has been
 * scrolled by the user.
 */
const revealGuard = createLatestGuard();
/** @type {AddEventListenerOptions} */
const eventOptions = { capture: true, passive: true };
/**
 * Options for the scroll listener, which isn’t capturing: scroll events don’t bubble, and capturing
 * would also get those of a field scrolled within the pane, e.g. a text area.
 * @type {AddEventListenerOptions}
 */
const scrollEventOptions = { passive: true };

/**
 * Get the top of a pane’s visible area, in the viewport of the pane’s document.
 * @param {HTMLElement} pane Pane’s content area, or the preview iframe’s root element.
 * @returns {number} Top in pixels.
 */
const getViewTop = (pane) =>
  // The preview iframe’s root element is its viewport, while the content area of the main document
  // is an element in it
  pane === pane.ownerDocument.documentElement ? 0 : pane.getBoundingClientRect().top;

/**
 * Get the top of an element in a pane’s scrollable content: the pane’s scroll position that would
 * bring the element to the top of the pane. The element’s `offsetTop` can’t tell, as it’s
 * relative to its offset parent, which is seldom the pane: the default preview’s root element, the
 * area wrapping the edit pane’s fields, or the preview iframe’s `<body>`.
 * @param {HTMLElement} pane Pane’s content area, or the preview iframe’s root element.
 * @param {HTMLElement} element Element in the pane.
 * @returns {number} Top in pixels.
 */
export const getContentTop = (pane, element) =>
  element.getBoundingClientRect().top - getViewTop(pane) + pane.scrollTop;

/**
 * Get the scroll position of the other pane that reveals the given element in it.
 * @param {HTMLElement} pane The other pane’s content area.
 * @param {HTMLElement} element Element in the pane.
 * @param {boolean} [always] Whether to get the position even if the element is already visible.
 * @returns {number | undefined} Scroll position, or `undefined` if the element is already visible.
 */
export const getThatScrollTop = (pane, element, always = false) => {
  const { top, height } = element.getBoundingClientRect();
  const { scrollTop, clientHeight } = pane;

  return getRevealingScrollTop({
    viewTop: getViewTop(pane),
    viewHeight: clientHeight,
    scrollTop,
    top,
    height,
    always,
  });
};

/**
 * @typedef {object} ScrollSyncPane
 * @property {boolean | undefined} syncScrolling Whether Sync Scrolling is turned on.
 * @property {EntryEditorPane['mode'] | undefined} mode Mode of this pane.
 * @property {HTMLElement | undefined} contentArea Main content area of this pane.
 * @property {HTMLElement | undefined} thisPaneContentArea Element of this pane that is scrolled:
 * the main content area, or the preview iframe’s root element. It’s set by the controller.
 * @property {HTMLElement | undefined} thatPaneContentArea Another pane’s content area.
 */

/**
 * Create a controller that keeps the scroll position of an edit/preview pane in sync with the other
 * pane.
 * @param {ScrollSyncPane} props Properties of the pane, which should be getters (and a setter for
 * `thisPaneContentArea`) so that the controller always sees the latest values of the component.
 * @returns {{
 * initialize: () => void,
 * setPreviewFrame: (iframe: HTMLIFrameElement) => void,
 * onFocusIn: (event: FocusEvent) => void,
 * destroy: () => void,
 * }} Controller.
 */
export const createScrollSync = (props) => {
  /**
   * Element receiving the scroll events of this pane’s content area: the area itself, or the
   * preview iframe’s document, whose root element doesn’t get the events of its own scrolling.
   * @type {HTMLElement | Document | undefined}
   */
  let scrollEventTarget;
  /**
   * Preview iframe, which is used in the preview mode only when a custom preview stylesheet or
   * template applies to the entry. It’s set once the frame has loaded its content, which may take a
   * while: the preview is rendered lazily once it’s visible, and a template waits for Immutable.js
   * to be loaded.
   * @type {HTMLIFrameElement | undefined}
   */
  let previewFrame;

  /**
   * Sync the scroll position with the other edit/preview pane.
   */
  const syncScrollPosition = () => {
    window.requestAnimationFrame(() => {
      const { contentArea } = props;
      const { thisPaneContentArea } = props;
      const { thatPaneContentArea } = props;

      if (!props.syncScrolling || !contentArea || !thisPaneContentArea || !thatPaneContentArea) {
        return;
      }

      const isIframe = thisPaneContentArea !== contentArea;
      const { x, y } = isIframe ? { x: 0, y: 0 } : thisPaneContentArea.getBoundingClientRect();
      const { ownerDocument, scrollTop, scrollHeight, clientHeight } = thisPaneContentArea;

      // At the top of this pane, the other one goes to its top as well, rather than bringing the
      // field there to its top edge, which would scroll the padding and anything else above the
      // field out of view
      if (scrollTop <= 0) {
        thatPaneContentArea.scrollTop = 0;

        return;
      }

      // Find the field section in the top left corner of the content area. Use `findLast` to
      // capture the topmost element; otherwise the List field sticky headers will interfere with
      // the positioning.
      // @see https://github.com/sveltia/sveltia-cms/issues/883
      const thisElement = /** @type {HTMLElement | undefined} */ (
        ownerDocument.elementsFromPoint(x + 80, y).findLast((e) => e.matches('[data-key-path]'))
      );

      if (!thisElement) {
        // Calculate the scroll position based on the current scroll position of the this pane
        thatPaneContentArea.scrollTop = getProportionalScrollTop({
          scrollTop,
          scrollHeight,
          clientHeight,
          targetScrollHeight: thatPaneContentArea.scrollHeight,
          targetClientHeight: thatPaneContentArea.clientHeight,
        });

        return;
      }

      // The element was found by that very attribute, so the key path is there
      const { keyPath } = /** @type {{ keyPath: string }} */ (thisElement.dataset);
      const { top, height } = thisElement.getBoundingClientRect();

      const thatElement = /** @type {HTMLElement | undefined} */ (
        thatPaneContentArea.querySelector(`[data-key-path="${CSS.escape(keyPath)}"]`)
      );

      // Scroll the other pane to the corresponding element, adjusting for the current scroll
      // position and the ratio of the scroll position within the element.
      const thatScrollTop = thatElement
        ? getFieldAlignedScrollTop({
            y,
            top,
            height,
            targetTop: getContentTop(thatPaneContentArea, thatElement),
            targetHeight: thatElement.getBoundingClientRect().height,
          })
        : undefined;

      if (thatScrollTop !== undefined) {
        thatPaneContentArea.scrollTop = thatScrollTop;
      }
    });
  };

  /**
   * Mark this pane as the one the user is scrolling. The wheel and touch events come before the
   * pane is scrolled, so the sync waits for the scroll events that follow.
   */
  const markScrollSource = () => {
    scrollSource = props.thisPaneContentArea;
    // Stop revealing a focused field, which would undo the user’s scrolling
    revealGuard.next();
  };

  /**
   * Sync the other pane once this pane has been scrolled by the user.
   */
  const onScroll = () => {
    if (scrollSource === props.thisPaneContentArea) {
      syncScrollPosition();
    }
  };

  /**
   * Scroll the other pane to the given field if it’s not visible there. The default preview renders
   * fields lazily, so the pane may have to be scrolled towards the field until it’s rendered.
   * @param {HTMLElement} field Field element in this pane.
   */
  const revealField = async (field) => {
    const { thisPaneContentArea } = props;
    const { thatPaneContentArea } = props;

    if (
      !props.syncScrolling ||
      !thisPaneContentArea ||
      !thatPaneContentArea ||
      !field.isConnected
    ) {
      return;
    }

    const isLatest = revealGuard.next();
    const pane = thatPaneContentArea;
    const { scrollTop: originalScrollTop } = pane;
    // The field was found by that very attribute, so the key path is there
    const { keyPath } = /** @type {{ keyPath: string }} */ (field.dataset);

    const element = await findLazyFieldElement({
      container: pane,
      keyPath,
      /**
       * Scroll the other pane to an element instantly, so it renders what comes into view.
       * @param {HTMLElement} target Element.
       * @returns {boolean} Whether the pane has been scrolled.
       */
      scrollTo: (target) => {
        const { scrollTop } = pane;

        // Make this pane the scroll source, so that the other pane being scrolled doesn’t scroll
        // this one in turn
        scrollSource = thisPaneContentArea;
        pane.scrollTo({
          // A position is always given when asked for one even if the element is visible
          top: /** @type {number} */ (getThatScrollTop(pane, target, true)),
          behavior: 'instant',
        });

        // Ignore a subpixel difference, which the browser may make when scrolling to where the
        // pane already is
        return Math.abs(pane.scrollTop - scrollTop) >= 1;
      },
      /**
       * Tell whether another field has been focused, either pane has been scrolled by the user, or
       * Sync Scrolling has been turned off since.
       * @returns {boolean} Result.
       */
      isOutdated: () => !isLatest() || !props.syncScrolling,
    });

    if (!element) {
      // Put the pane back if it was scrolled towards a field that turned out not to be shown in
      // it, unless the search was abandoned
      if (isLatest() && props.syncScrolling && pane.scrollTop !== originalScrollTop) {
        scrollSource = thisPaneContentArea;
        pane.scrollTo({ top: originalScrollTop, behavior: 'instant' });
      }

      return;
    }

    const thatScrollTop = getThatScrollTop(pane, element);

    if (thatScrollTop === undefined) {
      return;
    }

    scrollSource = thisPaneContentArea;
    pane.scrollTo({ top: thatScrollTop, behavior: 'smooth' });
  };

  return {
    /**
     * Initialize the scroll synchronization by setting up event listeners on this pane’s content
     * area: the preview iframe’s root element once the frame has loaded, or the main content area.
     * Until the frame has loaded, the main content area is listened to.
     */
    initialize: () => {
      const { contentArea } = props;

      if (!contentArea) {
        return;
      }

      const previous = props.thisPaneContentArea;

      if (previous) {
        // Remove previous event listeners if they exist
        previous.removeEventListener('wheel', markScrollSource, eventOptions);
        previous.removeEventListener('touchstart', markScrollSource, eventOptions);
        scrollEventTarget?.removeEventListener('scroll', onScroll, scrollEventOptions);
      }

      // Forget the frame of a previous preview, which is gone once the pane has switched to the
      // edit mode, so it doesn’t keep the frame’s document from being garbage-collected
      if (previewFrame && !contentArea.contains(previewFrame)) {
        previewFrame = undefined;
      }

      // A frame that has navigated to another origin, e.g. after a link in a preview template was
      // followed, has no document within reach, so the main content area is listened to instead
      const frameRoot = previewFrame?.contentDocument?.documentElement ?? undefined;
      const target = frameRoot ?? contentArea;

      props.thisPaneContentArea = target;
      scrollEventTarget = frameRoot ? frameRoot.ownerDocument : contentArea;
      target.scrollTop = 0;
      // Add event listeners manually to use passive mode
      target.addEventListener('wheel', markScrollSource, eventOptions);
      target.addEventListener('touchstart', markScrollSource, eventOptions);
      scrollEventTarget.addEventListener('scroll', onScroll, scrollEventOptions);
    },

    /**
     * Remember the preview iframe once it has loaded its content.
     * @param {HTMLIFrameElement} iframe Preview iframe.
     */
    setPreviewFrame: (iframe) => {
      previewFrame = iframe;
    },

    /**
     * Scroll the other pane to the field focused in this edit pane, so the user can see the field
     * they’re editing in the preview. Scroll Synchronization follows scrolling only.
     * @param {FocusEvent} event `focusin` event.
     * @see https://github.com/sveltia/sveltia-cms/issues/1069
     */
    onFocusIn: (event) => {
      const field = /** @type {HTMLElement | null} */ (
        /** @type {HTMLElement} */ (event.target).closest('.field[data-key-path]')
      );

      if (props.mode !== 'edit' || !field) {
        return;
      }

      // Focusing the field may scroll this pane to it, and the scroll event that follows syncs the
      // other pane in an animation frame of its own. Wait for that frame, so that the sync doesn’t
      // undo the scrolling
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          revealField(field);
        });
      });
    },

    /**
     * Forget this pane once it’s gone, so the module-level reference doesn’t keep the DOM of a
     * closed editor from being garbage-collected.
     */
    destroy: () => {
      if (scrollSource === props.thisPaneContentArea) {
        scrollSource = undefined;
      }
    },
  };
};
