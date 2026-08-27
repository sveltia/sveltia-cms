<!--
  @component
  Toasts reporting the result of an asset operation. These live outside the Asset Library, because
  an asset can be saved from anywhere the upload dialog reaches — dropping a file on the collection
  assets sidebar, say — and the result should be reported wherever the user happens to be.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import { assetUpdatesToast } from '$lib/services/assets/data';
</script>

<Toast bind:show={$assetUpdatesToast.saved}>
  <Alert status="success">
    {_($assetUpdatesToast.published ? 'assets_saved_and_published' : 'assets_saved', {
      values: { count: $assetUpdatesToast.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.moved}>
  <Alert status="success">
    {_('assets_moved', { values: { count: $assetUpdatesToast.count } })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.renamed}>
  <Alert status="success">
    {_('assets_renamed', { values: { count: $assetUpdatesToast.count } })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.deleted}>
  <Alert status="success">
    {_('assets_deleted', { values: { count: $assetUpdatesToast.count } })}
  </Alert>
</Toast>
