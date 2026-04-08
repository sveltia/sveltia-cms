<script>
  import { _ } from '@sveltia/i18n';
  import {
    Alert,
    Button,
    EmptyState,
    Group,
    ResizableHandle,
    ResizablePane,
    ResizablePaneGroup,
    Spacer,
    Toast,
  } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { onMount, tick, untrack } from 'svelte';

  import BackupFeedback from '$lib/components/contents/details/backup-feedback.svelte';
  import PaneBody from '$lib/components/contents/details/pane-body.svelte';
  import PaneHeader from '$lib/components/contents/details/pane-header.svelte';
  import Sidebar from '$lib/components/contents/details/sidebar/sidebar.svelte';
  import Toolbar from '$lib/components/contents/details/toolbar.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { collectionState } from '$lib/services/contents/collection/view';
  import { entryDraft, entryDraftInteracted } from '$lib/services/contents/draft';
  import {
    resetBackupToastState,
    showBackupToastIfNeeded,
  } from '$lib/services/contents/draft/backup';
  import {
    editorFirstPane,
    editorSecondPane,
    MIN_PANE_SIZE,
    showContentOverlay,
    showDuplicateToast,
  } from '$lib/services/contents/editor';
  import { getExpanderKeys, syncExpanderStates } from '$lib/services/contents/editor/expanders';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   * @import { FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string | undefined} [editorLocale] The locale to open the editor in.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    editorLocale = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let restoring = false;
  let switching = false;

  let hidden = $state(true);
  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {HTMLElement | undefined} */
  let firstPaneContentArea = $state();
  /** @type {HTMLElement | undefined} */
  let secondPaneContentArea = $state();

  const notFound = $derived($entryDraft === undefined);
  const {
    isNew = true,
    canPreview = true,
    collection,
    collectionName,
    collectionFile,
    fileName,
    isIndexFile,
    currentValues,
  } = $derived(/** @type {EntryDraft} */ ($entryDraft ?? {}));
  const { showPreview } = $derived($entryEditorSettings ?? {});
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const paneStateKey = $derived(
    collectionFile?.name ? [collection?.name, collectionFile.name].join('|') : collection?.name,
  );
  const { canCreate, quota, creationDisabled } = $derived($collectionState);

  const [firstPaneSize, secondPaneSize, minPaneSize] = $derived.by(() => {
    if (!$editorFirstPane && !$editorSecondPane) {
      return [0, 0, 0];
    }

    if (!$editorFirstPane || !$editorSecondPane) {
      return [$editorFirstPane ? 100 : 0, $editorSecondPane ? 100 : 0, 0];
    }

    if (
      typeof $editorFirstPane.width === 'number' &&
      typeof $editorSecondPane.width === 'number' &&
      $editorFirstPane.width >= MIN_PANE_SIZE &&
      $editorSecondPane.width >= MIN_PANE_SIZE &&
      $editorFirstPane.width + $editorSecondPane.width === 100
    ) {
      return [$editorFirstPane.width, $editorSecondPane.width, MIN_PANE_SIZE];
    }

    return [50, 50, MIN_PANE_SIZE];
  });

  /**
   * Restore the pane state from IndexedDB.
   * @returns {Promise<boolean>} Whether the panes are restored.
   */
  const restorePanes = async () => {
    let [_editorFirstPane, _editorSecondPane] =
      $entryEditorSettings?.paneStates?.[paneStateKey ?? ''] ?? [];

    // Override the locale if specified
    if (editorLocale) {
      _editorFirstPane = { mode: 'edit', locale: editorLocale };
      _editorSecondPane = { mode: 'preview', locale: editorLocale };
    }

    if (
      restoring ||
      !_editorFirstPane ||
      !_editorSecondPane ||
      (!!_editorFirstPane.locale && !allLocales.includes(_editorFirstPane.locale)) ||
      (!!_editorSecondPane.locale && !allLocales.includes(_editorSecondPane.locale)) ||
      ((!showPreview || !canPreview) &&
        (_editorFirstPane.mode === 'preview' || _editorSecondPane.mode === 'preview')) ||
      // If there are only 2 locales and the first pane is not in the default locale, don’t restore
      // the panes so that the default locale is always shown in the first pane
      (allLocales.length === 2 && _editorFirstPane.locale !== defaultLocale)
    ) {
      return false;
    }

    restoring = true;
    await tick();
    $editorFirstPane = _editorFirstPane;
    $editorSecondPane = $isSmallScreen || $isMediumScreen ? null : _editorSecondPane;
    await tick();
    restoring = false;

    return true;
  };

  /**
   * Hide the preview pane if it’s disabled by the user or the collection/file.
   */
  const switchPanes = async () => {
    if (!$entryDraft || switching) {
      return;
    }

    switching = true;

    if (await restorePanes()) {
      switching = false;

      return;
    }

    $editorFirstPane = { mode: 'edit', locale: $editorFirstPane?.locale ?? defaultLocale };

    if ($isSmallScreen || $isMediumScreen) {
      $editorSecondPane = null;
    } else if (!showPreview || !canPreview) {
      const otherLocales = i18nEnabled
        ? allLocales.filter((l) => l !== $editorFirstPane?.locale)
        : [];

      $editorSecondPane = otherLocales.length ? { mode: 'edit', locale: otherLocales[0] } : null;
    } else {
      $editorSecondPane = { mode: 'preview', locale: $editorFirstPane.locale };
    }

    switching = false;
  };

  /**
   * Save the pane state to IndexedDB.
   */
  const savePanes = () => {
    if (!collection || restoring || !$editorFirstPane || !$editorSecondPane || !paneStateKey) {
      return;
    }

    entryEditorSettings.update((view = {}) => ({
      ...view,
      paneStates: {
        ...view.paneStates,
        [paneStateKey]: [$editorFirstPane, $editorSecondPane],
      },
    }));
  };

  /**
   * Mark the draft as manually interacted when the user performs an action in the editor body.
   * @param {Event} event DOM event.
   */
  const markInteracted = (event) => {
    if (event.isTrusted && !$entryDraftInteracted) {
      $entryDraftInteracted = true;
    }
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

  /**
   * Ensure the given locale’s edit pane is visible, switching panes if needed.
   * @param {InternalLocaleCode} locale Locale code.
   */
  const ensureEditPaneVisible = async (locale) => {
    const firstPane = $editorFirstPane;
    const secondPane = $editorSecondPane;

    // Already visible in an edit pane
    if (
      (firstPane?.mode === 'edit' && firstPane.locale === locale) ||
      (secondPane?.mode === 'edit' && secondPane.locale === locale)
    ) {
      return;
    }

    // Prefer switching a preview pane to edit mode for the target locale
    if (secondPane?.mode === 'preview') {
      $editorSecondPane = { mode: 'edit', locale };
    } else if (firstPane?.mode === 'preview') {
      $editorFirstPane = { mode: 'edit', locale };
    } else if (secondPane) {
      // Both are edit panes for other locales; switch the second one
      $editorSecondPane = { mode: 'edit', locale };
    } else {
      // Single-pane layout
      $editorFirstPane = { mode: 'edit', locale };
    }

    // Wait for the DOM to update after the pane switch
    await sleep(100);
  };

  /**
   * Highlight the corresponding editor field by expanding the parent list/object(s), moving the
   * element into the viewport, and focus any control within the field, such as a text input or
   * button.
   * @param {object} args Arguments.
   * @param {InternalLocaleCode} args.locale Locale code.
   * @param {FieldKeyPath} args.keyPath Key path of the field.
   */
  const highlightEditorField = async ({ locale, keyPath }) => {
    await ensureEditPaneVisible(locale);

    const valueMap = currentValues?.[locale] ?? {};

    const expanderKeys = getExpanderKeys({
      collectionName,
      fileName,
      valueMap,
      keyPath,
      isIndexFile,
    });

    syncExpanderStates(Object.fromEntries(expanderKeys.map((key) => [key, true])));

    window.requestAnimationFrame(() => {
      const targetField = document.querySelector(
        `.content-editor .pane[data-mode="edit"][data-locale="${CSS.escape(locale)}"] ` +
          `.field[data-key-path="${CSS.escape(keyPath)}"]`,
      );

      if (targetField) {
        if (typeof targetField.scrollIntoViewIfNeeded === 'function') {
          targetField.scrollIntoViewIfNeeded();
        } else {
          targetField.scrollIntoView();
        }

        const widgetWrapper = targetField.querySelector('.field-wrapper');

        /** @type {HTMLElement | null} */ (
          widgetWrapper?.querySelector('[contenteditable="true"], [tabindex="0"]') ??
            widgetWrapper?.querySelector('input, textarea, button')
        )?.focus();
      }
    });
  };

  /**
   * Called when a message event is received. If the event is a highlight event, calls
   * {@link highlightEditorField} with the event payload.
   * @param {MessageEvent} event The message event.
   */
  const onmessage = (event) => {
    if (event.data?.type === 'highlight-editor-field' && event.data.payload) {
      highlightEditorField(event.data.payload);
    }
  };

  onMount(() => {
    if (!$showContentOverlay) {
      $entryDraft = null;
    }

    window.addEventListener('message', onmessage);

    return () => {
      window.removeEventListener('message', onmessage);
    };
  });

  $effect(() => {
    if (paneStateKey) {
      // Reset the editor panes
      $editorFirstPane = null;
      $editorSecondPane = null;
    }
  });

  $effect(() => {
    void [collection, showPreview, canPreview, $isSmallScreen, $isMediumScreen];

    untrack(() => {
      switchPanes();
    });
  });

  $effect(() => {
    void [$editorFirstPane, $editorSecondPane];
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

{#snippet firstPane()}
  {#if $editorFirstPane}
    {@const { locale, mode } = $editorFirstPane}
    <div class="pane-wrapper">
      <Group
        class="pane"
        aria-label={_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
          values: { locale: getLocaleLabel(locale) ?? locale },
        })}
        data-locale={locale}
        data-mode={mode}
      >
        <PaneHeader id="first-pane-header" thisPane={editorFirstPane} thatPane={editorSecondPane} />
        <PaneBody
          id="first-pane-body"
          thisPane={editorFirstPane}
          bind:thisPaneContentArea={firstPaneContentArea}
          bind:thatPaneContentArea={secondPaneContentArea}
        />
      </Group>
    </div>
  {/if}
{/snippet}

{#snippet secondPane()}
  {#if $editorSecondPane}
    {@const { locale, mode } = $editorSecondPane}
    <div class="pane-wrapper">
      <Group
        class="pane"
        aria-label={_(mode === 'edit' ? 'edit_x_locale' : 'preview_x_locale', {
          values: { locale: getLocaleLabel(locale) ?? locale },
        })}
        data-locale={locale}
        data-mode={mode}
      >
        <PaneHeader
          id="second-pane-header"
          thisPane={editorSecondPane}
          thatPane={editorFirstPane}
        />
        <PaneBody
          id="second-pane-body"
          thisPane={editorSecondPane}
          bind:thisPaneContentArea={secondPaneContentArea}
          bind:thatPaneContentArea={firstPaneContentArea}
        />
      </Group>
    </div>
  {/if}
{/snippet}

<div
  role="group"
  class="wrapper content-editor"
  aria-label={_('content_editor')}
  bind:this={wrapper}
>
  {#key $entryDraft?.id}
    <Toolbar disabled={isNew && creationDisabled} />
    {#if $entryDraft === null}
      <!-- Hide the content after saving a draft -->
    {:else if notFound || (isNew && creationDisabled)}
      <EmptyState>
        <div role="none">
          {#if notFound}
            {_('entry_not_found')}
          {:else if !canCreate}
            {_('creating_entries_disabled_by_admin')}
          {:else}
            {_('creating_entries_disabled_by_quota', { values: { quota } })}
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
            {_('back_to_collection')}
          </Button>
        </div>
      </EmptyState>
    {:else}
      <div role="none" class="body" onpointerdown={markInteracted} onkeydown={markInteracted}>
        {#key `${collectionName}|${fileName}|${isIndexFile}`}
          <div role="none" class="content-area">
            {#if $editorFirstPane && $editorSecondPane}
              {#if firstPaneSize && secondPaneSize}
                <ResizablePaneGroup
                  onResize={({ sizes }) => {
                    if ($editorFirstPane && $editorSecondPane) {
                      [$editorFirstPane.width, $editorSecondPane.width] = sizes;
                    }
                  }}
                >
                  <ResizablePane defaultSize={firstPaneSize} minSize={minPaneSize}>
                    {@render firstPane()}
                  </ResizablePane>
                  <ResizableHandle />
                  <ResizablePane defaultSize={secondPaneSize} minSize={minPaneSize}>
                    {@render secondPane()}
                  </ResizablePane>
                </ResizablePaneGroup>
              {/if}
            {:else if $editorFirstPane}
              {@render firstPane()}
            {:else if $editorSecondPane}
              {@render secondPane()}
            {:else}
              <Spacer flex />
            {/if}
          </div>
          <!-- @todo Enable sidebar for mobile -->
          {#if !$isSmallScreen}
            <Sidebar />
          {/if}
        {/key}
      </div>
    {/if}
  {/key}
</div>

<BackupFeedback />

<Toast bind:show={$showDuplicateToast}>
  <Alert status="success">
    {_('entry_duplicated')}
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
  }

  .pane-wrapper {
    display: contents;

    :global {
      & > .pane {
        flex: auto;
        height: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
    }
  }

  .body {
    flex: auto;
    display: flex;
    overflow: hidden;
  }

  .content-area {
    flex: auto;
    background-color: var(--sui-primary-background-color);

    &:not(:only-child) {
      border-start-end-radius: 16px; // sidebar is present
    }

    :global {
      .sui.resizable-handle {
        background-color: var(--sui-secondary-background-color); // same as toolbar
      }
    }
  }
</style>
