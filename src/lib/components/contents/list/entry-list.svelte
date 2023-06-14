<script>
  import { Button, Group, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import BasicGridView from '$lib/components/common/basic-grid-view.svelte';
  import BasicListView from '$lib/components/common/basic-list-view.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import EntryListItem from '$lib/components/contents/list/entry-list-item.svelte';
  import { selectedCollection } from '$lib/services/contents';
  import { currentView, entryGroups, listedEntries } from '$lib/services/contents/view';
  import { goto } from '$lib/services/navigation';

  $: allEntries = $entryGroups.map(({ entries }) => entries).flat(1);
</script>

<div class="list-container">
  {#if $selectedCollection}
    {#if allEntries.length}
      {@const { defaultLocale = 'default' } = $selectedCollection._i18n}
      {#each $entryGroups as { name, entries } (name)}
        <Group>
          {#if name !== '*'}
            <h3>{name}</h3>
          {/if}
          <!-- @todo Implement custom table column option that can replace summary template -->
          <svelte:component this={$currentView.type === 'grid' ? BasicGridView : BasicListView}>
            {#each entries as entry (entry.slug)}
              {@const { content } = entry.locales[defaultLocale] || {}}
              {#if content}
                <EntryListItem {entry} {content} />
              {/if}
            {/each}
          </svelte:component>
        </Group>
      {/each}
    {:else if $listedEntries.length}
      <EmptyState>
        <span>{$_('no_entries_found')}</span>
      </EmptyState>
    {:else}
      <EmptyState>
        <span>{$_('no_entries_created')}</span>
        <Button
          class="primary"
          disabled={!$selectedCollection.create}
          label={$_('create_new_entry')}
          on:click={() => {
            goto(`/collections/${$selectedCollection.name}/new`);
          }}
        >
          <Icon slot="start-icon" name="edit" />
        </Button>
      </EmptyState>
    {/if}
  {:else}
    <EmptyState>
      <span>{$_('collection_not_found')}</span>
    </EmptyState>
  {/if}
</div>

<style lang="scss">
  h3 {
    padding: 8px;
    color: var(--secondary-foreground-color);
    background-color: var(--secondary-background-color);

    & + :global(.basic-grid-view .table) {
      margin: 16px 0;
    }
  }
</style>
