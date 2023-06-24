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
  import { user } from '$lib/services/auth';
  import { deleteEntries } from '$lib/services/contents/data';
  import {
    entryDraft,
    entryEditorSettings,
    revertChanges,
    saveEntry,
  } from '$lib/services/contents/editor';
  import { goBack } from '$lib/services/navigation';

  let showDeleteDialog = false;
  let showErrorDialog = false;
  let saving = false;

  $: ({ collection, collectionFile, isNew, slug, currentValues, originalValues } = $entryDraft || {
    collection: undefined,
    collectionFile: undefined,
    isNew: undefined,
    slug: undefined,
    currentValues: undefined,
    originalValues: undefined,
  });

  $: collectionLabel = collection.label || collection.name;
  $: collectionLabelSingular = collection.label_singular || collectionLabel;
  $: canPreview =
    collection?.editor?.preview !== false && collectionFile?.editor?.preview !== false;
  $: modified = isNew || !equal(currentValues, originalValues);
</script>

<Toolbar class="primary">
  <Button
    class="ghost iconic"
    on:click={() => {
      goBack(`/collections/${collection.name}`);
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
      <Divider />
      <!-- @todo Implement this!
      <MenuItem
        label={$_('duplicate')}
        disabled={!$entryDraft}
        on:click={() => {
          goto(`/collections/${collection.name}/new`);
        }}
      />
      -->
      <MenuItem
        disabled={collection.delete === false || isNew}
        label={$_('delete')}
        on:click={() => {
          showDeleteDialog = true;
        }}
      />
    </Menu>
  </MenuButton>
  <Button
    class="primary"
    label={saving ? $_('saving') : $_($user?.backendName === 'local' ? 'save' : 'save_and_publish')}
    disabled={!modified || saving}
    on:click={async () => {
      try {
        saving = true;
        await saveEntry();
        goBack(`/collections/${collection.name}`);
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
  bind:open={showDeleteDialog}
  title={$_('delete_entry')}
  okLabel={$_('delete')}
  on:ok={async () => {
    await deleteEntries([slug]);
    goBack(`/collections/${collection.name}`);
  }}
>
  {$_('confirm_deleting_this_entry')}
</Dialog>

<!-- @todo make the error message more informative -->
<Dialog bind:open={showErrorDialog} title={$_('saving_entry.error.title')} showCancel={false}>
  {$_('saving_entry.error.description')}
</Dialog>
