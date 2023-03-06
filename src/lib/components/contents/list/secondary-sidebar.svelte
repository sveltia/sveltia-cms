<script>
  import { Group } from '@sveltia/ui';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { allAssets, uploadingAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { currentView } from '$lib/services/contents/view';
  import { goto } from '$lib/services/navigation';

  $: mediaFolder = $selectedCollection.media_folder || '';
  $: [, canonicalMediaFolder] = mediaFolder.match(/^\/?(.+)\/?$/) || [];
</script>

{#if mediaFolder.startsWith('/') && $currentView?.showMedia}
  <Group class="secondary-sidebar">
    <DropZone
      multiple={true}
      on:select={({ detail: { files } }) => {
        $uploadingAssets = { folder: canonicalMediaFolder, files };
      }}
    >
      <AssetsPanel
        assets={$allAssets.filter(({ folder }) => canonicalMediaFolder === folder)}
        on:select={({ detail: { asset } }) => {
          goto(`/assets/${asset.path}`);
        }}
      />
    </DropZone>
  </Group>
{/if}
