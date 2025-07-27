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
   * @property {string | undefined} [accept] Accepted file type specifiers.
   * @property {Asset[]} [assets] Asset list.
   * @property {SelectedResource} [selectedResource] Selected resource.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   * @property {(detail: { files: File[] }) => void} [onDrop] Custom `Drop` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    accept = undefined,
    assets = [],
    selectedResource = $bindable(),
    searchTerms = '',
    basePath = undefined,
    onDrop,
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

<DropZone bind:this={dropZone} {accept} {onDrop}>
  <AssetsPanel
    {assets}
    bind:selectedResource
    viewType={$selectAssetsView?.type}
    {searchTerms}
    {basePath}
    gridId="select-assets-grid"
    checkerboard={true}
  />
</DropZone>
