<script>
  import { untrack } from 'svelte';

  import DisabledLocaleState from '$lib/components/contents/details/disabled-locale-state.svelte';
  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { createScrollSync } from '$lib/services/contents/editor/scroll-sync';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';

  /**
   * @import { EntryEditorPane, InternalLocaleCode } from '$lib/types/private';
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
    id,
    thisPane,
    thisPaneContentArea = $bindable(),
    thatPaneContentArea = undefined,
  } = $props();

  const { syncScrolling } = $derived(entryEditorSettings.current ?? {});
  const locale = $derived(thisPane.current?.locale);
  const mode = $derived(thisPane.current?.mode);
  // A pane in the edit mode always has a locale
  const editLocale = $derived(/** @type {InternalLocaleCode} */ (locale));

  /** @type {HTMLElement | undefined} */
  let contentArea = $state();

  /* eslint-disable jsdoc/require-jsdoc */
  const scrollSync = createScrollSync({
    get syncScrolling() {
      return syncScrolling;
    },
    get mode() {
      return mode;
    },
    get contentArea() {
      return contentArea;
    },
    get thisPaneContentArea() {
      return thisPaneContentArea;
    },
    set thisPaneContentArea(element) {
      thisPaneContentArea = element;
    },
    get thatPaneContentArea() {
      return thatPaneContentArea;
    },
  });
  /* eslint-enable jsdoc/require-jsdoc */

  $effect(() => {
    // Initialize the scroll synchronization when the content area is ready. The pane mode is also a
    // dependency because the edit mode always uses the main content area, while the preview mode
    // uses an iframe if a custom preview stylesheet or template applies. The iframe is only there
    // once it has loaded, so it initializes the sync again then.
    void [thisPane.current?.mode, contentArea];
    // The initialization writes `thisPaneContentArea`, which it also reads, so it’s left out of
    // the dependencies to keep the effect from running again on its own account
    untrack(() => scrollSync.initialize());
  });

  // Forget this pane once it’s gone, so the module-level reference doesn’t keep the DOM of a closed
  // editor from being garbage-collected
  $effect(() => () => {
    scrollSync.destroy();
  });
</script>

<div role="none" {id} class="wrapper">
  {#if locale && entryDraft.current?.currentLocales[locale]}
    <div role="none" class="content" bind:this={contentArea} onfocusin={scrollSync.onFocusIn}>
      {#if mode === 'preview'}
        <EntryPreview
          {locale}
          onFrameLoad={(iframe) => {
            scrollSync.setPreviewFrame(iframe);
            scrollSync.initialize();
          }}
        />
      {:else}
        <EntryEditor {locale} />
      {/if}
    </div>
  {:else if mode === 'edit'}
    <DisabledLocaleState locale={editLocale} />
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
