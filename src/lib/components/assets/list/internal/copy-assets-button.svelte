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
   * Assets the details were last requested for. The menu stays mounted while the focus moves from
   * one asset to another, so a slow lookup for an asset focused earlier must not overwrite the
   * details of the one focused now.
   * @type {Asset[] | undefined}
   */
  let requestedAssets;

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
    const _assets = assets;

    requestedAssets = _assets;
    // Don’t copy the URLs or data of the assets selected before while the new ones are being
    // looked up
    assetsDetailList = [];
    assetBlob = undefined;
    canCopyData = false;

    (async () => {
      try {
        const [detailList, blob] = await Promise.all([
          Promise.all(_assets.map(getAssetDetails)),
          // Since OSes usually support only one item, the data can be copied only when one file is
          // selected. The data may not be available, e.g. for a file that can’t be downloaded
          _assets.length === 1 ? getAssetBlob(_assets[0]).catch(() => undefined) : undefined,
        ]);

        if (requestedAssets !== _assets) {
          return;
        }

        assetsDetailList = detailList;
        assetBlob = blob;
        canCopyData = !!blob && canCopyFileData(blob.type);
      } catch (/** @type {any} */ ex) {
        // The details couldn’t be retrieved, so the public URLs are unknown
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    })();
  });
</script>

<CopyMenu {items} count={assets.length} {useButton} />
