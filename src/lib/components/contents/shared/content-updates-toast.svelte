<!--
  @component
  Toasts reporting the result of an entry operation. These live outside the content library,
  because the editor can close onto another page — the search results an entry was opened from,
  say — and the result should be reported wherever the user lands.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import { contentUpdatesToast } from '$lib/services/contents/collection/data';
</script>

<Toast bind:show={contentUpdatesToast.current.saved}>
  <Alert status="success">
    {_(contentUpdatesToast.current.published ? 'entry_saved_and_published' : 'entry_saved', {
      values: { count: contentUpdatesToast.current.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.deletionCancelled}>
  <Alert status="success">{_('workflow.deletion_cancelled')}</Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.discarded}>
  <Alert status="success">
    {_('workflow.changes_discarded', { values: { count: contentUpdatesToast.current.count } })}
  </Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.deleted}>
  <Alert status="success">
    {_(
      contentUpdatesToast.current.deletionPending ? 'workflow.deletion_pending' : 'entries_deleted',
      {
        values: { count: contentUpdatesToast.current.count },
      },
    )}
  </Alert>
</Toast>

<Toast bind:show={contentUpdatesToast.current.alreadyPublished}>
  <Alert status="error">{_('open_authoring.entry_already_published')}</Alert>
</Toast>
