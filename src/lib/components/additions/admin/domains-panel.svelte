<!--
  @component
  The domains allowed to use Sveltia CMS Additions: where the CMS can be opened from.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, TextArea } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import MainArea from '$lib/components/admin/main-area.svelte';
  import { saveAllowedDomains } from '$lib/services/additions/site-settings';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { parseAllowedDomains } from '$lib/services/additions/user-form';
  import { additionsUsers, loadSiteSettings } from '$lib/services/additions/users.svelte';

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   */

  /** @type {Props} */
  let { title } = $props();

  const runner = new TaskRunner();

  let domainsText = $state(additionsUsers.allowedDomains.join('\n'));

  onMount(() => {
    const shown = domainsText;

    // Loaded again, as another admin may have changed them since another section loaded them, and
    // saving would put the old ones back. What has been typed meanwhile is kept
    runner.run(async () => {
      await loadSiteSettings();

      if (domainsText === shown) {
        domainsText = additionsUsers.allowedDomains.join('\n');
      }
    });
  });
</script>

<MainArea {title}>
  <ErrorMessage message={runner.error} />
  <div role="none" class="domains">
    <p>{_('additions.users.allowed_domains_description')}</p>
    <TextArea
      bind:value={domainsText}
      aria-label={_('additions.users.allowed_domains')}
      showLabelAbove
      spellcheck="false"
      oninput={runner.clearDone}
    />
    {#if runner.doneMessageKey}
      <div role="status">{_(runner.doneMessageKey)}</div>
    {/if}
    <Button
      variant="secondary"
      label={_('additions.users.save_allowed_domains')}
      disabled={!additionsUsers.loaded || runner.busy}
      onclick={() =>
        runner.run(
          async () => {
            await saveAllowedDomains(parseAllowedDomains(domainsText));
            domainsText = additionsUsers.allowedDomains.join('\n');
          },
          { doneMessageKey: 'additions.users.allowed_domains_saved' },
        )}
    />
  </div>
</MainArea>

<style>
  .domains {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 960px;
    /* Fit a small screen rather than overflow it */
    --sui-textbox-multiline-min-width: 0;

    & > :global(.button) {
      align-self: flex-start;
    }
  }

  p {
    margin: 0;
  }
</style>
