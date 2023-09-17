<script>
  import { TableCell, TableRow } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import BasicListView from '$lib/components/common/basic-list-view.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { selectedCollection } from '$lib/services/contents';
  import { goto } from '$lib/services/navigation';
</script>

<div class="list-container">
  {#if $selectedCollection.files?.length}
    <BasicListView>
      {#each $selectedCollection.files as { name, label } (name)}
        <TableRow
          on:click={() => {
            goto(`/collections/${$selectedCollection.name}/entries/${name}`);
          }}
        >
          <TableCell class="title">
            {label}
          </TableCell>
        </TableRow>
      {/each}
    </BasicListView>
  {:else}
    <EmptyState>
      <span>{$_('no_files_found')}</span>
    </EmptyState>
  {/if}
</div>

<style lang="scss">
  .list-container {
    padding: 16px;
  }
</style>
