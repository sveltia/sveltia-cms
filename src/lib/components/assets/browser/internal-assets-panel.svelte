<script>
  import { untrack } from 'svelte';
  import AssetsPanel from '$lib/components/assets/browser/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { selectAssetsView } from '$lib/services/contents/draft/editor';
  import { supportedImageTypes } from '$lib/services/utils/media/image';

  /**
   * @import { Asset, AssetKind, SelectedResource } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetKind} [kind] Asset kind.
   * @property {string | undefined} [accept] Accepted file type specifiers.
   * @property {Asset[]} [assets] Asset list.
   * @property {SelectedResource | null} [selectedResource] Selected resource.
   * @property {boolean} [showUploader] Whether to show the uploader.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    kind,
    accept = undefined,
    assets = [],
    selectedResource = $bindable(null),
    showUploader = false,
    searchTerms = '',
    basePath = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {DropZone | undefined} */
  let dropZone = $state();

  $effect(() => {
    if (!selectedResource) {
      untrack(() => {
        dropZone?.reset();
      });
    }
  });
</script>

<DropZone
  bind:this={dropZone}
  accept={accept ?? (kind === 'image' ? supportedImageTypes.join(',') : undefined)}
  showUploadButton={showUploader}
  showFilePreview={true}
  onSelect={({ files }) => {
    selectedResource = files.length ? { file: files[0] } : null;
  }}
>
  {#if !showUploader}
    <AssetsPanel
      assets={assets.sort((a, b) => a.name.localeCompare(b.name))}
      viewType={$selectAssetsView?.type}
      {searchTerms}
      {basePath}
      gridId="select-assets-grid"
      checkerboard={true}
      onSelect={({ asset }) => {
        selectedResource = { asset };
      }}
    />
  {/if}
</DropZone>
