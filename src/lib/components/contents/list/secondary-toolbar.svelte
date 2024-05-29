<script>
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { currentView, entryGroups, listedEntries, sortFields } from '$lib/services/contents/view';

  $: ({
    name: collectionName,
    thumbnail,
    fields,
  } = $selectedCollection ?? /** @type {Collection} */ ({}));
  $: allEntries = $entryGroups.map(({ entries }) => entries).flat(1);
  $: firstImageFieldName = thumbnail ?? fields?.find(({ widget }) => widget === 'image')?.name;
  $: hasListedEntries = !!$listedEntries.length;
  $: hasMultipleEntries = $listedEntries.length > 1;
</script>

{#if $selectedCollection?.folder}
  <Toolbar variant="secondary" aria-label={$_('entry_list')}>
    <Button
      variant="ghost"
      disabled={$selectedEntries.length === allEntries.length}
      label={$_('select_all')}
      aria-controls="entry-list"
      on:click={() => {
        $selectedEntries = allEntries;
      }}
    />
    <Button
      variant="ghost"
      disabled={!$selectedEntries.length}
      label={$_('clear_selection')}
      aria-controls="entry-list"
      on:click={() => {
        $selectedEntries = [];
      }}
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
      disabled={!hasListedEntries || !firstImageFieldName}
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
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          showMedia: !$currentView.showMedia,
        }));
      }}
    >
      <Icon slot="start-icon" name="photo_library" />
    </Button>
  </Toolbar>
{/if}
