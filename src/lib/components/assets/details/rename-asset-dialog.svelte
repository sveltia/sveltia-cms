<script>
  import { Dialog, TextInput } from '@sveltia/ui';
  import { generateUUID } from '@sveltia/utils/crypto';
  import { getPathInfo } from '@sveltia/utils/file';
  import { _ } from 'svelte-i18n';
  import { moveAssets } from '$lib/services/assets/data';
  import {
    getAssetDetails,
    getAssetsByDirName,
    renamingAsset,
    showAssetOverlay,
  } from '$lib/services/assets';

  const componentId = generateUUID('short');

  let open = $state(false);
  /** @type {{ dirname?: string, filename: string, extension?: string }} */
  let pathInfo = $state({ filename: '' });
  let newName = $state('');
  /** @type {string[]} */
  let otherNames = $state([]);
  /** @type {Entry[]} */
  let usedEntries = $state([]);

  const asset = $derived($renamingAsset);
  const { dirname, filename, extension } = $derived(pathInfo);

  const error = $derived.by(() => {
    if (!newName.trim()) return 'empty';
    if (newName.includes('/')) return 'character';
    if (otherNames.includes(`${newName}${extension ? `.${extension}` : ''}`)) return 'duplicate';
    return undefined;
  });

  const invalid = $derived(!!error);

  /**
   * Initialize the state.
   */
  const initState = async () => {
    if (asset) {
      pathInfo = getPathInfo(asset.path);
      newName = filename;
      otherNames = getAssetsByDirName(/** @type {string} */ (dirname))
        .map((a) => a.name)
        .filter((n) => n !== asset?.name);
      ({ usedEntries } = await getAssetDetails(asset));
      open = true;
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
      $renamingAsset = undefined;
    }
  });
</script>

<Dialog
  title={$_('rename_x', { values: { name: asset?.name } })}
  bind:open
  okLabel={$_('rename')}
  okDisabled={newName === filename || invalid}
  onOk={() => {
    if (asset) {
      moveAssets('rename', [
        { asset, path: `${dirname}/${newName}${extension ? `.${extension}` : ''}` },
      ]);
    }
  }}
  onClose={() => {
    $renamingAsset = undefined;
  }}
>
  <p>
    {$_(
      usedEntries.length === 0
        ? 'enter_new_name_for_asset'
        : usedEntries.length === 1
          ? 'enter_new_name_for_asset_with_one_entry'
          : 'enter_new_name_for_asset_with_many_entries',
      { values: { count: usedEntries.length } },
    )}
  </p>
  <div role="none">
    <TextInput bind:value={newName} flex {invalid} aria-errormessage="{componentId}-error" />
    {#if extension}
      <span role="none">.{extension}</span>
    {/if}
  </div>
  <div class="error" id="{componentId}-error">
    {#if invalid}
      {$_(`enter_new_name_for_asset_error.${error}`)}
    {/if}
  </div>
</Dialog>

<style lang="scss">
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
