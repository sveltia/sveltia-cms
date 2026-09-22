<!--
  @component Copy menu for repository assets: public URLs, file paths and file data.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import CopyMenu from '$lib/components/assets/list/copy-menu.svelte';
  import { getAssetDetails } from '$lib/services/assets/details';
  import { getAssetBlob } from '$lib/services/assets/info';
  import { canCopyFileData, copyFileData } from '$lib/services/utils/clipboard';

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
  let canCopyData = $state(false);

  const publicURLs = $derived(
    assetsDetailList.filter(({ publicURL }) => !!publicURL).map(({ publicURL }) => publicURL),
  );

  /** @type {Blob | undefined} */
  let assetBlob = undefined;

  /**
   * Check if the file data can be copied to clipboard. Since OSes usually support only one item,
   * enable the menu only when one file is selected.
   * @returns {Promise<boolean>} Result.
   */
  const checkCanCopyFileData = async () => {
    assetBlob = undefined;

    if (assets.length !== 1) {
      return false;
    }

    assetBlob = await getAssetBlob(assets[0]);

    return canCopyFileData(assetBlob.type);
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
      disabled: !canCopyData,
      /**
       * Copy the file data to clipboard.
       */
      copy: async () => {
        await copyFileData(/** @type {Blob} */ (assetBlob));
      },
      toastKey: 'asset_data_copied',
    },
  ]);

  $effect(() => {
    (async () => {
      assetsDetailList = await Promise.all(assets.map(getAssetDetails));
      canCopyData = await checkCanCopyFileData();
    })();
  });
</script>

<CopyMenu {items} count={assets.length} {useButton} />
