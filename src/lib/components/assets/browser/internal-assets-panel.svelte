<script>
  import { untrack } from 'svelte';

  import AssetsPanel from '$lib/components/assets/browser/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import Breadcrumb from '$lib/components/common/breadcrumb.svelte';
  import { selectAssetsView } from '$lib/services/contents/editor';

  /**
   * @import { Asset, AssetSubfolder, SelectedResource } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {string | undefined} [accept] Accepted file type specifiers.
   * @property {Asset[]} [assets] Asset list.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {string} [basePath] Path to an asset folder, if any folder is selected.
   * @property {string} [folderLabel] Label of the selected folder, shown at the start of the
   * breadcrumb while a subfolder is browsed.
   * @property {string} [subfolderPath] Path of the subfolder being browsed, relative to the
   * folder. Empty at the folder root.
   * @property {AssetSubfolder[]} [subfolders] Subfolders of the directory being browsed.
   * @property {SelectedResource[]} selectedResources Selected resources.
   * @property {(detail: { files: File[] }) => void} [onDrop] Custom `Drop` event handler.
   * @property {(subfolderPath: string) => void} [onNavigate] Called with the relative path of an
   * ancestor folder to go back to from the breadcrumb, or an empty string for the folder root.
   * @property {(subfolder: AssetSubfolder) => void} [onOpenSubfolder] Called when a listed
   * subfolder is opened.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    multiple = false,
    accept = undefined,
    assets = [],
    searchTerms = '',
    basePath = undefined,
    folderLabel = '',
    subfolderPath = '',
    subfolders = [],
    selectedResources = $bindable([]),
    onDrop,
    onNavigate = undefined,
    onOpenSubfolder = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {DropZone | undefined} */
  let dropZone = $state();

  /** Names of the subfolders leading to the one being browsed, from the folder root down. */
  const subfolderNames = $derived(subfolderPath ? subfolderPath.split('/') : []);

  $effect(() => {
    if (!selectedResources.length) {
      untrack(() => {
        dropZone?.reset();
      });
    }
  });
</script>

<DropZone bind:this={dropZone} {multiple} {accept} {onDrop}>
  <div role="none" class="wrapper">
    {#if subfolderNames.length}
      <!-- Each ancestor leads back to itself, like the breadcrumb of the Asset Library -->
      <Breadcrumb
        class="picker-breadcrumb"
        items={[
          ...[folderLabel, ...subfolderNames.slice(0, -1)].map((label, depth) => ({
            label,
            // eslint-disable-next-line jsdoc/require-jsdoc
            onClick: () => {
              onNavigate?.(subfolderNames.slice(0, depth).join('/'));
            },
          })),
          { label: /** @type {string} */ (subfolderNames.at(-1)) },
        ]}
      />
    {/if}
    <div role="none" class="panel">
      <AssetsPanel
        {multiple}
        {assets}
        viewType={selectAssetsView.current?.type}
        {searchTerms}
        {basePath}
        {subfolders}
        gridId="select-assets-grid"
        checkerboard={true}
        bind:selectedResources
        {onOpenSubfolder}
      />
    </div>
  </div>
</DropZone>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :global(.picker-breadcrumb) {
    flex: none;
    padding: 0 8px 8px;

    :global(.current) {
      font-weight: var(--sui-font-weight-bold);
    }
  }

  .panel {
    flex: auto;
    overflow: hidden;
  }
</style>
