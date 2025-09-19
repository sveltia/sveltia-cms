<script>
  import { untrack } from 'svelte';

  import AssetsPanel from '$lib/components/assets/browser/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { selectAssetsView } from '$lib/services/contents/editor';

  /**
   * @import { Asset, SelectedResource } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {string | undefined} [accept] Accepted file type specifiers.
   * @property {Asset[]} [assets] Asset list.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   * @property {SelectedResource[]} selectedResources Selected resources.
   * @property {(detail: { files: File[] }) => void} [onDrop] Custom `Drop` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    multiple = false,
    accept = undefined,
    assets = [],
    searchTerms = '',
    basePath = undefined,
    selectedResources = $bindable([]),
    onDrop,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {DropZone | undefined} */
  let dropZone = $state();

  $effect(() => {
    if (!selectedResources.length) {
      untrack(() => {
        dropZone?.reset();
      });
    }
  });
</script>

<DropZone bind:this={dropZone} {multiple} {accept} {onDrop}>
  <AssetsPanel
    {multiple}
    {assets}
    viewType={$selectAssetsView?.type}
    {searchTerms}
    {basePath}
    gridId="select-assets-grid"
    checkerboard={true}
    bind:selectedResources
  />
</DropZone>
