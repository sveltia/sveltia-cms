<script>
  import { Button, Toolbar } from '@sveltia/ui';
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
  } = $selectedCollection || {});
</script>

{#if $selectedCollection}
  <Toolbar class="primary">
    <h2>{label || ''}</h2>
    <div class="description">{description || ''}</div>
    {#if !files}
      <Button
        class="secondary"
        iconName="delete"
        label={$_('delete')}
        disabled={!$selectedEntries.length || !canDelete}
        on:click={() => {
          showDeleteDialog = true;
        }}
      />
      <Button
        class="primary"
        disabled={!create}
        iconName="edit"
        label={$_('create')}
        on:click={() => {
          goto(`/collections/${name}/new`);
        }}
      />
    {/if}
  </Toolbar>
{/if}

<DeleteEntriesDialog bind:open={showDeleteDialog} />

<style lang="scss">
  .description {
    flex: auto;
    font-size: 12px;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
