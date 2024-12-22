<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { allAssets, uploadingAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { currentView } from '$lib/services/contents/collection/view';

  const { internalPath, entryRelative } = $derived(
    $selectedCollection?._assetFolder ?? /** @type {CollectionAssetFolder} */ ({}),
  );
  // Can’t upload assets if collection assets are saved at entry-relative paths
  const uploadDisabled = $derived(!!entryRelative);
</script>

{#if internalPath}
  <Group
    id="collection-assets"
    class="secondary-sidebar"
    hidden={!$currentView.showMedia}
    aria-label={$_('collection_assets')}
  >
    <DropZone
      disabled={uploadDisabled}
      multiple={true}
      onSelect={({ files }) => {
        $uploadingAssets = { folder: internalPath, files };
      }}
    >
      <AssetsPanel
        assets={$allAssets.filter(({ folder }) => internalPath === folder)}
        onSelect={({ asset }) => {
          goto(`/assets/${asset.path}`);
        }}
      />
    </DropZone>
  </Group>
{/if}
