<script>
  import { Alert, Menu, MenuButton, MenuItem, Toast } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';
  import { _ } from 'svelte-i18n';
  import { convertImage } from '$lib/services/utils/media';
  import { getAssetBlob, getAssetDetails } from '$lib/services/assets';

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] - Selected assets.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetDetails[]} */
  let assetsDetailList = $state([]);
  let canCopyFileData = $state(false);
  /** @type {{ show: boolean, text: string, status: 'success' | 'error' }} */
  const toast = $state({ show: false, text: '', status: 'success' });

  const singleAsset = $derived(assets.length === 1);
  const publicURLs = $derived(
    assetsDetailList.filter(({ publicURL }) => !!publicURL).map(({ publicURL }) => publicURL),
  );

  /** @type {Blob | undefined} */
  let assetBlob = undefined;

  /**
   * Check if the file data can be copied to clipboard. Since OSes usually support only one item,
   * enable the menu only when one file is selected. Also check if the file type is plaintext or
   * image and if the copy method is supported in the browser.
   * @returns {Promise<boolean>} Result.
   */
  const checkCanCopyFileData = async () => {
    assetBlob = undefined;

    if (!singleAsset) {
      return false;
    }

    const blob = await getAssetBlob(assets[0]);

    assetBlob = blob;

    if (isTextFileType(blob.type)) {
      return true;
    }

    if (blob.type.startsWith('image/')) {
      return typeof navigator.clipboard.write === 'function';
    }

    return false;
  };

  /**
   * Copy the asset public URL(s) to clipboard.
   */
  const copyPublicURLs = async () => {
    await navigator.clipboard.writeText(publicURLs.join('\n'));
  };

  /**
   * Copy the asset file path(s) to clipboard.
   */
  const copyFilePaths = async () => {
    await navigator.clipboard.writeText(assets.map(({ path }) => `/${path}`).join('\n'));
  };

  /**
   * Copy the file data to clipboard. Given that browsers typically support only plaintext and PNG
   * image, convert the file if necessary.
   */
  const copyFileData = async () => {
    let blob = /** @type {Blob} */ (assetBlob);

    if (isTextFileType(blob.type)) {
      await navigator.clipboard.writeText(await blob.text());

      return;
    }

    if (!blob.type.startsWith('image/')) {
      throw new Error('Unsupported type');
    }

    if (blob.type !== 'image/png') {
      blob = await convertImage(blob);
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  };

  /**
   * Execute a copy action.
   * @param {Function} func - Copy function.
   * @param {string} toastSingular - Singular toast label.
   * @param {string} toastPlural - Plural toast label.
   */
  const doCopyAction = async (func, toastSingular, toastPlural) => {
    try {
      await func();
      toast.status = 'success';
      toast.text = singleAsset ? toastSingular : toastPlural;
    } catch {
      toast.status = 'error';
      toast.text = $_('clipboard_error');
    } finally {
      toast.show = true;
    }
  };

  $effect(() => {
    (async () => {
      assetsDetailList = await Promise.all(assets.map(getAssetDetails));
      canCopyFileData = await checkCanCopyFileData();
    })();
  });
</script>

<MenuButton
  variant="ghost"
  disabled={!assets.length}
  label={$_('copy')}
  popupPosition="bottom-right"
>
  {#snippet popup()}
    <Menu aria-label={$_('copy_options')}>
      <MenuItem
        label={singleAsset ? $_('public_url') : $_('public_urls')}
        disabled={!publicURLs.length}
        onclick={() => {
          doCopyAction(copyPublicURLs, $_('asset_url_copied'), $_('asset_urls_copied'));
        }}
      />
      <MenuItem
        label={singleAsset ? $_('file_path') : $_('file_paths')}
        onclick={() => {
          doCopyAction(copyFilePaths, $_('asset_path_copied'), $_('asset_paths_copied'));
        }}
      />
      <MenuItem
        label={$_('file_data')}
        disabled={!canCopyFileData}
        onclick={() => {
          doCopyAction(copyFileData, $_('asset_data_copied'), $_('asset_data_copied'));
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>

<Toast bind:show={toast.show}>
  <Alert status={toast.status}>{toast.text}</Alert>
</Toast>
