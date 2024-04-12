<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { allAssets, uploadingAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { currentView } from '$lib/services/contents/view';

  $: ({ internalPath, entryRelative } =
    $selectedCollection?._assetFolder ?? /** @type {CollectionAssetFolder} */ ({}));
  // Can’t upload assets if collection assets are saved at entry-relative paths
  $: uploadDisabled = !!entryRelative;
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
      on:select={({ detail: { files } }) => {
        $uploadingAssets = { folder: internalPath, files };
      }}
    >
      <AssetsPanel
        assets={$allAssets.filter(({ folder }) => internalPath === folder)}
        on:select={({ detail: { asset } }) => {
          goto(`/assets/${asset.path}`);
        }}
      />
    </DropZone>
  </Group>
{/if}
