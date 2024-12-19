<script>
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { selectAssetsView } from '$lib/services/contents/draft/editor';

  /** @type {AssetKind | undefined} */
  export let kind;
  /** @type {Asset[]} */
  export let assets = [];
  /** @type {SelectedAsset | null} */
  export let selectedAsset = null;
  /** @type {boolean} */
  export let showUploader = false;
  /** @type {string} */
  export let searchTerms = '';

  /** @type {DropZone} */
  let dropZone;

  $: {
    if (dropZone && !selectedAsset) {
      dropZone.reset();
    }
  }
</script>

<DropZone
  bind:this={dropZone}
  accept={kind === 'image' ? 'image/*' : undefined}
  showUploadButton={showUploader}
  showFilePreview={true}
  onSelect={({ files }) => {
    selectedAsset = files.length ? { file: files[0] } : null;
  }}
>
  {#if !showUploader}
    <AssetsPanel
      assets={assets.sort((a, b) => a.name.localeCompare(b.name))}
      viewType={$selectAssetsView?.type}
      {searchTerms}
      gridId="select-assets-grid"
      checkerboard={true}
      onSelect={({ asset }) => {
        selectedAsset = { asset };
      }}
    />
  {/if}
</DropZone>
