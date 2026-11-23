<!--
  @component
  Toasts reporting the progress and the result of an asset operation. These live outside the Asset
  Library, because an asset can be saved from anywhere the upload dialog reaches — dropping a file
  on the collection assets sidebar, say — and the result should be reported wherever the user
  happens to be.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import { assetCommitToast, assetUpdatesToast } from '$lib/services/assets/data';
</script>

<Toast bind:show={assetUpdatesToast.current.saved}>
  <Alert status="success">
    {_(assetUpdatesToast.current.published ? 'assets_saved_and_published' : 'assets_saved', {
      values: { count: assetUpdatesToast.current.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={assetUpdatesToast.current.moved}>
  <Alert status="success">
    {_('assets_moved', { values: { count: assetUpdatesToast.current.count } })}
  </Alert>
</Toast>

<Toast bind:show={assetUpdatesToast.current.renamed}>
  <Alert status="success">
    {_('assets_renamed', { values: { count: assetUpdatesToast.current.count } })}
  </Alert>
</Toast>

<Toast bind:show={assetUpdatesToast.current.folderCreated}>
  <Alert status="success">{_('folder_created')}</Alert>
</Toast>

<Toast bind:show={assetUpdatesToast.current.folderRenamed}>
  <Alert status="success">{_('folder_renamed')}</Alert>
</Toast>

<Toast bind:show={assetUpdatesToast.current.folderDeleted}>
  <Alert status="success">{_('folder_deleted')}</Alert>
</Toast>

<Toast bind:show={assetUpdatesToast.current.deleted}>
  <Alert status="success">
    {_('assets_deleted', { values: { count: assetUpdatesToast.current.count } })}
  </Alert>
</Toast>

<!-- `duration={0}` keeps this up until the commit settles, however long it takes -->
<Toast show={assetCommitToast.current.pending > 0} duration={0}>
  <Alert status="info">{_(assetCommitToast.current.progress)}</Alert>
</Toast>

<Toast bind:show={assetCommitToast.current.failed}>
  <Alert status="error">{_(assetCommitToast.current.failure)}</Alert>
</Toast>
