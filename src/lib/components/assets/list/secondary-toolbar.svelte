<script>
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { assetKinds, selectedAssets } from '$lib/services/assets';
  import { assetGroups, currentView, listedAssets, sortFields } from '$lib/services/assets/view';
  import { selectedCollection } from '$lib/services/contents';

  $: hasListedAssets = !!$listedAssets.length;
  $: hasMultipleAssets = $listedAssets.length > 1;
</script>

{#if !$selectedCollection.files}
  <Toolbar variant="secondary">
    <Button
      variant="ghost"
      disabled={$selectedAssets.length === Object.values($assetGroups).flat(1).length}
      label={$_('select_all')}
      on:click={() => {
        $selectedAssets = Object.values($assetGroups).flat(1);
      }}
    />
    <Button
      variant="ghost"
      disabled={!$selectedAssets.length}
      label={$_('clear_selection')}
      on:click={() => {
        $selectedAssets = [];
      }}
    />
    <Spacer flex />
    <SortMenu disabled={!hasMultipleAssets} {currentView} fields={$sortFields} />
    <FilterMenu
      label={$_('file_type')}
      disabled={!hasMultipleAssets}
      {currentView}
      noneLabel={$_('all')}
      filters={assetKinds.map((type) => ({ label: $_(type), field: 'fileType', pattern: type }))}
    />
    <ViewSwitcher disabled={!hasListedAssets} {currentView} />
    <Divider />
    <Button
      variant="ghost"
      iconic
      disabled={!hasListedAssets}
      pressed={!!$currentView?.showInfo}
      on:click={() => {
        currentView.update((view) => ({
          ...view,
          showInfo: !$currentView?.showInfo,
        }));
      }}
    >
      <Icon slot="start-icon" name="info" label={$_('show_info')} />
    </Button>
  </Toolbar>
{/if}
