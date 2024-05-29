<script>
  import { Button, GridBody, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import EntryListItem from '$lib/components/contents/list/entry-list-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { selectedCollection } from '$lib/services/contents';
  import { currentView, entryGroups, listedEntries } from '$lib/services/contents/view';

  $: allEntries = $entryGroups.map(({ entries }) => entries).flat(1);
  $: thumbnailFieldName = $selectedCollection?._thumbnailFieldName;
</script>

<ListContainer aria-label={$selectedCollection?.files ? $_('file_list') : $_('entry_list')}>
  {#if $selectedCollection}
    {#if allEntries.length}
      {@const { defaultLocale } = $selectedCollection._i18n}
      <ListingGrid
        viewType={$currentView.type}
        id="entry-list"
        aria-label={$_('entries')}
        aria-rowcount={$listedEntries.length}
      >
        {#each $entryGroups as { name, entries } (name)}
          <!-- @todo Implement custom table column option that can replace summary template -->
          <GridBody label={name !== '*' ? name : undefined}>
            {#each entries as entry (entry.slug)}
              {@const { locales } = entry}
              {@const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0]}
              {@const { content } = locales[locale]}
              {#if content}
                <EntryListItem
                  {entry}
                  {content}
                  {locale}
                  viewType={$currentView.type}
                  {thumbnailFieldName}
                />
              {/if}
            {/each}
          </GridBody>
        {/each}
      </ListingGrid>
    {:else if $listedEntries.length}
      <EmptyState>
        <span role="none">{$_('no_entries_found')}</span>
      </EmptyState>
    {:else}
      <EmptyState>
        <span role="none">{$_('no_entries_created')}</span>
        <Button
          variant="primary"
          disabled={!$selectedCollection.create}
          label={$_('create_new_entry')}
          on:click={() => {
            goto(`/collections/${$selectedCollection?.name}/new`);
          }}
        >
          <Icon slot="start-icon" name="edit" />
        </Button>
      </EmptyState>
    {/if}
  {:else}
    <EmptyState>
      <span role="none">{$_('collection_not_found')}</span>
    </EmptyState>
  {/if}
</ListContainer>
