<script>
  import { untrack } from 'svelte';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { selectAssetsView } from '$lib/services/contents/draft/editor';

  /**
   * @typedef {object} Props
   * @property {AssetKind} [kind] - Asset kind.
   * @property {Asset[]} [assets] - Asset list.
   * @property {SelectedAsset | null} [selectedAsset] - Selected asset.
   * @property {boolean} [showUploader] - Whether to show the uploader.
   * @property {string} [searchTerms] - Search terms for filtering assets.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    kind,
    assets = [],
    selectedAsset = $bindable(null),
    showUploader = false,
    searchTerms = '',
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {DropZone | undefined} */
  let dropZone = $state();

  $effect(() => {
    if (!selectedAsset) {
      untrack(() => {
        dropZone?.reset();
      });
    }
  });
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
