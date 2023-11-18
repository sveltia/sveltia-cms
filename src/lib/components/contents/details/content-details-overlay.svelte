<script>
  import { Group } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PaneBody from '$lib/components/contents/details/pane-body.svelte';
  import PaneHeader from '$lib/components/contents/details/pane-header.svelte';
  import Toolbar from '$lib/components/contents/details/toolbar.svelte';
  import {
    editorLeftPane,
    editorRightPane,
    entryDraft,
    entryEditorSettings,
  } from '$lib/services/contents/editor';
  import { getLocaleLabel } from '$lib/services/i18n';

  /**
   * @type {HTMLElement | undefined}
   */
  let leftPaneContentArea;
  /**
   * @type {HTMLElement | undefined}
   */
  let rightPaneContentArea;

  let panesRestored = false;

  $: ({ collection, collectionFile } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ showPreview, paneStates } = $entryEditorSettings);
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
   * A reference to the wrapper element.
   * @type {HTMLElement}
   */
  let wrapper;

  onMount(() => {
    /** @type {HTMLElement} */
    const group = wrapper.closest('[role="group"]');

    // Move the focus once the overlay is loaded
    group.tabIndex = 0;
    group.focus();

    // onUnmount
    return () => {
      $entryDraft = null;
    };
  });
</script>

<Group aria-label={$_('content_editor')}>
  <div role="none" class="wrapper" bind:this={wrapper}>
    <Toolbar />
    <div role="none" class="cols">
      {#if collection}
        {#if $editorLeftPane}
          {@const { locale, mode } = $editorLeftPane}
          <Group
            aria-label={$_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
              values: { locale: getLocaleLabel(locale) },
            })}
            data-locale={locale}
            data-mode={mode}
          >
            <PaneHeader
              id="left-pane-header"
              thisPane={editorLeftPane}
              thatPane={editorRightPane}
            />
            <PaneBody
              id="left-pane-body"
              thisPane={editorLeftPane}
              bind:thisPaneContentArea={leftPaneContentArea}
              thatPaneContentArea={rightPaneContentArea}
            />
          </Group>
        {/if}
        {#if $editorRightPane}
          {@const { locale, mode } = $editorRightPane}
          <Group
            aria-label={$_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
              values: { locale: getLocaleLabel(locale) },
            })}
            data-locale={locale}
            data-mode={mode}
          >
            <PaneHeader
              id="right-pane-header"
              thisPane={editorRightPane}
              thatPane={editorLeftPane}
            />
            <PaneBody
              id="right-pane-body"
              thisPane={editorRightPane}
              bind:thisPaneContentArea={rightPaneContentArea}
              thatPaneContentArea={leftPaneContentArea}
            />
          </Group>
        {/if}
      {/if}
    </div>
  </div>
</Group>

<style lang="scss">
  .wrapper {
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
