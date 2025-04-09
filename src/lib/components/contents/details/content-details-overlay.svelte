<script>
  import { Alert, Button, Group, Toast } from '@sveltia/ui';
  import { onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import BackupFeedback from '$lib/components/contents/details/backup-feedback.svelte';
  import PaneBody from '$lib/components/contents/details/pane-body.svelte';
  import PaneHeader from '$lib/components/contents/details/pane-header.svelte';
  import Toolbar from '$lib/components/contents/details/toolbar.svelte';
  import { isMediumScreen, isSmallScreen } from '$lib/services/app/env';
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

  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalEntry = $derived($entryDraft?.originalEntry);
  const entryId = $derived(
    originalEntry?.id ?? [collection?.name ?? '-', collectionFile?.name ?? '-'].join('/'),
  );
  const { showPreview } = $derived($entryEditorSettings ?? {});
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig,
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const paneStateKey = $derived(
    collectionFile?.name ? [collection?.name, collectionFile.name].join('|') : collection?.name,
  );
  const canCreate = $derived(collection?.create ?? false);
  const limit = $derived(collection?.limit ?? Infinity);
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
    void [showPreview, canPreview, $isSmallScreen, $isMediumScreen];
    switchPanes();
  });

  $effect(() => {
    void [$editorLeftPane, $editorRightPane];
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
      <Toolbar disabled={createDisabled} />
      {#if createDisabled}
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
      {/if}
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
      background-color: var(--sui-secondary-background-color);
      transition: filter 250ms;
    }

    &[inert] > :global(.sui.group) {
      filter: opacity(0);
    }

    .cols {
      flex: auto;
      overflow: hidden;
      display: flex;
      gap: 4px;
      background-color: var(--sui-secondary-background-color); // same as toolbar

      & > :global(div) {
        display: flex;
        flex-direction: column;
        min-width: 480px;
        background-color: var(--sui-primary-background-color);
        transition: all 500ms;

        @media (width < 768px) {
          min-width: auto;
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
