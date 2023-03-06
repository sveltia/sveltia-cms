<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import BasicGridView from '$lib/components/common/basic-grid-view.svelte';
  import BasicListView from '$lib/components/common/basic-list-view.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import { selectedAssetFolderPath, uploadingAssets } from '$lib/services/assets';
  import { assetGroups, currentView } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';
</script>

<div class="list-container">
  {#if Object.values($assetGroups).flat(1).length}
    <DropZone
      multiple={true}
      on:select={({ detail: { files } }) => {
        $uploadingAssets = { folder: $selectedAssetFolderPath || $siteConfig.media_folder, files };
      }}
    >
      {#each Object.entries($assetGroups) as [groupName, assets] (groupName)}
        <Group>
          {#if groupName !== '*'}
            <h3>{groupName}</h3>
          {/if}
          <svelte:component this={$currentView.type === 'list' ? BasicListView : BasicGridView}>
            {#each assets as asset (asset.sha)}
              <AssetListItem {asset} />
            {/each}
          </svelte:component>
        </Group>
      {/each}
    </DropZone>
  {:else}
    <EmptyState>
      <span>{$_('no_files_found')}</span>
    </EmptyState>
  {/if}
</div>
