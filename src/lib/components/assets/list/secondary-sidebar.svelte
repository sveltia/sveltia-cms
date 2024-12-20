<svelte:options runes={true} />

<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { focusedAsset } from '$lib/services/assets';
  import { currentView } from '$lib/services/assets/view';
</script>

<Group
  id="asset-info"
  class="secondary-sidebar"
  hidden={!$currentView?.showInfo}
  aria-label={$_('asset_info')}
>
  {#if $focusedAsset}
    <InfoPanel asset={$focusedAsset} showPreview={true} />
  {:else}
    <EmptyState>
      <span role="none">{$_('select_asset_show_info')}</span>
    </EmptyState>
  {/if}
</Group>
