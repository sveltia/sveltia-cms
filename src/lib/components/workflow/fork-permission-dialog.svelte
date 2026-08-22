<!--
  @component
  Confirmation dialog asking an Open Authoring contributor whether the CMS may fork the repository
  on their behalf. Creating a repository on someone’s account isn’t something to do behind their
  back, so the sign-in waits here until they answer.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { ConfirmationDialog } from '@sveltia/ui';

  import { forkPermissionRequest } from '$lib/services/workflow/open-authoring';

  const request = $derived($forkPermissionRequest);
  // Writable, because the dialog sets it back to `false` when it’s dismissed
  let open = $derived(!!request);
</script>

<ConfirmationDialog
  bind:open
  title={_('open_authoring.fork_repository')}
  okLabel={_('open_authoring.fork')}
  onOk={() => {
    request?.respond(true);
  }}
  onClose={() => {
    // Covers the Cancel button, the Escape key and any other way out of the dialog. Granting
    // permission has already settled the request, so this leaves it alone
    request?.respond(false);
  }}
>
  {_('open_authoring.confirm_forking_repository', { values: { repo: request?.repo ?? '' } })}
</ConfirmationDialog>
