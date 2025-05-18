<script>
  import { Group } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/browser/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { allAssets, getAssetFolder, uploadingAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { currentView } from '$lib/services/contents/collection/view';
  import { isLargeScreen } from '$lib/services/user/env';

  const folder = $derived(getAssetFolder({ collectionName: $selectedCollection?.name }));
  const { internalPath, entryRelative, hasTemplateTags } = $derived(
    folder ?? { internalPath: '', entryRelative: false, hasTemplateTags: false },
  );
  // Can’t upload assets if collection assets are saved at entry-relative paths
  const uploadDisabled = $derived(entryRelative || hasTemplateTags);
</script>

{#if internalPath && $isLargeScreen && $currentView.showMedia}
  <Group id="collection-assets" class="secondary-sidebar" aria-label={$_('collection_assets')}>
    <DropZone
      disabled={uploadDisabled}
      multiple={true}
      onDrop={({ files }) => {
        $uploadingAssets = { folder, files };
      }}
    >
      <AssetsPanel
        assets={$allAssets.filter((asset) => equal(asset.folder, folder))}
        onSelect={({ asset }) => {
          goto(`/assets/${asset.path}`, { transitionType: 'forwards' });
        }}
      />
    </DropZone>
  </Group>
{/if}
