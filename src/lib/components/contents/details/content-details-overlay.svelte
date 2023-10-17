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
    entryEditorSettings,
  } from '$lib/services/contents/editor';

  /**
   * @type {HTMLElement}
   */
  let leftColumnContent;
  /**
   * @type {HTMLElement}
   */
  let rightColumnContent;

  let panesRestored = false;

  $: ({ collection, collectionFile } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ showPreview, syncScrolling, paneStates } = $entryEditorSettings);
  $: ({ hasLocales = false, locales = ['default'] } =
    collection?._i18n ?? /** @type {I18nConfig} */ ({}));
  $: canPreview =
    collection?.editor?.preview !== false && collectionFile?.editor?.preview !== false;

  /**
   * Restore the pane state from local storage.
   * @throws {Error} If the saved state is no longer relevant to the current view.
   */
  const restorePanes = () => {
    const savedPanes = paneStates?.[collection.name];

    if (!Array.isArray(savedPanes)) {
      return;
    }

    const [_editorLeftPane, _editorRightPane] = savedPanes;

    if (
      (!!_editorLeftPane?.locale && !locales.includes(_editorLeftPane.locale)) ||
      (!!_editorRightPane?.locale && !locales.includes(_editorRightPane.locale)) ||
      ((!showPreview || !canPreview) &&
        (_editorLeftPane?.mode === 'preview' || _editorRightPane?.mode === 'preview'))
    ) {
      throw new Error('Saved panes are invalid');
    }

    $editorLeftPane = _editorLeftPane;
    $editorRightPane = _editorRightPane;
  };

  /**
   * Hide the preview pane if it’s disabled by the user or the collection/file.
   */
  const switchPanes = () => {
    if (!panesRestored) {
      try {
        restorePanes();
        return;
      } catch {
        //
      } finally {
        panesRestored = true;
      }
    }

    if (!showPreview || !canPreview) {
      const otherLocales = hasLocales ? locales.filter((l) => l !== $editorLeftPane?.locale) : [];

      $editorLeftPane.mode = 'edit';
      $editorRightPane = otherLocales.length ? { mode: 'edit', locale: otherLocales[0] } : null;
    } else {
      $editorLeftPane.mode = 'edit';
      $editorRightPane = { mode: 'preview', locale: $editorLeftPane?.locale };
    }
  };

  $: {
    void showPreview;
    void canPreview;
    switchPanes();
  }

  /**
   * Save the pane state to local storage.
   */
  const savePanes = () => {
    if (!collection) {
      return;
    }

    entryEditorSettings.update((view) => ({
      ...view,
      paneStates: {
        ...(view.paneStates ?? {}),
        [collection.name]: [$editorLeftPane, $editorRightPane],
      },
    }));
  };

  $: {
    void $editorLeftPane;
    void $editorRightPane;
    savePanes();
  }

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
    if (leftColumnContent) {
      leftColumnContent.scrollTop = 0;
    }
  }

  $: {
    if (rightColumnContent) {
      rightColumnContent.scrollTop = 0;
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
    background-color: var(--sui-primary-background-color);

    .cols {
      flex: auto;
      overflow: hidden;
      display: flex;

      & > :global(div) {
        display: flex;
        flex-direction: column;
        min-width: 480px;
        transition: all 500ms;

        &:first-child:not(:last-child) {
          border-width: 0 1px 0 0;
          border-color: var(--sui-primary-border-color);
        }

        & > :global(.content) {
          flex: auto;
          overflow-y: auto;
          scroll-behavior: auto; /* Don’t use smooth scroll for syncing */
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
