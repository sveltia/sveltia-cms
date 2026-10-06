<!--
  @component
  Infobar telling an Open Authoring contributor that their changes go to a fork and reach the site
  through a pull request. Without it there’s nothing to explain why the entries they save don’t show
  up on the site, or why the publishing controls are missing. It’s a one-off notice: once dismissed,
  it stays dismissed.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';

  import { createOneOffNotice } from '$lib/services/app/onboarding';
  import { backend } from '$lib/services/backends';
  import { openNewTab } from '$lib/services/utils/window';
  import { forkedRepository, getForkPath, getForkURL } from '$lib/services/workflow/open-authoring';

  // The dismissal is stored alongside the other one-off notices
  const notice = createOneOffNotice('openAuthoringNotice');

  const fork = $derived(forkedRepository.current);
  const repoPath = $derived(getForkPath(fork));
  const forkURL = $derived(getForkURL(backend.current?.repository, fork));

  // Only a contributor sees this, so the stored state isn’t read for anyone else
  $effect(() => {
    if (fork) {
      notice.showIfNeeded();
    }
  });
</script>

{#if fork}
  <Infobar
    show={notice.show.current}
    onDismiss={() => {
      notice.hide();
    }}
    --sui-infobar-message-justify-content="center"
  >
    {_('open_authoring.contributing_via_fork', { values: { repo: repoPath } })}
    {#if forkURL}
      <Button
        variant="link"
        label={_('open_authoring.view_fork')}
        onclick={() => {
          openNewTab(forkURL);
          notice.hide();
        }}
      />
    {/if}
  </Infobar>
{/if}
