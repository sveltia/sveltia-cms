<script>
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { signInAutomatically, signInManually, unauthenticated } from '$lib/services/user';
  import { backend, backendName } from '$lib/services/backends';

  onMount(() => {
    signInAutomatically();
  });
</script>

<div class="buttons">
  {#if $backendName === 'local'}
    {#if !('showDirectoryPicker' in window)}
      <div role="alert">
        {$_(`unsupported.browser`)}
      </div>
    {:else}
      <Button
        class="primary"
        label={$_('work_with_local_repo')}
        on:click={async () => {
          await signInManually();
        }}
      />
    {/if}
  {:else if $backend || $unauthenticated}
    <Button
      class="primary"
      label={$_('sign_in_with_x', { values: { name: $backend.label } })}
      on:click={async () => {
        await signInManually();
      }}
    />
  {:else}
    <div role="alert">
      {$_('config.error.unsupported_backend', { values: { name: $backendName } })}
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
