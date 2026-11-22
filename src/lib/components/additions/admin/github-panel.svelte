<script>
  import { _ } from '@sveltia/i18n';
  import { Button, FilePicker, Radio, RadioGroup } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import MainArea from '$lib/components/admin/main-area.svelte';
  import { isGitHubURL } from '$lib/services/additions/api';
  import {
    loadGitHubStatus,
    replacePrivateKey,
    saveCommitAuthor,
  } from '$lib/services/additions/site-settings';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { additionsUsers, loadSiteSettings } from '$lib/services/additions/users.svelte';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   */

  /** @type {Props} */
  let { title } = $props();

  const runner = new TaskRunner();

  /** Message keys of what a request in this section did, each shown next to its own control. */
  const COMMIT_AUTHOR_SAVED = 'additions.users.github.commit_author_saved';
  const PRIVATE_KEY_REPLACED = 'additions.users.github.private_key_replaced';

  /** Whether the Private Key section has been opened to replace a key that still works. */
  let showKeySection = $state(false);
  /** Number of times the commit author has been saved, to show the saved choice after each try. */
  let commitAuthorAttempts = $state(0);
  /**
   * Whether the commit author has been loaded for this section, which it’s chosen from.
   */
  let settingsLoaded = $state(false);
  /** @type {FilePicker | undefined} */
  let filePicker = $state();

  const github = $derived(additionsUsers.github);
  /** Whether GitHub can’t be used until a new private key is uploaded. */
  const keyNeeded = $derived(github?.status === 'key_missing' || github?.status === 'key_rejected');
  /* v8 ignore start -- only read once the status has loaded */
  const repositoryURL = $derived(
    github?.installation
      ? `https://github.com/${github.installation.owner}/${github.installation.name}`
      : '',
  );
  /* v8 ignore stop */

  onMount(() => {
    // The commit author comes with the other settings, loaded again in case another admin has
    // changed it since another section loaded them
    runner.run(async () => {
      await Promise.all([
        loadGitHubStatus(),
        loadSiteSettings().then(() => {
          settingsLoaded = true;
        }),
      ]);
    });
  });
</script>

<MainArea {title}>
  <div role="none" class="github">
    <ErrorMessage message={runner.error} />
    {#if github}
      {#if github.app}
        <dl>
          <dt>{_('additions.users.github.app')}</dt>
          <dd>
            <a
              href={isGitHubURL(github.app.html_url) ? github.app.html_url : undefined}
              target="_blank"
            >
              {github.app.slug}
            </a>
          </dd>
          <dt>{_('additions.users.github.repository')}</dt>
          <dd>
            {#if github.installation}
              <a href={repositoryURL} target="_blank">
                {github.installation.owner}/{github.installation.name}
              </a>
            {:else}
              {_('additions.users.github.not_installed')}
            {/if}
          </dd>
        </dl>
      {/if}
      <p class:warning={github.status !== 'ok'}>
        {_(`additions.users.github.statuses.${github.status}`)}
      </p>
      {#if github.default_branch}
        {@const { name, protection } = github.default_branch}
        <p class:warning={protection !== 'protected'}>
          {_(`additions.users.github.branch_${protection}`, { values: { branch: name } })}
        </p>
      {/if}
      <div role="none" class="buttons">
        {#if github.default_branch && github.default_branch.protection !== 'protected'}
          <Button
            variant="secondary"
            label={_('additions.users.github.repository_rules')}
            onclick={() => openNewTab(`${repositoryURL}/settings/rules`)}
          />
        {/if}
        <Button
          variant="tertiary"
          label={_('additions.users.github.check_again')}
          disabled={runner.busy}
          onclick={() => runner.run(loadGitHubStatus)}
        />
      </div>
      {#if settingsLoaded}
        <section aria-labelledby="github-author-heading">
          <h3 id="github-author-heading">{_('additions.users.github.commit_author')}</h3>
          <p>{_('additions.users.github.commit_author_description')}</p>
          <!-- Rendered again after each try, so a refused choice doesn’t stay selected -->
          {#key commitAuthorAttempts}
            <RadioGroup
              orientation="vertical"
              aria-labelledby="github-author-heading"
              disabled={runner.busy}
              onChange={({ detail: { value } }) =>
                runner.run(
                  async () => {
                    try {
                      await saveCommitAuthor(value);
                    } finally {
                      commitAuthorAttempts += 1;
                    }
                  },
                  { doneMessageKey: COMMIT_AUTHOR_SAVED },
                )}
            >
              {#each ['user', 'bot'] as mode (mode)}
                <Radio value={mode} checked={additionsUsers.commitAuthor === mode}>
                  {_(`additions.users.github.commit_author_${mode}`)}
                </Radio>
              {/each}
            </RadioGroup>
          {/key}
          {#if runner.doneMessageKey === COMMIT_AUTHOR_SAVED}
            <div role="status">{_(runner.doneMessageKey)}</div>
          {/if}
        </section>
      {/if}
      {#if github.app}
        {@const settingsURL = isGitHubURL(github.app.settings_url) ? github.app.settings_url : ''}
        <section aria-labelledby="github-key-heading">
          <h3 id="github-key-heading">{_('additions.users.github.private_key')}</h3>
          <!--
            The steps are only needed to recover a lost or rejected key, or to replace one, so they
            wait for a click unless GitHub can’t be used without a new key
          -->
          {#if keyNeeded || showKeySection}
            <p>{_('additions.users.github.private_key_description')}</p>
            <div role="none" class="buttons">
              <Button
                variant="secondary"
                label={_('additions.users.github.app_settings')}
                disabled={!settingsURL}
                onclick={() => openNewTab(settingsURL)}
              />
              <Button
                variant="secondary"
                label={_('additions.users.github.upload_private_key')}
                disabled={runner.busy}
                onclick={() => filePicker?.open()}
              />
            </div>
            {#if runner.doneMessageKey === PRIVATE_KEY_REPLACED}
              <div role="status">{_(runner.doneMessageKey)}</div>
            {/if}
          {:else}
            <p>{_('additions.users.github.private_key_summary')}</p>
            <Button
              variant="secondary"
              label={_('additions.users.github.replace_private_key')}
              onclick={() => {
                showKeySection = true;
              }}
            />
          {/if}
        </section>
      {/if}
    {:else if runner.busy}
      <!-- GitHub is asked about the app and the repository, which takes a few seconds -->
      <p role="status" class="loading">{_('loading')}</p>
    {/if}
  </div>
</MainArea>

<FilePicker
  accept=".pem"
  bind:this={filePicker}
  onSelect={({ files: [file] }) =>
    runner.run(
      async () => {
        await replacePrivateKey(file);
        // A lost or rejected key works again now, so keep the steps open to show they worked
        showKeySection = true;
      },
      { doneMessageKey: PRIVATE_KEY_REPLACED },
    )}
/>

<style>
  .github,
  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 960px;

    & > :global(.button) {
      align-self: flex-start;
    }
  }

  h3,
  p,
  dl {
    margin: 0;
  }

  .loading {
    color: var(--sui-secondary-foreground-color);
  }

  h3 {
    margin-top: 12px;
    font-size: var(--sui-font-size-large);
  }

  dl {
    display: grid;
    grid-template-columns: max-content auto;
    gap: 8px 16px;
  }

  dt {
    color: var(--sui-secondary-foreground-color);
  }

  dd {
    margin: 0;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .warning {
    color: var(--sui-warning-foreground-color);
  }
</style>
