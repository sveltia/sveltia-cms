<script>
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import ItemSelector from '$lib/components/common/page-toolbar/item-selector.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import {
    currentView,
    entryGroups,
    listedEntries,
    sortFields,
  } from '$lib/services/contents/collection/view';

  const { name: collectionName, _thumbnailFieldName } = $derived(
    $selectedCollection?._type === 'entry'
      ? /** @type {EntryCollection} */ ($selectedCollection)
      : /** @type {EntryCollection} */ ({}),
  );
  const hasListedEntries = $derived(!!$listedEntries.length);
  const hasMultipleEntries = $derived($listedEntries.length > 1);
</script>

{#if $selectedCollection?._type === 'entry'}
  <Toolbar variant="secondary" aria-label={$_('entry_list')}>
    <ItemSelector
      allItems={$entryGroups.map(({ entries }) => entries).flat(1)}
      selectedItems={selectedEntries}
    />
    <Spacer flex />
    <SortMenu
      disabled={!hasMultipleEntries || !$sortFields.length}
      {currentView}
      fields={$sortFields}
      {collectionName}
      aria-controls="entry-list"
    />
    {#if $selectedCollection.view_filters?.length}
      <FilterMenu
        disabled={!hasMultipleEntries}
        {currentView}
        filters={$selectedCollection.view_filters}
        multiple={true}
        aria-controls="entry-list"
      />
    {/if}
    {#if $selectedCollection.view_groups?.length}
      <GroupMenu
        disabled={!hasMultipleEntries}
        {currentView}
        groups={$selectedCollection.view_groups}
        aria-controls="entry-list"
      />
    {/if}
    <ViewSwitcher
      disabled={!hasListedEntries || !_thumbnailFieldName}
      {currentView}
      aria-controls="entry-list"
    />
    <Divider orientation="vertical" />
    <Button
      variant="ghost"
      iconic
      disabled={!hasListedEntries || !$selectedCollection._assetFolder}
      pressed={!!$currentView.showMedia}
      aria-controls="collection-assets"
      aria-expanded={$currentView.showMedia}
      aria-label={$_($currentView.showMedia ? 'hide_assets' : 'show_assets')}
      onclick={() => {
        currentView.update((view) => ({
          ...view,
          showMedia: !$currentView.showMedia,
        }));
      }}
    >
      {#snippet startIcon()}
        <Icon name="photo_library" />
      {/snippet}
    </Button>
  </Toolbar>
{/if}
