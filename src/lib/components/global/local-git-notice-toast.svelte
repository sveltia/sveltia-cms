<!--
  @component
  Notify the user that the changes they’ve saved with the local backend have been saved but not
  committed to Git, and why.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import { localGitNotice } from '$lib/services/backends/fs/git';
  import { getLocalGitReasonLabel } from '$lib/services/backends/fs/git/messages';

  let showToast = $state(false);
  /**
   * Notice shown last. It starts as the notice there was before the component was mounted, e.g.
   * before the user signed out and in again, which mustn’t be shown again.
   */
  let shownNotice = localGitNotice.current;

  $effect(() => {
    const notice = localGitNotice.current;

    if (notice && notice !== shownNotice) {
      shownNotice = notice;
      showToast = true;
    }
  });
</script>

<!-- Every save gets a new notice, which shows the toast again for the full duration -->
{#key localGitNotice.current}
  {#if localGitNotice.current}
    <Toast bind:show={showToast}>
      <Alert status="warning">
        {_('local_git_not_committed', {
          values: { reason: getLocalGitReasonLabel(localGitNotice.current) },
        })}
      </Alert>
    </Toast>
  {/if}
{/key}
