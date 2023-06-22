<script>
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { currentView, entryGroups, listedEntries, sortFields } from '$lib/services/contents/view';

  $: allEntries = $entryGroups.map(({ entries }) => entries).flat(1);
  $: firstImageField = $selectedCollection.fields?.find(({ widget }) => widget === 'image');
  $: hasListedEntries = !!$listedEntries.length;
</script>

{#if $selectedCollection.folder}
  <Toolbar class="secondary">
    <Button
      class="ghost"
      disabled={$selectedEntries.length === allEntries.length}
      label={$_('select_all')}
      on:click={() => {
        $selectedEntries = allEntries;
      }}
    />
    <Button
      class="ghost"
      disabled={!$selectedEntries.length}
      label={$_('clear_selection')}
      on:click={() => {
        $selectedEntries = [];
      }}
    />
    <Spacer flex={true} />
    <SortMenu
      disabled={!hasListedEntries || !$sortFields.length}
      {currentView}
      fields={$sortFields.map((key) => ({
        key,
        label:
          $selectedCollection.fields?.find(({ name }) => name === key)?.label ||
          $_(`sort_keys.${key}`),
      }))}
    />
    {#if $selectedCollection.view_filters?.length}
      <FilterMenu
        disabled={!hasListedEntries}
        {currentView}
        filters={$selectedCollection.view_filters}
      />
    {/if}
    {#if $selectedCollection.view_groups?.length}
      <GroupMenu
        disabled={!hasListedEntries}
        {currentView}
        groups={$selectedCollection.view_groups}
      />
    {/if}
    <ViewSwitcher disabled={!hasListedEntries || !firstImageField} {currentView} />
    <Divider />
    <Button
      class="ghost iconic"
      disabled={!hasListedEntries || !$selectedCollection.media_folder}
      pressed={!!$currentView?.showMedia}
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          showMedia: !$currentView?.showMedia,
        }));
      }}
    >
      <Icon slot="start-icon" name="photo_library" label={$_('show_assets')} />
    </Button>
  </Toolbar>
{/if}
