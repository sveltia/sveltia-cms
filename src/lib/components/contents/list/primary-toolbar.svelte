<script>
  import { Button, Icon, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteEntriesDialog from '$lib/components/contents/shared/delete-entries-dialog.svelte';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';

  let showDeleteDialog = false;

  $: ({
    name,
    label,
    description,
    files,
    create = false,
    delete: canDelete = true,
  } = $selectedCollection ?? /** @type {Collection} */ ({}));
  $: collectionLabel = label || name;
</script>

{#if $selectedCollection}
  <Toolbar
    variant="primary"
    aria-label={$_('x_collection_primary_toolbar', { values: { collection: collectionLabel } })}
  >
    <h2>{collectionLabel}</h2>
    <div class="description">{description || ''}</div>
    {#if !files}
      <Button
        variant="secondary"
        label={$_('delete')}
        aria-label={$selectedEntries.length === 1
          ? $_('delete_selected_entry')
          : $_('delete_selected_entries')}
        disabled={!$selectedEntries.length || !canDelete}
        on:click={() => {
          showDeleteDialog = true;
        }}
      >
        <Icon slot="start-icon" name="delete" />
      </Button>
      <Button
        variant="primary"
        disabled={!create}
        label={$_('create')}
        aria-label={$_('create_new_entry')}
        keyShortcuts="Accel+E"
        on:click={() => {
          goto(`/collections/${name}/new`);
        }}
      >
        <Icon slot="start-icon" name="edit" />
      </Button>
    {/if}
  </Toolbar>
{/if}

<DeleteEntriesDialog bind:open={showDeleteDialog} />

<style lang="scss">
  .description {
    flex: auto;
    font-size: var(--sui-font-size-small);
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
