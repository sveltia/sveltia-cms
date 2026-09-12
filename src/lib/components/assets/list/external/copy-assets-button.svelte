<!--
  @component
  Copy menu for an asset on a cloud storage service: public URLs, file paths, file IDs and file
  data. The file path is the asset’s location on the service, and the file ID is the identifier the
  service uses, e.g. an object key or a UUID, which is what an API call or a `prefix`-relative path
  would need.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { isTextFileType } from '@sveltia/utils/file';

  import CopyMenu from '$lib/components/assets/list/copy-menu.svelte';
  import { fetchExternalAssetBlob } from '$lib/services/assets/external/data';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';
  import { transformImage } from '$lib/services/utils/media/image/transform';

  /**
   * @import { ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ExternalAsset[]} [assets] Selected assets.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    useButton = true,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Whether the file data can be copied: a single plaintext or image file is selected. Unlike
   * repository assets, the file has to be fetched from the service first, so the type is guessed
   * from the kind and file name, and the fetch may still fail if the service doesn’t allow
   * cross-origin requests.
   */
  const canCopyFileData = $derived.by(() => {
    if (assets.length !== 1) {
      return false;
    }

    const [{ kind, fileName }] = assets;

    return kind === 'image' || /\.(?:css|csv|html?|js|json|md|svg|txt|xml|ya?ml)$/i.test(fileName);
  });

  /**
   * Fetch the file and copy its data to clipboard. Given that browsers typically support only
   * plaintext and PNG image, convert the file if necessary.
   */
  const copyFileData = async () => {
    let blob = await fetchExternalAssetBlob(assets[0]);
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
      /**
       * Copy the asset public URL(s) to clipboard.
       */
      copy: async () => {
        await navigator.clipboard.writeText(assets.map((a) => a.downloadURL).join('\n'));
      },
      toastKey: 'asset_urls_copied',
    },
    {
      label: _('file_paths', { values: { count: assets.length } }),
      /**
       * Copy the asset file path(s) on the service to clipboard.
       */
      copy: async () => {
        await navigator.clipboard.writeText(assets.map((a) => a.description).join('\n'));
      },
      toastKey: 'asset_paths_copied',
    },
    {
      label: _('file_ids', { values: { count: assets.length } }),
      /**
       * Copy the asset ID(s) to clipboard.
       */
      copy: async () => {
        await navigator.clipboard.writeText(assets.map((a) => a.id).join('\n'));
      },
      toastKey: 'asset_ids_copied',
    },
    {
      label: _('file_data'),
      disabled: !canCopyFileData,
      copy: copyFileData,
      toastKey: 'asset_data_copied',
    },
  ]);
</script>

<CopyMenu {items} count={assets.length} {useButton} />
