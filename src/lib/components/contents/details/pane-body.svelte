<script module>
  import { createLatestGuard } from '$lib/services/utils/scheduling';

  /**
   * Content area the user is scrolling, with the mouse wheel or a touch. Only its scroll events
   * are synced to the other pane: the other pane’s own scroll events come from being synced, and
   * syncing them back would make the panes chase each other.
   * @type {HTMLElement | undefined}
   */
  let scrollSource;
  /**
   * Guard to leave the other pane alone once another field has been focused or either pane has
   * been scrolled by the user.
   */
  const revealGuard = createLatestGuard();
</script>

<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { toggleLocale } from '$lib/services/contents/draft/update/locale';
  import {
    findLazyFieldElement,
    getFieldAlignedScrollTop,
    getProportionalScrollTop,
    getRevealingScrollTop,
  } from '$lib/services/contents/editor/scroll';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {{ current: ?EntryEditorPane }} thisPane This pane’s mode and locale.
   * @property {HTMLElement} [thisPaneContentArea] This pane’s content area, bound for the parent.
   * @property {HTMLElement} [thatPaneContentArea] Another pane’s content area.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thisPaneContentArea = $bindable(),
    thatPaneContentArea = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { syncScrolling } = $derived(entryEditorSettings.current ?? {});
  const locale = $derived(thisPane.current?.locale);
  const mode = $derived(thisPane.current?.mode);
  const hasContent = $derived(!!locale && !!entryDraft.current?.currentValues[locale]);
  /* v8 ignore start -- only read for a disabled locale, which the pane always has */
  const labelOptions = $derived({
    values: { locale: locale ? (getLocaleLabel(locale) ?? locale) : '' },
  });
  /* v8 ignore stop */

  /** @type {HTMLElement | undefined} */
  let contentArea = $state();

  /**
   * Sync the scroll position with the other edit/preview pane.
   */
  const syncScrollPosition = () => {
    window.requestAnimationFrame(() => {
      if (!syncScrolling || !contentArea || !thisPaneContentArea || !thatPaneContentArea) {
        return;
      }

      const isIframe = thisPaneContentArea !== contentArea;
      const { x, y } = isIframe ? { x: 0, y: 0 } : thisPaneContentArea.getBoundingClientRect();
      const { ownerDocument, scrollTop, scrollHeight, clientHeight } = thisPaneContentArea;

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
            targetOffsetTop: thatElement.offsetTop,
            targetHeight: thatElement.clientHeight,
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
    scrollSource = thisPaneContentArea;
    // Stop revealing a focused field, which would undo the user’s scrolling
    revealGuard.next();
  };

  /**
   * Sync the other pane once this pane has been scrolled by the user.
   */
  const onScroll = () => {
    if (scrollSource === thisPaneContentArea) {
      syncScrollPosition();
    }
  };

  /**
   * Get the scroll position of the other pane that reveals the given element in it.
   * @param {HTMLElement} pane The other pane’s content area.
   * @param {HTMLElement} element Element in the pane.
   * @param {boolean} [always] Whether to get the position even if the element is already visible.
   * @returns {number | undefined} Scroll position, or `undefined` if the element is already
   * visible.
   */
  const getThatScrollTop = (pane, element, always = false) => {
    // The preview iframe’s root element is its viewport, while the content area of the main
    // document is an element in it
    const isRoot = pane === pane.ownerDocument.documentElement;
    const { top, height } = element.getBoundingClientRect();
    const { scrollTop, clientHeight } = pane;

    return getRevealingScrollTop({
      viewTop: isRoot ? 0 : pane.getBoundingClientRect().top,
      viewHeight: clientHeight,
      scrollTop,
      top,
      height,
      always,
    });
  };

  /**
   * Scroll the other pane to the given field if it’s not visible there. The default preview renders
   * fields lazily, so the pane may have to be scrolled towards the field until it’s rendered.
   * @param {HTMLElement} field Field element in this pane.
   */
  const revealField = async (field) => {
    if (!syncScrolling || !thisPaneContentArea || !thatPaneContentArea || !field.isConnected) {
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
      isOutdated: () => !isLatest() || !syncScrolling,
    });

    if (!element) {
      // Put the pane back if it was scrolled towards a field that turned out not to be shown in
      // it, unless the search was abandoned
      if (isLatest() && syncScrolling && pane.scrollTop !== originalScrollTop) {
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

  /**
   * Scroll the other pane to the field focused in this edit pane, so the user can see the field
   * they’re editing in the preview. Scroll Synchronization follows scrolling only.
   * @param {FocusEvent} event `focusin` event.
   * @see https://github.com/sveltia/sveltia-cms/issues/1069
   */
  const onFocusIn = (event) => {
    const field = /** @type {HTMLElement | null} */ (
      /** @type {HTMLElement} */ (event.target).closest('.field[data-key-path]')
    );

    if (mode !== 'edit' || !field) {
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
  };

  /**
   * Element receiving the scroll events of this pane’s content area: the area itself, or the
   * preview iframe’s document, whose root element doesn’t get the events of its own scrolling.
   * @type {HTMLElement | Document | undefined}
   */
  let scrollEventTarget;

  /** @type {AddEventListenerOptions} */
  const eventOptions = { capture: true, passive: true };
  /**
   * Options for the scroll listener, which isn’t capturing: scroll events don’t bubble, and
   * capturing would also get those of a field scrolled within the pane, e.g. a text area.
   * @type {AddEventListenerOptions}
   */
  const scrollEventOptions = { passive: true };
  /**
   * Preview iframe, which is used in the preview mode only when a custom preview stylesheet or
   * template applies to the entry. It’s set once the frame has loaded its content, which may take
   * a while: the preview is rendered lazily once it’s visible, and a template waits for
   * Immutable.js to be loaded.
   * @type {HTMLIFrameElement | undefined}
   */
  let previewFrame;

  /**
   * Initialize the scroll synchronization by setting up event listeners on this pane’s content
   * area: the preview iframe’s root element once the frame has loaded, or the main content area.
   * Until the frame has loaded, the main content area is listened to.
   */
  const initializeScrollSync = () => {
    if (!contentArea) {
      return;
    }

    if (thisPaneContentArea) {
      // Remove previous event listeners if they exist
      thisPaneContentArea.removeEventListener('wheel', markScrollSource, eventOptions);
      thisPaneContentArea.removeEventListener('touchstart', markScrollSource, eventOptions);
      scrollEventTarget?.removeEventListener('scroll', onScroll, scrollEventOptions);
    }

    // Forget the frame of a previous preview, which is gone once the pane has switched to the edit
    // mode, so it doesn’t keep the frame’s document from being garbage-collected
    if (previewFrame && !contentArea.contains(previewFrame)) {
      previewFrame = undefined;
    }

    // A frame that has navigated to another origin, e.g. after a link in a preview template was
    // followed, has no document within reach, so the main content area is listened to instead
    const frameRoot = previewFrame?.contentDocument?.documentElement ?? undefined;

    thisPaneContentArea = frameRoot ?? contentArea;
    scrollEventTarget = frameRoot ? frameRoot.ownerDocument : contentArea;
    thisPaneContentArea.scrollTop = 0;
    // Add event listeners manually to use passive mode
    thisPaneContentArea.addEventListener('wheel', markScrollSource, eventOptions);
    thisPaneContentArea.addEventListener('touchstart', markScrollSource, eventOptions);
    scrollEventTarget.addEventListener('scroll', onScroll, scrollEventOptions);
  };

  $effect(() => {
    // Initialize the scroll synchronization when the content area is ready. The pane mode is also a
    // dependency because the edit mode always uses the main content area, while the preview mode
    // uses an iframe if a custom preview stylesheet or template applies. The iframe is only there
    // once it has loaded, so it initializes the sync again then.
    void [thisPane.current?.mode, contentArea];
    // The initialization writes `thisPaneContentArea`, which it also reads, so it’s left out of
    // the dependencies to keep the effect from running again on its own account
    untrack(() => initializeScrollSync());
  });

  // Forget this pane once it’s gone, so the module-level reference doesn’t keep the DOM of a closed
  // editor from being garbage-collected
  $effect(() => () => {
    if (scrollSource === thisPaneContentArea) {
      scrollSource = undefined;
    }
  });
</script>

<div role="none" {id} class="wrapper">
  {#if locale && entryDraft.current?.currentLocales[locale]}
    <div role="none" class="content" bind:this={contentArea} onfocusin={onFocusIn}>
      {#if mode === 'preview'}
        <EntryPreview
          {locale}
          onFrameLoad={(iframe) => {
            previewFrame = iframe;
            initializeScrollSync();
          }}
        />
      {:else}
        <EntryEditor {locale} />
      {/if}
    </div>
  {:else if mode === 'edit'}
    <EmptyState>
      <span role="alert">
        {_(hasContent ? 'locale_x_now_disabled' : 'locale_x_has_been_disabled', labelOptions)}
      </span>
      <Button
        variant="tertiary"
        label={_(hasContent ? 'reenable_x_locale' : 'enable_x_locale', labelOptions)}
        onclick={() => {
          /* v8 ignore next 3 -- the button is only offered for a disabled locale */
          if (locale && entryDraft.current) {
            toggleLocale({ draft: entryDraft.current, locale });
          }
        }}
      />
    </EmptyState>
  {/if}
</div>

<style>
  .wrapper {
    display: contents;
  }

  .content {
    --field-editor-padding: 16px;
    flex: auto;
    overflow-y: auto;
    scroll-behavior: auto; /* Don’t use smooth scroll for syncing */
    overscroll-behavior-y: contain;

    @media (width < 768px) {
      --field-editor-padding: 12px;
    }
  }
</style>
