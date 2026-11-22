<!--
  @component
  The API keys and the deploy hook an admin of Sveltia CMS Additions shares with everyone who uses
  the CMS. Each user can still enter their own in Settings, which then takes precedence.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, SecretInput, TextInput } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import MainArea from '$lib/components/admin/main-area.svelte';
  import {
    fetchCredentials,
    saveCredentials,
    sharedCredentials,
  } from '$lib/services/additions/credentials.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import { skipCIConfigured } from '$lib/services/backends/git/shared/integration';
  import {
    findInvalidApiKey,
    getApiKeyServiceGroups,
  } from '$lib/services/integrations/api-key-services';

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   */

  /** @type {Props} */
  let { title } = $props();

  const runner = new TaskRunner();
  const groups = $derived(getApiKeyServiceGroups());

  // Edited here, then saved together
  /** @type {Record<string, string>} */
  let apiKeys = $state({});
  let deployHook = $state({ url: '', authHeader: '' });
  let loaded = $state(false);

  /**
   * Start editing the shared credentials as they are now.
   */
  const reset = () => {
    apiKeys = { ...sharedCredentials.apiKeys };
    deployHook = { url: '', authHeader: '', ...sharedCredentials.deployHook };
  };

  /**
   * Save the credentials, unless an API key doesn’t look right.
   * @returns {Promise<void>}
   */
  const save = () =>
    runner.run(
      async () => {
        const invalidService = findInvalidApiKey(apiKeys, groups);

        if (invalidService) {
          throw new Error('Invalid API key', {
            cause: {
              message: _('additions.credentials.invalid_key', {
                values: { service: invalidService },
              }),
            },
          });
        }

        await saveCredentials({
          apiKeys: Object.fromEntries(
            Object.entries(apiKeys).map(([serviceId, apiKey]) => [serviceId, apiKey.trim()]),
          ),
          deployHook: deployHook.url.trim()
            ? { url: deployHook.url.trim(), authHeader: deployHook.authHeader.trim() }
            : null,
        });
        reset();
      },
      { doneMessageKey: 'additions.credentials.saved' },
    );

  onMount(() => {
    runner.run(async () => {
      await fetchCredentials();
      reset();
      loaded = true;
    });
  });
</script>

<MainArea {title}>
  <p>{_('additions.credentials.description')}</p>
  <ErrorMessage message={runner.error} />
  {#if loaded}
    <div role="none" class="services">
      {#each groups as { key, titleKey, fieldLabelKey, entries } (key)}
        <section aria-labelledby="services-{key}">
          <h3 id="services-{key}">{_(titleKey)}</h3>
          {#each entries as [serviceId, { serviceLabel }] (serviceId)}
            <SecretInput
              bind:value={
                () => apiKeys[serviceId] ?? '',
                (value) => {
                  apiKeys[serviceId] = value;
                  runner.clearDone();
                }
              }
              flex
              autocomplete="off"
              spellcheck="false"
              ariaLabel={_(fieldLabelKey, { values: { service: serviceLabel } })}
              showLabelAbove
            />
          {/each}
        </section>
      {/each}
      <!-- Like in Settings, only offered when the configuration leaves deployments to the user -->
      {#if skipCIConfigured.current}
        <section aria-labelledby="services-deploy-hook">
          <h3 id="services-deploy-hook">{_('prefs.developer.deploy_hook.title')}</h3>
          <TextInput
            dir="ltr"
            bind:value={deployHook.url}
            flex
            ariaLabel={_('prefs.developer.deploy_hook.url.field_label')}
            showLabelAbove
            oninput={runner.clearDone}
          />
          <SecretInput
            bind:value={deployHook.authHeader}
            flex
            autocomplete="off"
            spellcheck="false"
            ariaLabel={_('prefs.developer.deploy_hook.auth.field_label')}
            showLabelAbove
            oninput={runner.clearDone}
          />
        </section>
      {/if}
      {#if runner.doneMessageKey}
        <div role="status">{_(runner.doneMessageKey)}</div>
      {/if}
      <Button
        variant="secondary"
        label={_('additions.credentials.save')}
        disabled={runner.busy}
        onclick={save}
      />
    </div>
  {/if}
</MainArea>

<style>
  p,
  h3 {
    margin: 0;
  }

  h3 {
    font-size: var(--sui-font-size-large);
  }

  .services {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 960px;

    & > :global(.button) {
      align-self: flex-start;
    }
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
