<script>
  import {
    Button,
    Dialog,
    Divider,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    MenuItemCheckbox,
    Spacer,
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
  import { goBack, goto } from '$lib/services/navigation';
  import { sleep } from '$lib/services/utils/misc';

  let showDuplicateDialog = false;
  let showDeleteDialog = false;
  let showErrorDialog = false;
  let saving = false;

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

  $: collectionLabel = collection?.label || collection?.name;
  $: collectionLabelSingular = collection?.label_singular || collectionLabel;
  $: canPreview =
    collection?.editor?.preview !== false && collectionFile?.editor?.preview !== false;
  $: modified =
    isNew || !equal(originalLocales, currentLocales) || !equal(originalValues, currentValues);

  /**
   * Duplicate the current entry.
   * @todo Replace the dialog with a toast notification.
   */
  const duplicateDraft = async () => {
    showDuplicateDialog = true;
    goto(`/collections/${collection?.name}/new`, { replaceState: true, notifyChange: false });
    $entryDraft = { ...$entryDraft, isNew: true, originalEntry: undefined };
    await sleep(1000);
    showDuplicateDialog = false;
  };
</script>

<Toolbar class="primary">
  <Button
    class="ghost iconic"
    on:click={() => {
      goBack(`/collections/${collection?.name}`);
    }}
  >
    <Icon slot="start-icon" name="arrow_back_ios_new" label={$_('cancel')} />
  </Button>
  <h2>
    {#if isNew}
      {$_('creating_x', { values: { name: collectionLabelSingular } })}
    {:else}
      {$_('editing_x', {
        values: {
          name: collectionFile
            ? `${collectionLabel} » ${collectionFile.label}`
            : collectionLabelSingular,
        },
      })}
    {/if}
  </h2>
  <Spacer flex={true} />
  <MenuButton class="ghost iconic" popupPosition="bottom-right">
    <Icon slot="start-icon" name="more_vert" label={$_('show_menu')} />
    <Menu slot="popup">
      <MenuItemCheckbox
        label={$_('show_preview')}
        checked={$entryEditorSettings.showPreview}
        disabled={!canPreview}
        on:click={() => {
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
        on:click={() => {
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
          label={$_('duplicate')}
          disabled={collection?.create === false || isNew}
          on:click={() => {
            duplicateDraft();
          }}
        />
        <MenuItem
          disabled={collection?.delete === false || isNew}
          label={$_('delete')}
          on:click={() => {
            showDeleteDialog = true;
          }}
        />
      {/if}
    </Menu>
  </MenuButton>
  <Button
    class="primary"
    label={$_(saving ? 'saving' : 'save')}
    disabled={!modified || saving}
    keyShortcuts="Accel+S"
    on:click={async () => {
      try {
        saving = true;
        await saveEntry();
        goBack(`/collections/${collection?.name}`);
      } catch (error) {
        if (error.message !== 'validation_failed') {
          showErrorDialog = true;

          // eslint-disable-next-line no-console
          console.error(error);
        }
      } finally {
        saving = false;
      }
    }}
  />
</Toolbar>

<Dialog
  bind:open={showDuplicateDialog}
  showOk={false}
  showCancel={false}
  showClose={false}
  closeOnBackdropClick={true}
  style="text-align:center"
>
  {$_('entry_duplicated')}
</Dialog>

<Dialog
  bind:open={showDeleteDialog}
  title={$_('delete_entry')}
  okLabel={$_('delete')}
  on:ok={async () => {
    await deleteEntries([originalEntry?.id]);
    goBack(`/collections/${collection?.name}`);
  }}
>
  {$_('confirm_deleting_this_entry')}
</Dialog>

<!-- @todo make the error message more informative -->
<Dialog bind:open={showErrorDialog} title={$_('saving_entry.error.title')} showCancel={false}>
  {$_('saving_entry.error.description')}
</Dialog>
