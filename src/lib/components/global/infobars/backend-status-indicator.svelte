<script>
  import { Button, Infobar } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { siteConfig } from '$lib/services/config';
  import { backend } from '$lib/services/backends';

  /**
   * @import { BackendServiceStatus } from '$lib/typedefs/private';
   */

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
      if ($backend?.checkStatus && !$backend.repository?.isSelfHosted) {
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
  <Infobar
    status={status === 'major' ? 'error' : 'warning'}
    --sui-infobar-message-justify-content="center"
  >
    {$_(`backend_status.${status}_incident`, { values: { service: $backend?.label } })}
    <Button
      variant="link"
      label={$_('details')}
      onclick={() => {
        window.open($backend?.statusDashboardURL, '_blank');
      }}
    />
  </Infobar>
{/if}
