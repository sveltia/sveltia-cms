<script>
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { backend } from '$lib/services/backends';

  const interval = 5 * 60 * 1000; // 5 minutes
  let timer = 0;

  let mounted = $state(false);
  /** @type {BackendServiceStatus} */
  let status = $state('none');

  /**
   * Check if an update is available.
   */
  const checkStatus = async () => {
    if (!$backend?.checkStatus) {
      return;
    }

    status = await $backend.checkStatus();
  };

  /**
   * Start checking the status.
   */
  const startChecking = () => {
    checkStatus();

    timer = window.setInterval(() => {
      checkStatus();
    }, interval);
  };

  /**
   * Stop checking the status.
   */
  const stopChecking = () => {
    window.clearInterval(timer);
    status = 'none';
  };

  /**
   * Initialize the status checker.
   */
  const init = () => {
    if (mounted) {
      // Cannot get the status of the local backend or a self-hosted Git instance
      if ($backend?.checkStatus && !$siteConfig?.backend.api_root) {
        startChecking();
      } else {
        stopChecking();
      }
    }
  };

  onMount(() => {
    mounted = true;

    // onUnmount
    return () => {
      stopChecking();
    };
  });

  $effect(() => {
    void mounted;
    void $backend;
    void $siteConfig;
    init();
  });
</script>

{#if ['minor', 'major'].includes(status)}
  <div role="alert" class="wrapper {status}">
    {$_(`backend_status.${status}_incident`, { values: { service: $backend?.label } })}
    <Button
      variant="link"
      label={$_('details')}
      onclick={() => {
        window.open($backend?.statusDashboardURL, '_blank');
      }}
    />
  </div>
{/if}

<style lang="scss">
  .wrapper {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 32px;
    text-align: center;
    border-bottom: 1px solid transparent;
    font-size: var(--sui-font-size-small);

    &.minor {
      border-color: var(--sui-warning-border-color);
      color: var(--sui-warning-foreground-color);
      background-color: var(--sui-warning-background-color);
    }

    &.major {
      border-color: var(--sui-error-border-color);
      color: var(--sui-error-foreground-color);
      background-color: var(--sui-error-background-color);
    }

    :global(button) {
      font-size: inherit !important;
    }
  }
</style>
