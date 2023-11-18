<script>
  import { Group } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { allAssets, uploadingAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { currentView } from '$lib/services/contents/view';
  import { goto } from '$lib/services/navigation';
  import { stripSlashes } from '$lib/services/utils/strings';

  $: mediaFolder = $selectedCollection.media_folder ?? '';
  $: canonicalMediaFolder = stripSlashes(mediaFolder);
</script>

{#if mediaFolder.startsWith('/')}
  <Group
    id="collection-assets"
    class="secondary-sidebar"
    hidden={!$currentView?.showMedia}
    aria-label={$_('collection_assets')}
  >
    <DropZone
      multiple={true}
      on:select={({ detail: { files } }) => {
        $uploadingAssets = { folder: canonicalMediaFolder, files };
      }}
    >
      <AssetsPanel
        assets={$allAssets.filter(({ folder }) => canonicalMediaFolder === folder)}
        viewType="grid"
        on:select={({ detail: { asset } }) => {
          goto(`/assets/${asset.path}`);
        }}
      />
    </DropZone>
  </Group>
{/if}
