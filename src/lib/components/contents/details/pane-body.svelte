<script>
  import { Button, EmptyState } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { toggleLocale } from '$lib/services/contents/draft/update/locale';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {Writable<?EntryEditorPane>} thisPane This pane’s mode and locale.
   * @property {HTMLElement} [thisPaneContentArea] This pane’s content area.
   * @property {HTMLElement} [thatPaneContentArea] Another pane’s content area.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thisPaneContentArea = $bindable(),
    thatPaneContentArea = $bindable(),
    /* eslint-enable prefer-const */
  } = $props();

  const { syncScrolling } = $derived($entryEditorSettings ?? {});
  const locale = $derived($thisPane?.locale);
  const mode = $derived($thisPane?.mode);
  const hasContent = $derived(!!locale && !!$state.snapshot($entryDraft?.currentValues[locale]));
  const labelOptions = $derived({ values: { locale: locale ? getLocaleLabel(locale) : '' } });
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

      // Find a field section at the top left corner of the content area
      const thisElement = /** @type {HTMLElement | undefined} */ (
        ownerDocument.elementsFromPoint(x + 80, y).find((e) => e.matches('[data-key-path]'))
      );

      if (!thisElement) {
        // Calculate the scroll position based on the current scroll position of the this pane
        thatPaneContentArea.scrollTop = thatPaneContentArea.scrollHeight * scrollRatio;

        return;
      }

      const { keyPath } = thisElement.dataset;
      const { top, height } = thisElement.getBoundingClientRect();
      const ratio = (y - top) / height;

      const thatElement = /** @type {HTMLElement | undefined} */ (
        thatPaneContentArea.querySelector(`[data-key-path="${CSS.escape(keyPath ?? '')}"]`)
      );

      if (ratio < 0 || ratio > 1 || !thatElement) {
        return;
      }

      // Scroll the other pane to the corresponding element, adjusting for the current scroll
      // position and the ratio of the scroll position within the element.
      thatPaneContentArea.scrollTop = thatElement.offsetTop - y + thatElement.clientHeight * ratio;
    });
  };

  /** @type {AddEventListenerOptions} */
  const eventOptions = { capture: true, passive: true };

  /**
   * Initialize the scroll synchronization by setting up event listeners and ensuring the content
   * area is ready. The content area is either the main content area or the iframe’s content area.
   * An iframe is used only when a custom preview stylesheet is provided.
   */
  const initializeScrollSync = async () => {
    if (!contentArea) {
      return;
    }

    if (thisPaneContentArea) {
      // Remove previous event listeners if they exist
      thisPaneContentArea.removeEventListener('wheel', syncScrollPosition, eventOptions);
      thisPaneContentArea.removeEventListener('touchmove', syncScrollPosition, eventOptions);
    }

    // Check if the preview iframe is used in the preview mode
    const iframe = /** @type {HTMLIFrameElement | null} */ (
      contentArea.querySelector('iframe.preview')
    );

    if (iframe) {
      // Wait for the content to be loaded in the iframe
      await sleep(250);
      thisPaneContentArea = /** @type {HTMLElement} */ (iframe?.contentDocument?.firstElementChild);
    } else {
      thisPaneContentArea = contentArea;
    }

    if (thisPaneContentArea) {
      thisPaneContentArea.scrollTop = 0;
      // Add event listeners manually to use passive mode
      thisPaneContentArea.addEventListener('wheel', syncScrollPosition, eventOptions);
      thisPaneContentArea.addEventListener('touchmove', syncScrollPosition, eventOptions);
    }
  };

  $effect(() => {
    // Initialize the scroll synchronization when the content area is ready. The pane mode is also a
    // dependency because the edit mode always uses the main content area, while the preview mode
    // may use an iframe if a custom preview stylesheet is provided.
    void [$thisPane?.mode, contentArea];
    initializeScrollSync();
  });
</script>

<div role="none" {id} class="wrapper">
  {#if locale && $entryDraft?.currentLocales[locale]}
    <div role="none" class="content" bind:this={contentArea}>
      <MainContent {locale} />
    </div>
  {:else if mode === 'edit'}
    <EmptyState>
      <span role="alert">
        {$_(hasContent ? 'locale_x_now_disabled' : 'locale_x_has_been_disabled', labelOptions)}
      </span>
      <Button
        variant="tertiary"
        label={$_(hasContent ? 'reenable_x_locale' : 'enable_x_locale', labelOptions)}
        onclick={() => {
          if (locale) {
            toggleLocale(locale);
          }
        }}
      />
    </EmptyState>
  {/if}
</div>

<style lang="scss">
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
