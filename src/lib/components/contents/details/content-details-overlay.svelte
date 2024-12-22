<script>
  import { Alert, Group, Toast } from '@sveltia/ui';
  import { onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import BackupFeedback from '$lib/components/contents/details/backup-feedback.svelte';
  import PaneBody from '$lib/components/contents/details/pane-body.svelte';
  import PaneHeader from '$lib/components/contents/details/pane-header.svelte';
  import Toolbar from '$lib/components/contents/details/toolbar.svelte';
  import { siteConfig } from '$lib/services/config';
  import { entryDraft } from '$lib/services/contents/draft';
  import {
    resetBackupToastState,
    showBackupToastIfNeeded,
  } from '$lib/services/contents/draft/backup';
  import {
    editorLeftPane,
    editorRightPane,
    entryEditorSettings,
    showContentOverlay,
    showDuplicateToast,
  } from '$lib/services/contents/draft/editor';
  import { defaultI18nConfig, getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * A reference to the group element.
   * @type {HTMLElement | undefined}
   */
  let group = undefined;
  let restoring = false;

  let hiding = $state(false);
  let hidden = $state(true);
  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {HTMLElement | undefined} */
  let leftPaneContentArea = $state();
  /** @type {HTMLElement | undefined} */
  let rightPaneContentArea = $state();

  const { editor: { preview: showPreviewPane = true } = {} } = $derived(
    $siteConfig ?? /** @type {SiteConfig} */ ({}),
  );
  const { collection, collectionFile, originalEntry } = $derived(
    $entryDraft ?? /** @type {EntryDraft} */ ({}),
  );
  const entryId = $derived(
    originalEntry?.id ?? [collection?.name ?? '-', collectionFile?.name ?? '-'].join('/'),
  );
  const { showPreview } = $derived($entryEditorSettings ?? {});
  const { i18nEnabled, locales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig,
  );
  const canPreview = $derived((collectionFile ?? collection)?.editor?.preview ?? showPreviewPane);
  const paneStateKey = $derived(
    collectionFile?.name ? [collection?.name, collectionFile.name].join('|') : collection?.name,
  );

  /**
   * Restore the pane state from IndexedDB.
   * @returns {Promise<boolean>} Whether the panes are restored.
   */
  const restorePanes = async () => {
    const [_editorLeftPane, _editorRightPane] =
      $entryEditorSettings?.paneStates?.[paneStateKey] ?? [];

    if (
      !_editorLeftPane ||
      !_editorRightPane ||
      (!!_editorLeftPane?.locale && !locales.includes(_editorLeftPane.locale)) ||
      (!!_editorRightPane?.locale && !locales.includes(_editorRightPane.locale)) ||
      ((!showPreview || !canPreview) &&
        (_editorLeftPane?.mode === 'preview' || _editorRightPane?.mode === 'preview'))
    ) {
      return false;
    }

    restoring = true;
    await tick();
    $editorLeftPane = _editorLeftPane;
    $editorRightPane = _editorRightPane;
    await tick();
    restoring = false;

    return true;
  };

  /**
   * Hide the preview pane if it’s disabled by the user or the collection/file.
   */
  const switchPanes = async () => {
    if (!$entryDraft) {
      return;
    }

    if (await restorePanes()) {
      return;
    }

    $editorLeftPane = { mode: 'edit', locale: $editorLeftPane?.locale ?? defaultLocale };

    if (!showPreview || !canPreview) {
      const otherLocales = i18nEnabled ? locales.filter((l) => l !== $editorLeftPane?.locale) : [];

      $editorRightPane = otherLocales.length ? { mode: 'edit', locale: otherLocales[0] } : null;
    } else {
      $editorRightPane = { mode: 'preview', locale: $editorLeftPane?.locale };
    }
  };

  /**
   * Save the pane state to IndexedDB.
   */
  const savePanes = () => {
    if (!collection || restoring || !$editorLeftPane || !$editorRightPane) {
      return;
    }

    entryEditorSettings.update((view = {}) => ({
      ...view,
      paneStates: {
        ...(view.paneStates ?? {}),
        [paneStateKey]: [$editorLeftPane, $editorRightPane],
      },
    }));
  };

  /**
   * Move focus to the wrapper once the overlay is loaded.
   */
  const moveFocus = async () => {
    // Wait until `inert` is updated
    await tick();

    if (group) {
      group.tabIndex = 0;
      group.focus();
    }
  };

  onMount(() => {
    group = /** @type {HTMLElement} */ (wrapper?.querySelector('[role="group"]'));

    group.addEventListener('transitionend', () => {
      if (!$showContentOverlay) {
        hiding = false;
        hidden = true;
        $entryDraft = null;
      }
    });
  });

  $effect(() => {
    if (paneStateKey) {
      // Reset the editor panes
      $editorLeftPane = null;
      $editorRightPane = null;
    }
  });

  $effect(() => {
    void showPreview;
    void canPreview;
    switchPanes();
  });

  $effect(() => {
    void $editorLeftPane;
    void $editorRightPane;
    savePanes();
  });

  $effect(() => {
    if (wrapper) {
      if (!$showContentOverlay) {
        hiding = true;
        showBackupToastIfNeeded();
      } else if (hidden) {
        hiding = false;
        hidden = false;
        switchPanes();
        moveFocus();
        resetBackupToastState();
      }
    }
  });
</script>

<div
  role="none"
  class="wrapper"
  class:hiding
  {hidden}
  inert={!$showContentOverlay}
  bind:this={wrapper}
>
  <Group class="content-editor" aria-label={$_('content_editor')}>
    {#key entryId}
      <Toolbar />
      <div role="none" class="cols">
        {#if collection}
          {#if $editorLeftPane}
            {@const { locale, mode } = $editorLeftPane}
            <Group
              class="pane"
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
    {/key}
  </Group>
</div>

<BackupFeedback />

<Toast bind:show={$showDuplicateToast}>
  <Alert status="success">
    {$_('entry_duplicated')}
  </Alert>
</Toast>

<style lang="scss">
  .wrapper {
    display: contents;

    &[hidden] {
      display: none;
    }

    & > :global(.sui.group) {
      position: absolute;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      background-color: var(--sui-primary-background-color);
      transition: filter 250ms;
    }

    &[inert] > :global(.sui.group) {
      filter: opacity(0);
    }

    .cols {
      flex: auto;
      overflow: hidden;
      display: flex;

      & > :global(div) {
        display: flex;
        flex-direction: column;
        min-width: 480px;
        transition: all 500ms;
      }

      & > :global(div:first-child:not(:last-child)) {
        border-width: 0 1px 0 0;
        border-color: var(--sui-primary-border-color);
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
