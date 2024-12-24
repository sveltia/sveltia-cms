<script>
  import {
    Alert,
    AlertDialog,
    Button,
    ConfirmationDialog,
    Divider,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    MenuItemCheckbox,
    Spacer,
    SplitButton,
    Toast,
    Toolbar,
  } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import { goBack, goto } from '$lib/services/app/navigation';
  import { backendName } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import { deleteEntries } from '$lib/services/contents/collection/data';
  import { entryDraft } from '$lib/services/contents/draft';
  import { createDraft, duplicateDraft } from '$lib/services/contents/draft/create';
  import { copyFromLocaleToast, entryEditorSettings } from '$lib/services/contents/draft/editor';
  import { saveEntry } from '$lib/services/contents/draft/save';
  import { revertChanges } from '$lib/services/contents/draft/update';
  import { getEntryPreviewURL } from '$lib/services/contents/entry';
  import { getAssociatedAssets } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { defaultI18nConfig, getLocaleLabel } from '$lib/services/contents/i18n';
  import { prefs } from '$lib/services/prefs';

  let showValidationToast = $state(false);
  let showDeleteDialog = $state(false);
  let showErrorDialog = $state(false);
  let saving = $state(false);
  /** @type {any} */
  let menuButton = $state();

  const {
    isNew,
    collection,
    collectionFile,
    originalEntry,
    originalLocales = {},
    originalValues = {},
  } = $derived($entryDraft ?? /** @type {EntryDraft} */ ({}));
  const {
    editor: { preview: showPreviewPane = true } = {},
    backend: { automatic_deployments: autoDeployEnabled = undefined } = {},
  } = $derived($siteConfig ?? /** @type {SiteConfig} */ ({}));
  const showSaveOptions = $derived(
    $backendName !== 'local' && typeof autoDeployEnabled === 'boolean',
  );
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  const collectionName = $derived(collection?.name);
  const collectionLabel = $derived(collection?.label || collectionName);
  const collectionLabelSingular = $derived(collection?.label_singular || collectionLabel);
  const canPreview = $derived((collectionFile ?? collection)?.editor?.preview ?? showPreviewPane);
  const modified = $derived(
    isNew ||
      !equal(originalLocales, $state.snapshot($entryDraft?.currentLocales)) ||
      !equal(originalValues, $state.snapshot($entryDraft?.currentValues)),
  );
  const errorCount = $derived(
    Object.values($entryDraft?.validities ?? {})
      .map((validity) => Object.values(validity).map(({ valid }) => !valid))
      .flat(1)
      .filter(Boolean).length,
  );
  const associatedAssets = $derived(
    !!originalEntry && !!collection._assetFolder?.entryRelative
      ? getAssociatedAssets({ entry: originalEntry, collectionName, relative: true })
      : [],
  );
  const previewURL = $derived(
    originalEntry
      ? getEntryPreviewURL(originalEntry, defaultLocale, collection, collectionFile)
      : undefined,
  );

  /**
   * Save the entry draft.
   * @param {object} [options] - Options.
   * @param {boolean} [options.skipCI] - Whether to disable automatic deployments for the change.
   */
  const save = async ({ skipCI = undefined } = {}) => {
    saving = true;

    try {
      const savedEntry = await saveEntry({ skipCI });

      if ($prefs?.closeOnSave ?? true) {
        goBack(`/collections/${collectionName}`);
        $entryDraft = null;
      } else {
        if (isNew) {
          // Update the URL
          goto(`/collections/${collectionName}/entries/${savedEntry.subPath}`, {
            replaceState: true,
            notifyChange: false,
          });
        }

        // Reset the draft
        createDraft({
          collection,
          collectionFile,
          originalEntry: savedEntry,
          expanderStates: $entryDraft?.expanderStates,
        });
      }
    } catch (/** @type {any} */ ex) {
      if (ex.message === 'validation_failed') {
        showValidationToast = true;
      } else {
        showErrorDialog = true;
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    } finally {
      saving = false;
    }
  };
</script>

<Toolbar variant="primary" aria-label={$_('primary')}>
  <Button
    variant="ghost"
    iconic
    aria-label={$_('cancel_editing')}
    keyShortcuts="Escape"
    onclick={() => {
      goBack(`/collections/${collectionName}`);
    }}
  >
    {#snippet startIcon()}
      <Icon name="arrow_back_ios_new" />
    {/snippet}
  </Button>
  <h2 role="none">
    <strong role="none">
      {#if isNew}
        {$_('creating_x', { values: { name: collectionLabelSingular } })}
      {:else}
        {$_('editing_x_in_x', {
          values: {
            collection: collectionLabel,
            entry: collectionFile
              ? collectionFile.label || collectionFile.name
              : originalEntry
                ? getEntrySummary(collection, originalEntry)
                : '',
          },
        })}
      {/if}
    </strong>
  </h2>
  <Spacer flex />
  {#if previewURL}
    <Button
      variant="tertiary"
      label={$_('view_on_live_site')}
      onclick={() => {
        window.open(previewURL);
      }}
    />
  {/if}
  {#if !collectionFile && !isNew}
    <Button
      variant="ghost"
      label={$_('duplicate')}
      aria-label={$_('duplicate_entry')}
      disabled={collection?.create === false}
      onclick={() => {
        goto(`/collections/${collectionName}/new`, { replaceState: true, notifyChange: false });
        duplicateDraft();
      }}
    />
    <Button
      variant="ghost"
      label={$_('delete')}
      aria-label={$_('delete_entry')}
      disabled={collection?.delete === false}
      onclick={() => {
        showDeleteDialog = true;
      }}
    />
  {/if}
  <MenuButton
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={$_('show_editor_options')}
    bind:this={menuButton}
  >
    {#snippet popup()}
      <Menu aria-label={$_('editor_options')}>
        <MenuItemCheckbox
          label={$_('show_preview')}
          checked={$entryEditorSettings?.showPreview}
          disabled={!canPreview}
          onChange={() => {
            entryEditorSettings.update((view = {}) => ({
              ...view,
              showPreview: !view.showPreview,
            }));
          }}
        />
        <MenuItemCheckbox
          label={$_('sync_scrolling')}
          checked={$entryEditorSettings?.syncScrolling}
          disabled={!canPreview && Object.keys($entryDraft?.currentValues ?? {}).length === 1}
          onChange={() => {
            entryEditorSettings.update((view = {}) => ({
              ...view,
              syncScrolling: !view.syncScrolling,
            }));
          }}
        />
        <Divider />
        <MenuItem
          label={$_('revert_all_changes')}
          disabled={!modified}
          onclick={() => {
            revertChanges();
          }}
        />
      </Menu>
    {/snippet}
  </MenuButton>
  {#if showSaveOptions}
    <SplitButton
      variant="primary"
      label={$_(saving ? 'saving' : 'save')}
      disabled={!modified || saving}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    >
      {#snippet popup()}
        <!-- Show the opposite option: if automatic deployments are enabled, allow to disable it -->
        <Menu>
          <MenuItem
            label={$_(autoDeployEnabled ? 'save_without_publishing' : 'save_and_publish')}
            onclick={() => {
              save({ skipCI: autoDeployEnabled });
            }}
          />
        </Menu>
      {/snippet}
    </SplitButton>
  {:else}
    <Button
      variant="primary"
      label={$_(saving ? 'saving' : 'save')}
      disabled={!modified || saving}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    />
  {/if}
</Toolbar>

<Toast bind:show={showValidationToast}>
  <Alert status="error">
    {$_(errorCount === 1 ? 'entry_validation_error' : 'entry_validation_errors', {
      values: { count: errorCount },
    })}
  </Alert>
</Toast>

<Toast id={$copyFromLocaleToast.id} bind:show={$copyFromLocaleToast.show}>
  {@const { status, message, count, sourceLocale } = $copyFromLocaleToast}
  <Alert {status}>
    {$_(`editor.${message}`, {
      values: { count, source: sourceLocale ? getLocaleLabel(sourceLocale) : '' },
    })}
  </Alert>
</Toast>

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={$_('delete_entry')}
  okLabel={$_('delete')}
  onOk={async () => {
    if (originalEntry) {
      await deleteEntries(
        [originalEntry.id],
        associatedAssets.map(({ path }) => path),
      );
    }

    goBack(`/collections/${collectionName}`);
  }}
  onClose={() => {
    menuButton.focus();
  }}
>
  {$_(
    associatedAssets.length
      ? 'confirm_deleting_this_entry_with_assets'
      : 'confirm_deleting_this_entry',
  )}
</ConfirmationDialog>

<!-- @todo make the error message more informative -->
<AlertDialog
  bind:open={showErrorDialog}
  title={$_('saving_entry.error.title')}
  onClose={() => {
    menuButton.focus();
  }}
>
  {$_('saving_entry.error.description')}
</AlertDialog>
