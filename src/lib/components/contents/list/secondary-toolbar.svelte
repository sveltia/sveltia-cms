<script>
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { currentView, entryGroups, listedEntries, sortFields } from '$lib/services/contents/view';

  $: ({ name, label, fields } = $selectedCollection ?? /** @type {Collection} */ ({}));
  $: collectionLabel = label || name;
  $: allEntries = $entryGroups.map(({ entries }) => entries).flat(1);
  $: firstImageField = fields?.find(({ widget }) => widget === 'image');
  $: hasListedEntries = !!$listedEntries.length;
  $: hasMultipleEntries = $listedEntries.length > 1;
</script>

{#if $selectedCollection.folder}
  <Toolbar
    variant="secondary"
    aria-label={$_('x_collection_secondary_toolbar', { values: { collection: collectionLabel } })}
  >
    <Button
      variant="ghost"
      disabled={$selectedEntries.length === allEntries.length}
      label={$_('select_all')}
      on:click={() => {
        $selectedEntries = allEntries;
      }}
    />
    <Button
      variant="ghost"
      disabled={!$selectedEntries.length}
      label={$_('clear_selection')}
      on:click={() => {
        $selectedEntries = [];
      }}
    />
    <Spacer flex />
    <SortMenu
      disabled={!hasMultipleEntries || !$sortFields.length}
      {currentView}
      fields={$sortFields}
    />
    {#if $selectedCollection.view_filters?.length}
      <FilterMenu
        disabled={!hasMultipleEntries}
        {currentView}
        filters={$selectedCollection.view_filters}
        multiple={true}
      />
    {/if}
    {#if $selectedCollection.view_groups?.length}
      <GroupMenu
        disabled={!hasMultipleEntries}
        {currentView}
        groups={$selectedCollection.view_groups}
      />
    {/if}
    <ViewSwitcher disabled={!hasListedEntries || !firstImageField} {currentView} />
    <Divider />
    <Button
      variant="ghost"
      iconic
      disabled={!hasListedEntries || !$selectedCollection.media_folder}
      pressed={!!$currentView?.showMedia}
      aria-label={$_('show_assets')}
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          showMedia: !$currentView?.showMedia,
        }));
      }}
    >
      <Icon slot="start-icon" name="photo_library" />
    </Button>
  </Toolbar>
{/if}
