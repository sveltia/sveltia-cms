<script>
  import { _ } from '@sveltia/i18n';
  import { Group } from '@sveltia/ui';

  import AssetsPanel from '$lib/components/assets/browser/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { isAssetInFolder } from '$lib/services/assets';
  import { assetsLocked, canCreateAsset, getAssetFolder } from '$lib/services/assets/folders';
  import { allAssets, uploadingAssets } from '$lib/services/assets/state';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { currentView } from '$lib/services/contents/collection/view/settings';
  import { env } from '$lib/services/user/env.svelte';

  const folder = $derived(getAssetFolder({ collectionName: selectedCollection.current?.name }));
  const assets = $derived(
    folder ? allAssets.current.filter((asset) => isAssetInFolder(asset, folder)) : [],
  );
  const internalPath = $derived(folder?.internalPath);
  // Can’t upload assets if collection assets are saved at entry-relative paths, or the folder is
  // read-only. An Open Authoring contributor or a user who can’t push to the branch can’t either:
  // this uploads to the collection’s media folder, which is a commit straight to the configured
  // branch rather than something that goes through review
  const uploadDisabled = $derived(!canCreateAsset(folder) || assetsLocked.current);
</script>

{#if internalPath !== undefined && env.isLargeScreen && currentView.current.showMedia}
  <Group id="collection-assets" class="secondary-sidebar" ariaLabel={_('collection_assets')}>
    <DropZone
      disabled={uploadDisabled}
      multiple={true}
      onDrop={({ files }) => {
        uploadingAssets.current = { folder, files };
      }}
    >
      <AssetsPanel
        {assets}
        onSelect={({ asset }) => {
          goto(`/assets/${asset.path}`, { transitionType: 'forwards' });
        }}
      />
    </DropZone>
  </Group>
{/if}
