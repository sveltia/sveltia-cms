<script>
  import { Alert, Button, EmptyState, Group, Toast } from '@sveltia/ui';
  import { onMount, tick, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import BackupFeedback from '$lib/components/contents/details/backup-feedback.svelte';
  import PaneBody from '$lib/components/contents/details/pane-body.svelte';
  import PaneHeader from '$lib/components/contents/details/pane-header.svelte';
  import Toolbar from '$lib/components/contents/details/toolbar.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { canCreateEntry } from '$lib/services/contents/collection/entries';
  import { entryDraft } from '$lib/services/contents/draft';
  import {
    resetBackupToastState,
    showBackupToastIfNeeded,
  } from '$lib/services/contents/draft/backup';
  import {
    editorLeftPane,
    editorRightPane,
    showContentOverlay,
    showDuplicateToast,
  } from '$lib/services/contents/editor';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  let restoring = false;

  let hidden = $state(true);
  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {HTMLElement | undefined} */
  let leftPaneContentArea = $state();
  /** @type {HTMLElement | undefined} */
  let rightPaneContentArea = $state();

  const isNew = $derived($entryDraft?.isNew ?? true);
  const collection = $derived($entryDraft?.collection);
  const entryCollection = $derived(collection?._type === 'entry' ? collection : undefined);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const { showPreview } = $derived($entryEditorSettings ?? {});
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const paneStateKey = $derived(
    collectionFile?.name ? [collection?.name, collectionFile.name].join('|') : collection?.name,
  );
  const canCreate = $derived(entryCollection?.create ?? false);
  const limit = $derived(entryCollection?.limit ?? Infinity);
  const createDisabled = $derived(!canCreateEntry(collection));

  /**
   * Restore the pane state from IndexedDB.
   * @returns {Promise<boolean>} Whether the panes are restored.
   */
  const restorePanes = async () => {
    const [_editorLeftPane, _editorRightPane] =
      $entryEditorSettings?.paneStates?.[paneStateKey ?? ''] ?? [];

    if (
      restoring ||
      !_editorLeftPane ||
      !_editorRightPane ||
      (!!_editorLeftPane.locale && !allLocales.includes(_editorLeftPane.locale)) ||
      (!!_editorRightPane.locale && !allLocales.includes(_editorRightPane.locale)) ||
      ((!showPreview || !canPreview) &&
        (_editorLeftPane.mode === 'preview' || _editorRightPane.mode === 'preview'))
    ) {
      return false;
    }

    restoring = true;
    await tick();
    $editorLeftPane = _editorLeftPane;
    $editorRightPane = _editorRightPane;
    await tick();
    restoring = false;

    if ($isSmallScreen || $isMediumScreen) {
      $editorRightPane = null;
    }

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

    if ($isSmallScreen || $isMediumScreen) {
      $editorRightPane = null;
    } else if (!showPreview || !canPreview) {
      const otherLocales = i18nEnabled
        ? allLocales.filter((l) => l !== $editorLeftPane?.locale)
        : [];

      $editorRightPane = otherLocales.length ? { mode: 'edit', locale: otherLocales[0] } : null;
    } else {
      $editorRightPane = { mode: 'preview', locale: $editorLeftPane.locale };
    }
  };

  /**
   * Save the pane state to IndexedDB.
   */
  const savePanes = () => {
    if (!collection || restoring || !$editorLeftPane || !$editorRightPane || !paneStateKey) {
      return;
    }

    entryEditorSettings.update((view = {}) => ({
      ...view,
      paneStates: {
        ...view.paneStates,
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

    if (wrapper) {
      wrapper.tabIndex = 0;
      wrapper.focus();
    }
  };

  onMount(() => {
    wrapper?.addEventListener('transitionend', () => {
      if (!$showContentOverlay) {
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
    void [showPreview, canPreview, $isSmallScreen, $isMediumScreen];

    untrack(() => {
      switchPanes();
    });
  });

  $effect(() => {
    void [$editorLeftPane, $editorRightPane];
    savePanes();
  });

  $effect(() => {
    if (wrapper) {
      if (!$showContentOverlay) {
        showBackupToastIfNeeded();
      } else if (hidden) {
        hidden = false;
        switchPanes();
        moveFocus();
        resetBackupToastState();
      }
    }
  });
</script>

<div
  role="group"
  class="wrapper content-editor"
  {hidden}
  inert={!$showContentOverlay}
  aria-label={$_('content_editor')}
  bind:this={wrapper}
>
  {#key $entryDraft?.createdAt}
    <Toolbar disabled={isNew && createDisabled} />
    {#if !$entryDraft}
      <!-- Hide the content after saving a draft -->
    {:else if isNew && createDisabled}
      <EmptyState>
        <div role="none">
          {#if !canCreate}
            {$_('creating_entries_disabled_by_admin')}
          {:else}
            {$_('creating_entries_disabled_by_limit', { values: { limit } })}
          {/if}
        </div>
        <div role="none">
          <Button
            variant="primary"
            onclick={() => {
              goto(`/collection/${collection?.name}`, {
                replaceState: true,
                transitionType: 'backwards',
              });
            }}
          >
            {$_('back_to_collection')}
          </Button>
        </div>
      </EmptyState>
    {:else}
      <div role="none" class="cols">
        {#if collection}
          {#if $editorLeftPane}
            <!-- Somehow we need a fallback object or we’ll get a property destructuring error -->
            {@const { locale, mode } = $editorLeftPane ?? {}}
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
                bind:thatPaneContentArea={rightPaneContentArea}
              />
            </Group>
          {/if}
          {#if $editorRightPane}
            <!-- Ditto -->
            {@const { locale, mode } = $editorRightPane ?? {}}
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
                bind:thatPaneContentArea={leftPaneContentArea}
              />
            </Group>
          {/if}
        {/if}
      </div>
    {/if}
  {/key}
</div>

<BackupFeedback />

<Toast bind:show={$showDuplicateToast}>
  <Alert status="success">
    {$_('entry_duplicated')}
  </Alert>
</Toast>

<style lang="scss">
  .wrapper {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    background-color: var(--sui-secondary-background-color);
    transition: filter 250ms;

    &[hidden] {
      display: none;
    }

    &[inert] {
      filter: opacity(0);
    }

    .cols {
      flex: auto;
      overflow: hidden;
      display: flex;
      gap: 4px;
      background-color: var(--sui-secondary-background-color); // same as toolbar

      :global {
        & > div {
          display: flex;
          flex-direction: column;
          min-width: 480px;
          background-color: var(--sui-primary-background-color);
          transition: all 500ms;

          &[data-mode='edit'] {
            flex: 1 1;
          }

          &[data-mode='preview'] {
            flex: 2 1;
          }

          @media (width < 768px) {
            min-width: auto;
          }
        }
      }
    }
  }
</style>
