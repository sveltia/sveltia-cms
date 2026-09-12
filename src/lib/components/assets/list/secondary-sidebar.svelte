<!--
  @component
  Info pane of the Asset Library, shown on large screens when enabled in the view settings. The
  content is an info panel for the focused asset, given as children.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, Group } from '@sveltia/ui';

  import { currentView } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   * @import { Asset, ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset | ExternalAsset | undefined} asset Focused asset. An empty state is shown
   * when there is none.
   * @property {Snippet<[any]>} children Info panel, given the focused asset.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    children,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if env.isLargeScreen && currentView.current.showInfo}
  <Group id="asset-info" class="secondary-sidebar" aria-label={_('asset_info')}>
    {#if asset}
      {@render children(asset)}
    {:else}
      <EmptyState>
        <span role="none">{_('select_asset_show_info')}</span>
      </EmptyState>
    {/if}
  </Group>
{/if}
