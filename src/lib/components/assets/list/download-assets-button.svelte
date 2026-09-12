<!--
  @component
  Download button, shared by repository assets and assets on external locations. The caller
  provides how to get each file’s name and content.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, MenuItem, Toast } from '@sveltia/ui';
  import { saveFile } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';

  /**
   * @import { Asset, ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(Asset | ExternalAsset)[]} [assets] Selected assets.
   * @property {(asset: any) => string} getName Function that returns an asset’s file name.
   * @property {(asset: any) => Promise<Blob>} getBlob Function that returns an asset’s content.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    getName,
    getBlob,
    useButton = true,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {{ show: boolean, status: 'success' | 'error' }} */
  const toast = $state({ show: false, status: 'success' });

  const Component = $derived(useButton ? Button : MenuItem);

  /**
   * Download the assets.
   */
  const downloadFiles = async () => {
    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const asset of assets) {
        // eslint-disable-next-line no-await-in-loop
        saveFile(await getBlob(asset), getName(asset));
        // eslint-disable-next-line no-await-in-loop
        await sleep(300);
      }

      toast.status = 'success';
    } catch (ex) {
      toast.status = 'error';
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      toast.show = true;
    }
  };
</script>

<Component
  variant="ghost"
  disabled={!assets.length}
  label={_('download')}
  onclick={() => {
    downloadFiles();
  }}
/>

<Toast bind:show={toast.show}>
  <Alert status={toast.status}>
    {#if toast.status === 'success'}
      {_('assets_downloaded', { values: { count: assets.length } })}
    {:else}
      {_('assets_dialog.error.image_fetch_failed')}
    {/if}
  </Alert>
</Toast>
