<script module>
  /**
   * Content area the user is scrolling, with the mouse wheel or a touch. Only its scroll events
   * are synced to the other pane: the other pane’s own scroll events come from being synced, and
   * syncing them back would make the panes chase each other.
   * @type {HTMLElement | undefined}
   */
  let scrollSource;
</script>

<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { untrack } from 'svelte';

  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import {
    customPreviewStyleRegistry,
    customPreviewTemplateRegistry,
  } from '$lib/services/api/registries';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { toggleLocale } from '$lib/services/contents/draft/update/locale';
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
  const MainContent = $derived(mode === 'preview' ? EntryPreview : EntryEditor);

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
      const scrollTopMax = scrollHeight - clientHeight;
      const scrollRatio = scrollTop / scrollTopMax;

      // Find the field section in the top left corner of the content area. Use `findLast` to
      // capture the topmost element; otherwise the List field sticky headers will interfere with
      // the positioning.
      // @see https://github.com/sveltia/sveltia-cms/issues/883
      const thisElement = /** @type {HTMLElement | undefined} */ (
        ownerDocument.elementsFromPoint(x + 80, y).findLast((e) => e.matches('[data-key-path]'))
      );

      if (!thisElement) {
        // Calculate the scroll position based on the current scroll position of the this pane
        thatPaneContentArea.scrollTop = thatPaneContentArea.scrollHeight * scrollRatio;

        return;
      }

      // The element was found by that very attribute, so the key path is there
      const { keyPath } = /** @type {{ keyPath: string }} */ (thisElement.dataset);
      const { top, height } = thisElement.getBoundingClientRect();
      const ratio = (y - top) / height;

      const thatElement = /** @type {HTMLElement | undefined} */ (
        thatPaneContentArea.querySelector(`[data-key-path="${CSS.escape(keyPath)}"]`)
      );

      if (ratio < 0 || ratio > 1 || !thatElement) {
        return;
      }

      // Scroll the other pane to the corresponding element, adjusting for the current scroll
      // position and the ratio of the scroll position within the element.
      thatPaneContentArea.scrollTop = thatElement.offsetTop - y + thatElement.clientHeight * ratio;
    });
  };

  /**
   * Mark this pane as the one the user is scrolling. The wheel and touch events come before the
   * pane is scrolled, so the sync waits for the scroll events that follow.
   */
  const markScrollSource = () => {
    scrollSource = thisPaneContentArea;
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
  /** Counter to ignore an outdated initialization once a newer one has started. */
  let initCount = 0;

  /**
   * Find the preview iframe, which is used in the preview mode only when a custom preview
   * stylesheet or template is provided. The preview is rendered lazily once it’s visible, so the
   * iframe may not be in the DOM yet when the pane mode changes.
   * @returns {Promise<HTMLIFrameElement | null>} Iframe, if any.
   */
  const findPreviewIframe = async () => {
    for (let i = 0; i < 10; i += 1) {
      const iframe = contentArea?.querySelector('iframe.preview');

      if (iframe) {
        return /** @type {HTMLIFrameElement} */ (iframe);
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(50);
    }

    return null;
  };

  /**
   * Initialize the scroll synchronization by setting up event listeners and ensuring the content
   * area is ready. The content area is either the main content area or the iframe’s content area.
   * An iframe is used only when a custom preview stylesheet is provided.
   */
  const initializeScrollSync = async () => {
    if (!contentArea) {
      return;
    }

    initCount += 1;

    const currentCount = initCount;

    if (thisPaneContentArea) {
      // Remove previous event listeners if they exist
      thisPaneContentArea.removeEventListener('wheel', markScrollSource, eventOptions);
      thisPaneContentArea.removeEventListener('touchstart', markScrollSource, eventOptions);
      scrollEventTarget?.removeEventListener('scroll', onScroll, scrollEventOptions);
    }

    // The preview is only rendered in an iframe with a custom preview stylesheet or template. Don’t
    // wait for one otherwise, as the other pane can’t follow this one until it’s set up
    const iframe =
      mode === 'preview' && (customPreviewStyleRegistry.size || customPreviewTemplateRegistry.size)
        ? await findPreviewIframe()
        : null;

    if (iframe) {
      // Wait for the content to be loaded in the iframe
      await sleep(250);
    }

    if (currentCount !== initCount) {
      // The mode has changed in the meantime, and a newer initialization has taken over
      return;
    }

    if (iframe) {
      thisPaneContentArea = /** @type {HTMLElement} */ (iframe.contentDocument?.firstElementChild);
    } else {
      thisPaneContentArea = contentArea;
    }

    if (thisPaneContentArea) {
      scrollEventTarget = iframe ? thisPaneContentArea.ownerDocument : thisPaneContentArea;
      thisPaneContentArea.scrollTop = 0;
      // Add event listeners manually to use passive mode
      thisPaneContentArea.addEventListener('wheel', markScrollSource, eventOptions);
      thisPaneContentArea.addEventListener('touchstart', markScrollSource, eventOptions);
      scrollEventTarget.addEventListener('scroll', onScroll, scrollEventOptions);
    }
  };

  $effect(() => {
    // Initialize the scroll synchronization when the content area is ready. The pane mode is also a
    // dependency because the edit mode always uses the main content area, while the preview mode
    // may use an iframe if a custom preview stylesheet is provided.
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
    <div role="none" class="content" bind:this={contentArea}>
      <MainContent {locale} />
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
