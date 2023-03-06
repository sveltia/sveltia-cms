<script>
  import { Button, Separator, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import GroupMenu from '$lib/components/common/page-toolbar/group-menu.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { currentView, entryGroups, listedEntries, sortFields } from '$lib/services/contents/view';

  $: firstImageField = $selectedCollection.fields?.find(({ widget }) => widget === 'image');
</script>

{#if $selectedCollection.folder}
  <Toolbar class="secondary">
    <Button
      class="ternary"
      disabled={$selectedEntries.length === Object.values($entryGroups).flat(1).length}
      label={$_('select_all')}
      on:click={() => {
        $selectedEntries = Object.values($entryGroups).flat(1);
      }}
    />
    <Button
      class="ternary"
      disabled={!$selectedEntries.length}
      label={$_('clear_selection')}
      on:click={() => {
        $selectedEntries = [];
      }}
    />
    <Spacer flex={true} />
    <SortMenu
      disabled={!$listedEntries.length || !$sortFields.length}
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
        disabled={!$listedEntries.length}
        {currentView}
        filters={$selectedCollection.view_filters}
      />
    {/if}
    {#if $selectedCollection.view_groups?.length}
      <GroupMenu
        disabled={!$listedEntries.length}
        {currentView}
        groups={$selectedCollection.view_groups}
      />
    {/if}
    <ViewSwitcher disabled={!$listedEntries.length || !firstImageField} {currentView} />
    <Separator />
    <Button
      class="ternary iconic"
      disabled={!$selectedCollection.media_folder}
      pressed={!!$currentView?.showMedia}
      iconName="photo_library"
      iconLabel={$_('show_assets')}
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          showMedia: !$currentView?.showMedia,
        }));
      }}
    />
  </Toolbar>
{/if}
