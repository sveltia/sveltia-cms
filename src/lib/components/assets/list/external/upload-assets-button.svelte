<!--
  @component Upload button for a cloud storage service, which opens the file picker.
-->
<script>
  import { FilePicker } from '@sveltia/ui';

  import UploadButton from '$lib/components/assets/list/upload-button.svelte';
  import { hasAuthInfo, selectedCloudService } from '$lib/services/assets/external';
  import { uploadingExternalAssets } from '$lib/services/assets/external/data';

  /**
   * @typedef {object} Props
   * @property {string} [label] Button label. If `undefined`, the button will be iconic.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {FilePicker | undefined} */
  let filePicker = $state();

  const service = $derived(selectedCloudService.current);
  const disabled = $derived(!service?.upload || !hasAuthInfo(service));
</script>

<UploadButton
  {label}
  {disabled}
  onclick={() => {
    filePicker?.open();
  }}
/>

<FilePicker
  multiple
  bind:this={filePicker}
  onSelect={({ files }) => {
    uploadingExternalAssets.current = { files };
  }}
/>
