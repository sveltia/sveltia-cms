<script>
  import { Alert, Button, Icon, Toast, sleep } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { getBlob } from '$lib/services/assets';
  import { saveFile } from '$lib/services/utils/files';

  /**
   * @type {Asset[]}
   */
  export let assets = [];

  /**
   * @type {boolean}
   */
  let showToast = false;

  /**
   * Download the assets.
   */
  const downloadFiles = async () => {
    // eslint-disable-next-line no-restricted-syntax
    for (const asset of assets) {
      // eslint-disable-next-line no-await-in-loop
      saveFile(await getBlob(asset), asset.name);
      // eslint-disable-next-line no-await-in-loop
      await sleep(300);
    }

    showToast = true;
  };
</script>

<Button
  variant="ghost"
  disabled={!assets.length}
  label={$_('download')}
  on:click={() => {
    downloadFiles();
  }}
>
  <Icon slot="start-icon" name="download" />
</Button>

<Toast bind:show={showToast}>
  <Alert status="success">
    {assets.length === 1 ? $_('asset_downloaded') : $_('assets_downloaded')}
  </Alert>
</Toast>
