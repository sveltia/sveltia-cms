<script>
  import { Button, Separator, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { assetKinds, selectedAssets } from '$lib/services/assets';
  import { assetGroups, currentView, listedAssets, sortFields } from '$lib/services/assets/view';
  import { selectedCollection } from '$lib/services/contents';
</script>

{#if !$selectedCollection.files}
  <Toolbar class="secondary">
    <Button
      class="ternary"
      disabled={$selectedAssets.length === Object.values($assetGroups).flat(1).length}
      label={$_('select_all')}
      on:click={() => {
        $selectedAssets = Object.values($assetGroups).flat(1);
      }}
    />
    <Button
      class="ternary"
      disabled={!$selectedAssets.length}
      label={$_('clear_selection')}
      on:click={() => {
        $selectedAssets = [];
      }}
    />
    <Spacer flex={true} />
    <SortMenu
      disabled={!$listedAssets.length}
      {currentView}
      fields={$sortFields.map((key) => ({ key, label: $_(`sort_keys.${key}`) }))}
    />
    <FilterMenu
      label={$_('file_type')}
      disabled={!$listedAssets.length}
      {currentView}
      noneLabel={$_('all')}
      filters={assetKinds.map((type) => ({ label: $_(type), field: 'fileType', pattern: type }))}
    />
    <ViewSwitcher disabled={!$listedAssets.length} {currentView} />
    <Separator />
    <Button
      class="ternary iconic"
      disabled={!$listedAssets.length}
      pressed={!!$currentView?.showInfo}
      iconName="info"
      iconLabel={$_('show_info')}
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          showInfo: !$currentView?.showInfo,
        }));
      }}
    />
  </Toolbar>
{/if}
