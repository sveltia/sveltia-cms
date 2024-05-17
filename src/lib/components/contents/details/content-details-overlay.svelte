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
   * @type {HTMLElement | undefined}
   */
  let leftPaneContentArea;
  /**
   * @type {HTMLElement | undefined}
   */
  let rightPaneContentArea;
  /**
   * @type {boolean}
   */
  let restoring = false;

  $: ({ editor: { preview: showPreviewPane = true } = {} } =
    $siteConfig ?? /** @type {SiteConfig} */ ({}));
  $: ({ collection, collectionFile, originalEntry } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: entryId =
    originalEntry?.id ?? [collection?.name ?? '-', collectionFile?.name ?? '-'].join('/');
  $: ({ showPreview } = $entryEditorSettings ?? {});
  $: ({ i18nEnabled, locales, defaultLocale } =
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: canPreview = (collectionFile ?? collection)?.editor?.preview ?? showPreviewPane;

  /**
   * Restore the pane state from IndexedDB.
   * @returns {Promise<boolean>} Whether the panes are restored.
   */
  const restorePanes = async () => {
    const [_editorLeftPane, _editorRightPane] =
      $entryEditorSettings?.paneStates?.[collection?.name] ?? [];

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

  $: {
    void showPreview;
    void canPreview;
    switchPanes();
  }

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
  /**
   * A reference to the group element.
   * @type {HTMLElement}
   */
  let group;
  /**
   * @type {boolean}
   */
  let hiding = false;
  /**
   * @type {boolean}
   */
  let hidden = true;

  /**
   * Move focus to the wrapper once the overlay is loaded.
   */
  const moveFocus = async () => {
    // Wait until `inert` is updated
    await tick();

    group.tabIndex = 0;
    group.focus();
  };

  onMount(() => {
    group = /** @type {HTMLElement} */ (wrapper.querySelector('[role="group"]'));

    group.addEventListener('transitionend', () => {
      if (!$showContentOverlay) {
        hiding = false;
        hidden = true;
        $entryDraft = null;
      }
    });
  });

  $: {
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
  }
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
      position: fixed;
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
