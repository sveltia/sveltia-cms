<script>
  import { Button, Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import { entryDraft, entryEditorSettings, toggleLocale } from '$lib/services/contents/editor';
  import { getLocaleLabel } from '$lib/services/i18n';

  /**
   * @type {import('svelte/store').Writable<EntryEditorPane>}
   */
  export let thisPane;
  /**
   * @type {HTMLElement | undefined}
   */
  export let thisPaneContentArea;
  /**
   * @type {HTMLElement | undefined}
   */
  export let thatPaneContentArea;

  $: ({ syncScrolling } = $entryEditorSettings);
  $: ({ currentLocales, currentValues } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ locale, mode } = $thisPane);
  $: hasContent = !!currentValues[locale];
  $: labelOptions = { values: { locale: getLocaleLabel(locale) } };

  /**
   * Sync the scroll position with the other edit/preview pane.
   */
  const syncScrollPosition = () => {
    if (!syncScrolling || !thatPaneContentArea) {
      return;
    }

    window.requestAnimationFrame(() => {
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
        thatPaneContentArea.querySelector(`[data-key-path="${CSS.escape(keyPath)}"]`)
      );

      if (ratio < 0 || ratio > 1 || !thatElement) {
        return;
      }

      thatPaneContentArea.scrollTop = thatElement.offsetTop - y + thatElement.clientHeight * ratio;
    });
  };

  $: {
    if (thisPaneContentArea) {
      thisPaneContentArea.scrollTop = 0;
    }
  }
</script>

<Group
  aria-label={$_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
    values: { locale: getLocaleLabel(locale) },
  })}
>
  {#if currentLocales[locale]}
    <div
      class="content"
      bind:this={thisPaneContentArea}
      on:wheel|capture={() => {
        syncScrollPosition();
      }}
    >
      <svelte:component this={mode === 'preview' ? EntryPreview : EntryEditor} {locale} />
    </div>
  {:else if mode === 'edit'}
    <EmptyState>
      <span>
        {$_(hasContent ? 'locale_x_now_disabled' : 'locale_x_has_been_disabled', labelOptions)}
      </span>
      <Button
        variant="tertiary"
        on:click={() => {
          toggleLocale(locale);
        }}
      >
        {$_(hasContent ? 'reenable_x_locale' : 'enable_x_locale', labelOptions)}
      </Button>
    </EmptyState>
  {/if}
</Group>

<style lang="scss">
  .content {
    flex: auto;
    overflow-y: auto;
    scroll-behavior: auto; /* Don’t use smooth scroll for syncing */
    overscroll-behavior-y: contain;
  }
</style>
