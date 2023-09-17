<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import InfoPanel from '$lib/components/assets/shared/info-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { selectedAsset } from '$lib/services/assets';
  import { currentView } from '$lib/services/assets/view';
</script>

{#if $currentView?.showInfo}
  <Group class="secondary-sidebar">
    {#if $selectedAsset}
      <InfoPanel asset={$selectedAsset} showPreview={true} />
    {:else}
      <EmptyState>
        <span>{$_('select_asset_show_info')}</span>
      </EmptyState>
    {/if}
  </Group>
{/if}
