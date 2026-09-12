<!--
  @component Upload button for a repository folder, which opens the Upload Assets dialog.
-->
<script>
  import UploadButton from '$lib/components/assets/list/upload-button.svelte';
  import { canCreateAsset, targetAssetFolder } from '$lib/services/assets/folders';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

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

  // Uploading to the media library commits straight to the configured branch rather than going
  // through review, so it’s not something an Open Authoring contributor can do. An asset attached
  // to an entry is committed with that entry, so it’s unaffected
  const disabled = $derived(openAuthoring.current || !canCreateAsset(targetAssetFolder.current));
</script>

<UploadButton
  {label}
  {disabled}
  onclick={() => {
    showUploadAssetsDialog.current = true;
  }}
/>
