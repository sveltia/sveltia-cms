<script>
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { allBackendServices } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import {
    signInAutomatically,
    signInError,
    signInManually,
    unauthenticated,
  } from '$lib/services/user';

  $: isLocalHost = false;
  $: isLocalBackendSupported = false;
  $: configuredBackendName = $siteConfig?.backend?.name;
  $: configuredBackend = configuredBackendName ? allBackendServices[configuredBackendName] : null;
  $: repositoryName = $siteConfig?.backend?.repo?.split('/')?.[1];

  onMount(() => {
    // Local editing needs a secure context, either `http://localhost` or `http://*.localhost`
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
    isLocalHost = !!window.location.hostname.match(/^(?:.+\.)?localhost$/);
    isLocalBackendSupported = 'showDirectoryPicker' in window;

    signInAutomatically();
  });
</script>

<div role="none" class="buttons">
  {#if !$unauthenticated}
    <div role="alert" class="message">{$_('signing_in')}</div>
  {:else if !configuredBackend}
    <div role="alert">
      {$_('config.error.unsupported_backend', { values: { name: configuredBackendName } })}
    </div>
  {:else}
    <Button
      variant="primary"
      label={$_('sign_in_with_x', { values: { service: configuredBackend?.label } })}
      on:click={async () => {
        await signInManually(/** @type {string} */ (configuredBackendName));
      }}
    />
    {#if isLocalHost}
      <Button
        variant="primary"
        label={$_('work_with_local_repo')}
        disabled={!isLocalBackendSupported}
        on:click={async () => {
          await signInManually('local');
        }}
      />
      {#if !isLocalBackendSupported}
        <div role="alert">
          {$_('unsupported.browser')}
        </div>
      {:else if !$signInError.message}
        <div role="none">
          {#if repositoryName}
            {$_('work_with_local_repo_description', { values: { repo: repositoryName } })}
          {:else}
            {$_('work_with_local_repo_description_no_repo')}
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
  {#if $signInError.message && $signInError.canRetry}
    <div role="alert">
      {$signInError.message}
    </div>
  {/if}
</div>

<style lang="scss">
  .buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;

    :global(button) {
      width: 240px;
    }
  }
</style>
