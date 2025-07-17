<script>
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import ItemSelector from '$lib/components/common/page-toolbar/item-selector.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { getAssetFolder } from '$lib/services/assets/folders';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { selectedEntries } from '$lib/services/contents/collection/entries';
  import { currentView, entryGroups, listedEntries } from '$lib/services/contents/collection/view';
  import { sortKeys } from '$lib/services/contents/collection/view/sort-keys';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { EntryCollection } from '$lib/types/private';
   */

  const entryCollection = $derived(
    $selectedCollection?._type === 'entry'
      ? /** @type {EntryCollection} */ ($selectedCollection)
      : undefined,
  );
  const collectionName = $derived(entryCollection?.name);
  const thumbnailFieldNames = $derived(entryCollection?._thumbnailFieldNames ?? []);
  const hasListedEntries = $derived(!!$listedEntries.length);
  const hasMultipleEntries = $derived($listedEntries.length > 1);
</script>

{#if entryCollection}
  <Toolbar variant="secondary" aria-label={$_('entry_list')}>
    {#if !($isSmallScreen || $isMediumScreen)}
      <ItemSelector
        allItems={$entryGroups.map(({ entries }) => entries).flat(1)}
        selectedItems={selectedEntries}
      />
    {/if}
    <Spacer flex />
    <SortMenu
      disabled={!hasMultipleEntries || !$sortKeys.length}
      {currentView}
      sortKeys={$sortKeys}
      {collectionName}
      aria-controls="entry-list"
    />
    {#if entryCollection.view_filters?.length}
      <FilterMenu
        disabled={!hasMultipleEntries}
        {currentView}
        filters={entryCollection.view_filters}
        multiple={true}
        aria-controls="entry-list"
      />
    {/if}
    {#if entryCollection.view_groups?.length}
      <GroupMenu
        disabled={!hasMultipleEntries}
        {currentView}
        groups={entryCollection.view_groups}
        aria-controls="entry-list"
      />
    {/if}
    {#if thumbnailFieldNames.length}
      <ViewSwitcher disabled={!hasListedEntries} {currentView} aria-controls="entry-list" />
    {/if}
    {#if !($isSmallScreen || $isMediumScreen)}
      <Divider orientation="vertical" />
      <Button
        variant="ghost"
        iconic
        disabled={!hasListedEntries || !getAssetFolder({ collectionName })}
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
    {/if}
  </Toolbar>
{/if}
