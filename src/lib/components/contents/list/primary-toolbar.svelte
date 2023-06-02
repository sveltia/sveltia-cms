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
  } = $selectedCollection || {
    name: undefined,
    label: undefined,
    description: undefined,
    files: undefined,
    create: false,
    delete: true,
  });
</script>

{#if $selectedCollection}
  <Toolbar class="primary">
    <h2>{label || ''}</h2>
    <div class="description">{description || ''}</div>
    {#if !files}
      <Button
        class="secondary"
        label={$_('delete')}
        disabled={!$selectedEntries.length || !canDelete}
        on:click={() => {
          showDeleteDialog = true;
        }}
      >
        <Icon slot="start-icon" name="delete" />
      </Button>
      <Button
        class="primary"
        disabled={!create}
        label={$_('create')}
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
    font-size: var(--font-size--small);
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
