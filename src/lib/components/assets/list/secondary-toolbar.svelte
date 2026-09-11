<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Divider, Icon, Spacer, Toolbar } from '@sveltia/ui';

  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import ItemSelector from '$lib/components/common/page-toolbar/item-selector.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { selectedAssets } from '$lib/services/assets';
  import { ASSET_KINDS } from '$lib/services/assets/kinds';
  import { assetGroups, currentView, listedAssets } from '$lib/services/assets/view';
  import { sortKeys } from '$lib/services/assets/view/sort-keys';
  import { env } from '$lib/services/user/env.svelte';

  const hasListedAssets = $derived(!!listedAssets.current.length);
  const hasMultipleAssets = $derived(listedAssets.current.length > 1);
</script>

<Toolbar variant="secondary" aria-label={_('asset_list')}>
  {#if !(env.isSmallScreen || env.isMediumScreen)}
    <ItemSelector
      allItems={Object.values(assetGroups.current).flat(1)}
      selectedItems={selectedAssets}
    />
  {/if}
  <Spacer flex />
  <SortMenu
    disabled={!hasMultipleAssets}
    {currentView}
    sortKeys={sortKeys.current}
    aria-controls="asset-list"
  />
  <FilterMenu
    label={_('type')}
    disabled={!hasMultipleAssets}
    {currentView}
    noneLabel={_('all')}
    filters={ASSET_KINDS.map((type) => ({ label: _(type), field: 'fileType', pattern: type }))}
    aria-controls="asset-list"
  />
  <ViewSwitcher disabled={!hasListedAssets} {currentView} aria-controls="asset-list" />
  {#if !(env.isSmallScreen || env.isMediumScreen)}
    <Divider orientation="vertical" />
    <Button
      variant="ghost"
      iconic
      disabled={!hasListedAssets}
      pressed={!!currentView.current.showInfo}
      aria-controls="asset-info"
      aria-expanded={!!currentView.current.showInfo}
      aria-label={_(currentView.current.showInfo ? 'hide_info' : 'show_info')}
      onclick={() => {
        currentView.current = {
          ...currentView.current,
          showInfo: !currentView.current.showInfo,
        };
      }}
    >
      {#snippet startIcon()}
        <Icon name="info" />
      {/snippet}
    </Button>
  {/if}
</Toolbar>
