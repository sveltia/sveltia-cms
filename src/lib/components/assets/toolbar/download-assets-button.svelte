<script>
  import { Alert, Button, MenuItem, Toast } from '@sveltia/ui';
  import { saveFile } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import { getAssetBlob } from '$lib/services/assets';

  /**
   * @import { Asset } from '$lib/types/private';
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

  let showToast = $state(false);

  const Component = $derived(useButton ? Button : MenuItem);

  /**
   * Download the assets.
   */
  const downloadFiles = async () => {
    // eslint-disable-next-line no-restricted-syntax
    for (const asset of assets) {
      // eslint-disable-next-line no-await-in-loop
      saveFile(await getAssetBlob(asset), asset.name);
      // eslint-disable-next-line no-await-in-loop
      await sleep(300);
    }

    showToast = true;
  };
</script>

<Component
  variant="ghost"
  disabled={!assets.length}
  label={$_('download')}
  onclick={() => {
    downloadFiles();
  }}
/>

<Toast bind:show={showToast}>
  <Alert status="success">
    {assets.length === 1 ? $_('asset_downloaded') : $_('assets_downloaded')}
  </Alert>
</Toast>
