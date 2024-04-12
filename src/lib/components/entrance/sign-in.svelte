<script>
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { backend, backendName } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import {
    signInAutomatically,
    signInError,
    signInManually,
    unauthenticated,
  } from '$lib/services/user';

  $: repositoryName = $siteConfig?.backend?.repo?.split('/')?.[1];

  onMount(() => {
    signInAutomatically();
  });
</script>

<div role="none" class="buttons">
  {#if $backendName === 'local'}
    {#if !('showDirectoryPicker' in window)}
      <div role="alert">
        {$_('unsupported.browser')}
      </div>
    {:else}
      <Button
        variant="primary"
        label={$_('work_with_local_repo')}
        on:click={async () => {
          await signInManually();
        }}
      />
      {#if !$signInError.message}
        <div role="none">
          {#if repositoryName}
            {$_('work_with_local_repo_description', { values: { repo: repositoryName } })}
          {:else}
            {$_('work_with_local_repo_description_no_repo')}
          {/if}
        </div>
      {/if}
    {/if}
  {:else if $backend || $unauthenticated}
    <Button
      variant="primary"
      label={$_('sign_in_with_x', { values: { service: $backend?.label } })}
      on:click={async () => {
        await signInManually();
      }}
    />
  {:else}
    <div role="alert">
      {$_('config.error.unsupported_backend', { values: { name: $backendName } })}
    </div>
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
