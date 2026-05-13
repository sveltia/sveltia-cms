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
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset[]} [filteredAssets] When set, overrides $listedAssets for the item selector
   * and count checks (used when browsing a subfolder).
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    filteredAssets = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const totalAssets = $derived(filteredAssets ?? $listedAssets);
  const hasListedAssets = $derived(!!totalAssets.length);
  const hasMultipleAssets = $derived(totalAssets.length > 1);
</script>

<Toolbar variant="secondary" aria-label={_('asset_list')}>
  {#if !($isSmallScreen || $isMediumScreen)}
    <ItemSelector allItems={totalAssets} selectedItems={selectedAssets} />
  {/if}
  <Spacer flex />
  <SortMenu
    disabled={!hasMultipleAssets}
    {currentView}
    sortKeys={$sortKeys}
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
  {#if !($isSmallScreen || $isMediumScreen)}
    <Divider orientation="vertical" />
    <Button
      variant="ghost"
      iconic
      disabled={!hasListedAssets}
      pressed={!!$currentView.showInfo}
      aria-controls="asset-info"
      aria-expanded={!!$currentView.showInfo}
      aria-label={_($currentView.showInfo ? 'hide_info' : 'show_info')}
      onclick={() => {
        currentView.update((view) => ({
          ...view,
          showInfo: !$currentView.showInfo,
        }));
      }}
    >
      {#snippet startIcon()}
        <Icon name="info" />
      {/snippet}
    </Button>
  {/if}
</Toolbar>
