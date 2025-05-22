<script>
  import { Button, EmptyState } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { entryEditorSettings } from '$lib/services/contents/draft/editor';
  import { toggleLocale } from '$lib/services/contents/draft/update';
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

  /**
   * Sync the scroll position with the other edit/preview pane.
   */
  const syncScrollPosition = () => {
    window.requestAnimationFrame(() => {
      if (!syncScrolling || !thisPaneContentArea || !thatPaneContentArea) {
        return;
      }

      const { x, y } = thisPaneContentArea.getBoundingClientRect();

      const thisElement = /** @type {HTMLElement | undefined} */ (
        document.elementsFromPoint(x + 80, y).find((e) => e.matches('[data-key-path]'))
      );

      if (!thisElement) {
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

      thatPaneContentArea.scrollTop = thatElement.offsetTop - y + thatElement.clientHeight * ratio;
    });
  };

  /** @type {AddEventListenerOptions} */
  const eventOptions = { capture: true, passive: true };

  $effect(() => {
    if (thisPaneContentArea) {
      thisPaneContentArea.scrollTop = 0;
      // Add event listeners manually to use passive mode
      thisPaneContentArea.addEventListener('wheel', syncScrollPosition, eventOptions);
      thisPaneContentArea.addEventListener('touchmove', syncScrollPosition, eventOptions);
    }
  });
</script>

<div role="none" {id} class="wrapper">
  {#if locale && $entryDraft?.currentLocales[locale]}
    <div role="none" class="content" bind:this={thisPaneContentArea}>
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
