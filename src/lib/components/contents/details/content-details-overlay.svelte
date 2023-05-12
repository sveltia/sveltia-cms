<script>
  import { Group } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import ColumnHeader from '$lib/components/contents/details/column-header.svelte';
  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import Toolbar from '$lib/components/contents/details/toolbar.svelte';
  import {
    editorLeftPane,
    editorRightPane,
    entryDraft,
    entryViewSettings,
  } from '$lib/services/contents/editor';

  let leftColumnContent;
  let rightColumnContent;

  $: ({ showPreview, syncScrolling } = $entryViewSettings);

  $: ({ collection, collectionFile } = $entryDraft || {
    collection: undefined,
    collectionFile: undefined,
  });

  $: ({ hasLocales, locales } = collection._i18n);
  $: canPreview =
    collection?.editor?.preview !== false && collectionFile?.editor?.preview !== false;

  /**
   * Hide the preview pane if it’s disabled by the user or the collection/file.
   */
  const switchPanes = () => {
    if (!showPreview || !canPreview) {
      const otherLocales = hasLocales ? locales.filter((l) => l !== $editorLeftPane.locale) : [];

      $editorLeftPane.mode = 'edit';
      $editorRightPane = otherLocales.length ? { mode: 'edit', locale: otherLocales[0] } : null;
    } else {
      $editorLeftPane.mode = 'edit';
      $editorRightPane = { mode: 'preview', locale: $editorLeftPane.locale };
    }
  };

  // @ts-ignore
  $: switchPanes(showPreview, canPreview);

  /**
   * Sync the scroll position with the other edit/preview pane.
   * @param {HTMLElement} thisContentArea Element that the user is scrolling.
   * @param {HTMLElement} [thatContentArea] The other pane’s content area. Can be empty if there is
   * one locale and preview for the collection is disabled.
   */
  const syncScrollPosition = (thisContentArea, thatContentArea) => {
    if (!syncScrolling || !thatContentArea) {
      return;
    }

    window.requestAnimationFrame(() => {
      const { x, y } = thisContentArea.getBoundingClientRect();

      const thisElement = /** @type {HTMLElement?} */ (
        document.elementsFromPoint(x + 80, y).find((e) => e.matches('[data-key-path]'))
      );

      if (!thisElement) {
        return;
      }

      const { keyPath } = thisElement.dataset;
      const { top, height } = thisElement.getBoundingClientRect();
      const ratio = (y - top) / height;

      const thatElement = /** @type {HTMLElement?} */ (
        thatContentArea.querySelector(`[data-key-path="${CSS.escape(keyPath)}"]`)
      );

      if (ratio < 0 || ratio > 1 || !thatElement) {
        return;
      }

      thatContentArea.scrollTop = thatElement.offsetTop - y + thatElement.clientHeight * ratio;
    });
  };

  $: {
    if (leftColumnContent || rightColumnContent) {
      (leftColumnContent || {}).scrollTop = 0;
      (rightColumnContent || {}).scrollTop = 0;
    }
  }

  onMount(() =>
    // onUnmount
    () => {
      // Reset the draft to prevent the page from becoming blank when navigating back
      $entryDraft = null;
    },
  );
</script>

<div class="editor">
  <Toolbar />
  <div class="cols">
    {#if collection}
      {#if $editorLeftPane}
        <Group data-mode={$editorLeftPane.mode} data-locale={$editorLeftPane.locale}>
          <ColumnHeader thisPane={editorLeftPane} thatPane={editorRightPane} />
          <div
            class="content"
            bind:this={leftColumnContent}
            on:wheel|capture={() => {
              syncScrollPosition(leftColumnContent, rightColumnContent);
            }}
          >
            <svelte:component
              this={$editorLeftPane.mode === 'preview' ? EntryPreview : EntryEditor}
              locale={$editorLeftPane.locale}
            />
          </div>
        </Group>
      {/if}
      {#if $editorRightPane}
        <Group data-mode={$editorRightPane.mode} data-locale={$editorRightPane.locale}>
          <ColumnHeader thisPane={editorRightPane} thatPane={editorLeftPane} />
          <div
            class="content"
            bind:this={rightColumnContent}
            on:wheel|capture={() => {
              syncScrollPosition(rightColumnContent, leftColumnContent);
            }}
          >
            <svelte:component
              this={$editorRightPane.mode === 'preview' ? EntryPreview : EntryEditor}
              locale={$editorRightPane.locale}
            />
          </div>
        </Group>
      {/if}
    {/if}
  </div>
</div>

<style lang="scss">
  .editor {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-background-color);

    .cols {
      flex: auto;
      overflow: hidden;
      display: flex;

      & > :global(div) {
        display: flex;
        flex-direction: column;
        min-width: 480px;
        transition: all 500ms;

        &:first-child {
          border-width: 0 1px 0 0;
          border-color: var(--primary-border-color);
        }

        & > :global(.content) {
          flex: auto;
          overflow-y: auto;
          scroll-behavior: auto; // Don’t use smooth scroll for syncing
          overscroll-behavior-y: contain;
        }
      }

      & > :global([data-mode='edit']) {
        flex: 1 1;
      }

      & > :global([data-mode='preview']) {
        flex: 2 1;
      }
    }
  }
</style>
