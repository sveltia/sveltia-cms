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

  import { getState, setState } from '$lib/services/app/onboarding';
  import { backend } from '$lib/services/backends';
  import { openNewTab } from '$lib/services/utils/window';
  import { forkedRepository } from '$lib/services/workflow/open-authoring';

  /** Key the dismissal is stored under, alongside the other one-off notices. */
  const STATE_KEY = 'openAuthoringNotice';

  let showInfobar = $state(false);

  const fork = $derived($forkedRepository);
  const repoPath = $derived(fork ? `${fork.owner}/${fork.repo}` : '');
  // The fork lives on the same service as the configured repository, which can be a GitHub
  // Enterprise Server instance rather than github.com
  const forkURL = $derived.by(() => {
    const { repoURL } = $backend?.repository ?? {};

    return fork && repoURL ? new URL(`/${repoPath}`, repoURL).href : '';
  });

  /**
   * Show the infobar unless the contributor has already dismissed it.
   */
  const showInfobarIfNeeded = async () => {
    showInfobar = !(await getState(STATE_KEY));
  };

  /**
   * Hide the infobar and remember it, so it doesn’t come back on the next load.
   */
  const hideInfobar = () => {
    showInfobar = false;
    setState(STATE_KEY, true);
  };

  // Only a contributor sees this, so the stored state isn’t read for anyone else
  $effect(() => {
    if (fork) {
      showInfobarIfNeeded();
    }
  });
</script>

{#if fork}
  <Infobar
    show={showInfobar}
    onDismiss={() => {
      hideInfobar();
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
          hideInfobar();
        }}
      />
    {/if}
  </Infobar>
{/if}
