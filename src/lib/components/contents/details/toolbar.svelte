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
    Toast,
    Toolbar,
  } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import { deleteEntries } from '$lib/services/contents/data';
  import {
    entryDraft,
    entryEditorSettings,
    revertChanges,
    saveEntry,
  } from '$lib/services/contents/editor';
  import { formatSummary } from '$lib/services/contents/view';
  import { goBack, goto } from '$lib/services/navigation';
  import { truncate } from '$lib/services/utils/strings';

  let showDuplicateToast = false;
  let showValidationToast = false;
  let showDeleteDialog = false;
  let showErrorDialog = false;
  let saving = false;
  /** @type {MenuButton} */
  let menuButton;

  $: ({
    isNew,
    collection,
    collectionFile,
    originalEntry,
    originalLocales,
    currentLocales,
    originalValues,
    currentValues,
  } = $entryDraft ?? /** @type {EntryDraft} */ ({}));

  $: ({ defaultLocale = 'default' } = collection?._i18n ?? /** @type {I18nConfig} */ ({}));
  $: collectionLabel = collection?.label || collection?.name;
  $: collectionLabelSingular = collection?.label_singular || collectionLabel;
  $: canPreview =
    collection?.editor?.preview !== false && collectionFile?.editor?.preview !== false;
  $: modified =
    isNew || !equal(originalLocales, currentLocales) || !equal(originalValues, currentValues);
  $: errorCount = Object.values($entryDraft?.validities ?? [])
    .map((validities) => Object.values(validities).map(({ valid }) => !valid))
    .flat(1)
    .filter(Boolean).length;

  /**
   * Duplicate the current entry.
   */
  const duplicateDraft = async () => {
    showDuplicateToast = true;
    goto(`/collections/${collection?.name}/new`, { replaceState: true, notifyChange: false });
    $entryDraft = { ...$entryDraft, isNew: true, originalEntry: undefined };
  };
</script>

<Toolbar variant="primary" aria-label={$_('primary')}>
  <Button
    variant="ghost"
    iconic
    aria-label={$_('cancel_editing')}
    on:click={() => {
      goBack(`/collections/${collection?.name}`);
    }}
  >
    <Icon slot="start-icon" name="arrow_back_ios_new" />
  </Button>
  <h2 role="none">
    {#if isNew}
      {$_('creating_x', { values: { name: collectionLabelSingular } })}
    {:else}
      {$_('editing_x_in_x', {
        values: {
          collection: collectionLabel,
          entry: collectionFile
            ? collectionFile.label || collectionFile.name
            : truncate(
                formatSummary(collection, originalEntry, defaultLocale, { useTemplate: false }),
                25,
              ),
        },
      })}
    {/if}
  </h2>
  <Spacer flex />
  <MenuButton
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={$_('show_editor_options')}
    bind:this={menuButton}
  >
    <Icon slot="start-icon" name="more_vert" />
    <Menu slot="popup" aria-label={$_('editor_options')}>
      <MenuItemCheckbox
        label={$_('show_preview')}
        checked={$entryEditorSettings.showPreview}
        disabled={!canPreview}
        on:change={() => {
          entryEditorSettings.update((view) => ({
            ...view,
            showPreview: !view.showPreview,
          }));
        }}
      />
      <MenuItemCheckbox
        label={$_('sync_scrolling')}
        checked={$entryEditorSettings.syncScrolling}
        disabled={!canPreview && Object.keys(currentValues).length === 1}
        on:change={() => {
          entryEditorSettings.update((view) => ({
            ...view,
            syncScrolling: !view.syncScrolling,
          }));
        }}
      />
      <Divider />
      <MenuItem
        label={$_('revert_all_changes')}
        disabled={!modified}
        on:click={() => {
          revertChanges();
        }}
      />
      {#if !collectionFile}
        <Divider />
        <MenuItem
          label={$_('duplicate_entry')}
          disabled={collection?.create === false || isNew}
          on:click={() => {
            duplicateDraft();
          }}
        />
        <MenuItem
          disabled={collection?.delete === false || isNew}
          label={$_('delete_entry')}
          on:click={() => {
            showDeleteDialog = true;
          }}
        />
      {/if}
    </Menu>
  </MenuButton>
  <Button
    variant="primary"
    label={$_(saving ? 'saving' : 'save')}
    disabled={!modified || saving}
    keyShortcuts="Accel+S"
    on:click={async () => {
      try {
        saving = true;
        await saveEntry();
        goBack(`/collections/${collection?.name}`);
      } catch (error) {
        if (error.message === 'validation_failed') {
          showValidationToast = true;
        } else {
          showErrorDialog = true;
        }

        // eslint-disable-next-line no-console
        console.error(error);
      } finally {
        saving = false;
      }
    }}
  />
</Toolbar>

<Toast bind:show={showDuplicateToast}>
  <Alert status="success">
    {$_('entry_duplicated')}
  </Alert>
</Toast>

<Toast bind:show={showValidationToast}>
  <Alert status="error">
    {$_(errorCount === 1 ? 'entry_validation_error' : 'entry_validation_errors', {
      values: { count: errorCount },
    })}
  </Alert>
</Toast>

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={$_('delete_entry')}
  okLabel={$_('delete')}
  on:ok={async () => {
    await deleteEntries([originalEntry?.id]);
    goBack(`/collections/${collection?.name}`);
  }}
  on:close={() => {
    menuButton.focus();
  }}
>
  {$_('confirm_deleting_this_entry')}
</ConfirmationDialog>

<!-- @todo make the error message more informative -->
<AlertDialog
  bind:open={showErrorDialog}
  title={$_('saving_entry.error.title')}
  on:close={() => {
    menuButton.focus();
  }}
>
  {$_('saving_entry.error.description')}
</AlertDialog>
