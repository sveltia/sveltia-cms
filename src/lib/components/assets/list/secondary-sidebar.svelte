<!--
  @component
  Info pane of the Asset Library, shown on large screens when enabled in the view settings. The
  content is an info panel for the focused asset, given as children.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, Group } from '@sveltia/ui';

  import { currentView } from '$lib/services/assets/view/settings';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Snippet } from 'svelte';
   * @import { Asset, ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset | ExternalAsset | undefined} asset Focused asset. The fallback, or an empty
   * state, is shown when there is none.
   * @property {Snippet<[any]>} children Info panel, given the focused asset.
   * @property {Snippet} [fallback] What to show while no asset is focused, e.g. the info of the
   * folder being browsed.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    children,
    fallback = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if env.isLargeScreen && currentView.current.showInfo}
  <Group id="asset-info" class="secondary-sidebar" ariaLabel={_('asset_info')}>
    {#if asset}
      {@render children(asset)}
    {:else if fallback}
      {@render fallback()}
    {:else}
      <EmptyState>
        <span role="none">{_('select_asset_show_info')}</span>
      </EmptyState>
    {/if}
  </Group>
{/if}
