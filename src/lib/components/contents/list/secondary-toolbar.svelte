<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';

  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import ItemSelector from '$lib/components/common/page-toolbar/item-selector.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { getAssetFolder } from '$lib/services/assets/folders';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import {
    currentView,
    entryGroups,
    listedEntries,
    listedUnpublishedEntries,
    reordering,
  } from '$lib/services/contents/collection/view';
  import { viewFilters } from '$lib/services/contents/collection/view/filter';
  import { viewGroups } from '$lib/services/contents/collection/view/group';
  import { sortKeys } from '$lib/services/contents/collection/view/sort-keys';
  import { env } from '$lib/services/user/env.svelte';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { InternalEntryCollection } from '$lib/types/private';
   */

  const entryCollection = $derived(
    selectedCollection.current?._type === 'entry'
      ? /** @type {InternalEntryCollection} */ (selectedCollection.current)
      : undefined,
  );
  const collectionName = $derived(entryCollection?.name);
  const thumbnailFieldNames = $derived(entryCollection?._thumbnailFieldNames ?? []);
  // The unpublished entries are listed in their own group above the published ones, so they count
  // towards the list total as well
  const listedEntryCount = $derived(
    listedEntries.current.length + listedUnpublishedEntries.current.length,
  );
  const hasListedEntries = $derived(!!listedEntryCount);
  const hasMultipleEntries = $derived(listedEntryCount > 1);
</script>

{#if entryCollection && !reordering.current}
  <Toolbar variant="secondary" aria-label={_('entry_list')}>
    {#if !(env.isSmallScreen || env.isMediumScreen) && !openAuthoring.current}
      <ItemSelector
        allItems={[
          ...listedUnpublishedEntries.current,
          ...entryGroups.current.flatMap(({ entries }) => entries),
        ]}
        selectedItems={selectedEntries}
      />
    {/if}
    <Spacer flex />
    <SortMenu
      disabled={!hasMultipleEntries || !sortKeys.current.length}
      {currentView}
      sortKeys={sortKeys.current}
      {collectionName}
      aria-controls="entry-list"
    />
    {#if viewFilters.current?.length}
      <FilterMenu
        disabled={!hasMultipleEntries}
        {currentView}
        filters={viewFilters.current}
        multiple={true}
        aria-controls="entry-list"
      />
    {/if}
    {#if viewGroups.current?.length}
      <GroupMenu
        disabled={!hasMultipleEntries}
        {currentView}
        groups={viewGroups.current}
        aria-controls="entry-list"
      />
    {/if}
    {#if thumbnailFieldNames.length}
      <ViewSwitcher disabled={!hasListedEntries} {currentView} aria-controls="entry-list" />
    {/if}
    {#if !(env.isSmallScreen || env.isMediumScreen)}
      <Divider orientation="vertical" />
      <Button
        variant="ghost"
        iconic
        disabled={!hasListedEntries || !getAssetFolder({ collectionName })}
        pressed={!!currentView.current.showMedia}
        aria-controls="collection-assets"
        aria-expanded={currentView.current.showMedia}
        aria-label={_(currentView.current.showMedia ? 'hide_assets' : 'show_assets')}
        onclick={() => {
          currentView.current = {
            ...currentView.current,
            showMedia: !currentView.current.showMedia,
          };
        }}
      >
        {#snippet startIcon()}
          <Icon name="photo_library" />
        {/snippet}
      </Button>
    {/if}
  </Toolbar>
{/if}
