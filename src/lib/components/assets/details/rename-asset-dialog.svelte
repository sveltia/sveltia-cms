<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, TextInput } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';

  import FileExtensionChangeDialog from '$lib/components/assets/shared/file-extension-change-dialog.svelte';
  import { goto, parseLocation } from '$lib/services/app/navigation';
  import { getAssetsByDirName, renamingAsset } from '$lib/services/assets';
  import { moveAssets } from '$lib/services/assets/data/move';
  import { getAssetUsedEntries } from '$lib/services/assets/details';
  import { showAssetOverlay } from '$lib/services/assets/view';
  import { isEquivalentFileExtension } from '$lib/services/utils/file';

  /**
   * @import { Entry } from '$lib/types/private';
   */

  const componentId = $props.id();

  let open = $state(false);
  let confirmationOpen = $state(false);
  /** @type {HTMLInputElement | undefined} */
  let inputElement = $state();
  /** Whether the file name has been auto-selected in the input field. */
  let nameSelected = false;
  /** @type {{ dirname?: string, basename: string, extension?: string }} */
  let pathInfo = $state({ basename: '' });
  let newName = $state('');
  /** @type {string[]} */
  let otherNames = $state([]);
  /** @type {Entry[]} */
  let usedEntries = $state([]);

  const asset = $derived($renamingAsset);
  const { dirname, basename, extension: oldExtension } = $derived(pathInfo);
  const trimmedName = $derived(newName.trim());
  const newExtension = $derived(getPathInfo(trimmedName).extension);
  /** Whether the file extension is being changed in a way that requires confirmation. */
  const extensionChanged = $derived(!isEquivalentFileExtension(oldExtension, newExtension));

  const error = $derived.by(() => {
    if (!trimmedName) return 'empty';
    if (trimmedName.includes('/')) return 'character';
    if (otherNames.includes(trimmedName)) return 'duplicate';
    return undefined;
  });

  const invalid = $derived(!!error);

  /**
   * Initialize the state.
   */
  const initState = async () => {
    if (asset) {
      pathInfo = getPathInfo(asset.path);
      newName = basename;
      nameSelected = false;
      otherNames = getAssetsByDirName(/** @type {string} */ (dirname))
        .map((a) => a.name)
        .filter((n) => n !== asset.name);
      usedEntries = await getAssetUsedEntries(asset);
      open = true;
    }
  };

  /**
   * Narrow down the selection in the input field to the file name, excluding the extension, just
   * like the macOS Finder and Windows File Explorer do. The Dialog component selects the entire
   * value once the dialog is open, so this is called in response to that initial selection.
   */
  const selectFileName = () => {
    if (nameSelected || !inputElement) {
      return;
    }

    nameSelected = true;

    const { filename } = getPathInfo(inputElement.value);

    inputElement.setSelectionRange(0, filename.length);
  };

  /**
   * Rename the asset by moving it to a new path. Also, update the URL hash silently to reflect the
   * new asset name if the rename dialog was opened in the asset details view.
   */
  const renameAsset = async () => {
    if (!asset) {
      return;
    }

    const oldPath = asset.path;
    const newPath = `${dirname}/${trimmedName}`;

    await moveAssets('rename', [{ asset, path: newPath }]);

    if (parseLocation().path === `/assets/${oldPath}`) {
      await goto(`/assets/${newPath}`, { replaceState: true, notifyChange: false });
    }
  };

  $effect(() => {
    if (asset) {
      initState();
    }
  });

  $effect(() => {
    if (!$showAssetOverlay) {
      open = false;
      confirmationOpen = false;
      $renamingAsset = undefined;
    }
  });
</script>

<Dialog
  title={_('rename_x', { values: { name: asset?.name ?? '' } })}
  bind:open
  okLabel={_('rename')}
  okDisabled={trimmedName === basename || invalid}
  onOk={() => {
    if (extensionChanged) {
      // Ask for confirmation before renaming
      confirmationOpen = true;
    } else {
      renameAsset();
    }
  }}
  onClose={() => {
    if (!confirmationOpen) {
      $renamingAsset = undefined;
    }
  }}
>
  <p>
    {_('enter_new_name_for_asset', { values: { count: usedEntries.length } })}
  </p>
  <div role="none">
    <TextInput
      dir="auto"
      bind:value={newName}
      bind:element={inputElement}
      flex
      {invalid}
      aria-errormessage="{componentId}-error"
      onselect={() => {
        selectFileName();
      }}
    />
  </div>
  <div role="none" class="error" id="{componentId}-error">
    {#if invalid}
      {_(`enter_new_name_for_asset_error.${error}`)}
    {/if}
  </div>
</Dialog>

<FileExtensionChangeDialog
  bind:open={confirmationOpen}
  {oldExtension}
  {newExtension}
  okLabel={_('rename')}
  onOk={() => {
    renameAsset();
    $renamingAsset = undefined;
  }}
  onCancel={() => {
    // Go back to the rename dialog, keeping the entered name
    open = true;
  }}
/>

<style>
  p {
    margin: 0 0 8px;
  }

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .error {
    margin: 0;
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
