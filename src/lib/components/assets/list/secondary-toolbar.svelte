<!--
  @component
  Secondary toolbar of the Asset Library, shared by repository folders and external locations: item
  selector, optional search box, sort/filter menus, view switcher and Info pane toggle. The view
  settings live in the shared `currentView`.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Divider, Icon, SearchBar, Spacer, Toolbar } from '@sveltia/ui';

  import FilterMenu from '$lib/components/common/page-toolbar/filter-menu.svelte';
  import ItemSelector from '$lib/components/common/page-toolbar/item-selector.svelte';
  import SortMenu from '$lib/components/common/page-toolbar/sort-menu.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { ASSET_KINDS } from '$lib/services/assets/kinds';
  import { currentView } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Asset, ExternalAsset, SortKey } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(Asset | ExternalAsset)[]} allItems Listed items the item selector can select.
   * @property {{ current: (Asset | ExternalAsset)[] }} selectedItems Selected items.
   * @property {number} totalCount Number of assets in the location before any filter or search
   * narrows them down, so that the menus stay enabled and the filter can be reset.
   * @property {SortKey[]} sortKeys Sort keys shown in the Sort menu.
   * @property {{ current: string }} [searchTerms] Search terms to bind a search box to. The box is
   * omitted when this is not given, as repository assets are searched with the global search.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    allItems,
    selectedItems,
    totalCount,
    sortKeys,
    searchTerms = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const hasListedAssets = $derived(!!totalCount);
  const hasMultipleAssets = $derived(totalCount > 1);
</script>

<Toolbar variant="secondary" aria-label={_('asset_list')}>
  {#if !(env.isSmallScreen || env.isMediumScreen)}
    <ItemSelector {allItems} {selectedItems} />
  {/if}
  <Spacer flex />
  {#if searchTerms}
    <SearchBar
      dir="auto"
      flex={env.isSmallScreen}
      bind:value={searchTerms.current}
      aria-label={_('assets_dialog.search_for_file')}
      aria-controls="asset-list"
    />
  {/if}
  <SortMenu disabled={!hasMultipleAssets} {currentView} {sortKeys} aria-controls="asset-list" />
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
