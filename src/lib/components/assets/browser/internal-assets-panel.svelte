<script>
  import { _ } from '@sveltia/i18n';
  import { untrack } from 'svelte';

  import AssetsPanel from '$lib/components/assets/browser/assets-panel.svelte';
  import PickerBreadcrumb from '$lib/components/assets/browser/picker-breadcrumb.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import { selectAssetsView } from '$lib/services/contents/editor';

  /**
   * @import {
   * Asset,
   * AssetSubfolder,
   * MediaLibraryAssetKind,
   * SelectedResource,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {MediaLibraryAssetKind} [kind] Kind of the assets being picked: images, or files of
   * any kind if `undefined`.
   * @property {boolean} [selectFolder] Whether a folder is being selected instead of files, which
   * takes no dropped files and lists subfolders only.
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
   * @property {string[]} [selectedSubfolderPaths] Paths of the selected subfolders.
   * @property {(subfolder: AssetSubfolder, selected: boolean) => void} [onSelectSubfolder] Called
   * with a subfolder and whether it’s now selected, when a folder is to be picked.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    multiple = false,
    kind = undefined,
    selectFolder = false,
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
    selectedSubfolderPaths = [],
    onSelectSubfolder = undefined,
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

<DropZone bind:this={dropZone} disabled={selectFolder} {multiple} {accept} {onDrop}>
  <div role="none" class="wrapper">
    <PickerBreadcrumb rootLabel={folderLabel} path={subfolderPath} {onNavigate} />
    <div role="none" class="panel">
      <AssetsPanel
        {multiple}
        {kind}
        {assets}
        viewType={selectAssetsView.current?.type}
        {searchTerms}
        {basePath}
        {subfolders}
        gridId="select-assets-grid"
        checkerboard={true}
        emptyMessage={selectFolder ? _('assets_dialog.no_subfolders') : undefined}
        bind:selectedResources
        {onOpenSubfolder}
        {selectedSubfolderPaths}
        {onSelectSubfolder}
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

  .panel {
    flex: auto;
    overflow: hidden;
  }
</style>
