<!--
  @component Copy menu for repository assets: public URLs, file paths and file data.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { isTextFileType } from '@sveltia/utils/file';

  import CopyMenu from '$lib/components/assets/list/copy-menu.svelte';
  import { getAssetDetails } from '$lib/services/assets/details';
  import { getAssetBlob } from '$lib/services/assets/info';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';
  import { transformImage } from '$lib/services/utils/media/image/transform';

  /**
   * @import { Asset, AssetDetails } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] Selected assets.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    useButton = true,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {AssetDetails[]} */
  let assetsDetailList = $state([]);
  let canCopyFileData = $state(false);

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

    if (assets.length !== 1) {
      return false;
    }

    const blob = await getAssetBlob(assets[0]);
    const { type } = blob;

    assetBlob = blob;

    if (isTextFileType(type)) {
      return true;
    }

    if (SUPPORTED_IMAGE_TYPES.includes(type)) {
      return typeof navigator.clipboard.write === 'function';
    }

    return false;
  };

  /**
   * Copy the file data to clipboard. Given that browsers typically support only plaintext and PNG
   * image, convert the file if necessary.
   */
  const copyFileData = async () => {
    let blob = /** @type {Blob} */ (assetBlob);
    const { type } = blob;

    if (isTextFileType(type)) {
      await navigator.clipboard.writeText(await blob.text());

      return;
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(type)) {
      throw new Error('Unsupported type');
    }

    if (type !== 'image/png') {
      blob = await transformImage(blob);
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  };

  const items = $derived([
    {
      label: _('public_urls', { values: { count: assets.length } }),
      disabled: !publicURLs.length,
      /**
       * Copy the asset public URL(s) to clipboard.
       */
      copy: async () => {
        await navigator.clipboard.writeText(publicURLs.join('\n'));
      },
      toastKey: 'asset_urls_copied',
    },
    {
      label: _('file_paths', { values: { count: assets.length } }),
      /**
       * Copy the asset file path(s) to clipboard.
       */
      copy: async () => {
        await navigator.clipboard.writeText(assets.map(({ path }) => `/${path}`).join('\n'));
      },
      toastKey: 'asset_paths_copied',
    },
    {
      label: _('file_data'),
      disabled: !canCopyFileData,
      copy: copyFileData,
      toastKey: 'asset_data_copied',
    },
  ]);

  $effect(() => {
    (async () => {
      assetsDetailList = await Promise.all(assets.map(getAssetDetails));
      canCopyFileData = await checkCanCopyFileData();
    })();
  });
</script>

<CopyMenu {items} count={assets.length} {useButton} />
