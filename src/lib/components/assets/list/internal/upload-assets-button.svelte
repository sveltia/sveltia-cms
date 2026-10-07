<!--
  @component Upload button for a repository folder, which opens the Upload Assets dialog.
-->
<script>
  import UploadButton from '$lib/components/assets/list/upload-button.svelte';
  import { assetsLocked, canCreateAsset, targetAssetFolder } from '$lib/services/assets/folders';
  import { browsingCmsFolder } from '$lib/services/assets/subfolders';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

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
  // through review, so it’s not something an Open Authoring contributor or a user who can’t push to
  // the branch can do. An asset attached to an entry is committed with that entry, so it’s
  // unaffected. Nor can anything be added to a folder the CMS itself is served from
  const disabled = $derived(
    assetsLocked.current || !canCreateAsset(targetAssetFolder.current) || browsingCmsFolder.current,
  );
</script>

<UploadButton
  {label}
  {disabled}
  onclick={() => {
    showUploadAssetsDialog.current = true;
  }}
/>
