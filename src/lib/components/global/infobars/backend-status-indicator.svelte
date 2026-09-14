<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { backend } from '$lib/services/backends';
  import { cmsConfig } from '$lib/services/config';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import { BackendServiceStatus } from '$lib/types/private';
   */

  const interval = 5 * 60 * 1000; // 5 minutes
  let timer = 0;

  /** @type {BackendServiceStatus} */
  let status = $state('none');

  /**
   * Check if an update is available.
   */
  const checkStatus = async () => {
    /* v8 ignore next 3 -- the checks only run for a backend that reports its status */
    if (!backend.current?.checkStatus) {
      return;
    }

    status = await backend.current.checkStatus();
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
    // Cannot get the status of the local backend or a self-hosted Git instance
    if (backend.current?.checkStatus && !backend.current.repository?.isSelfHosted) {
      startChecking();
    } else {
      stopChecking();
    }
  };

  onMount(() =>
    // onUnmount
    () => {
      stopChecking();
    },
  );

  // Runs once mounted, and again whenever the backend or the configuration changes
  $effect(() => {
    void [backend.current, cmsConfig.current];
    init();
  });
</script>

{#if ['minor', 'major'].includes(status)}
  <Infobar
    status={status === 'major' ? 'error' : 'warning'}
    --sui-infobar-message-justify-content="center"
  >
    {_(`backend_status.${status}_incident`, { values: { service: backend.current?.label } })}
    <Button
      variant="link"
      label={_('details')}
      onclick={() => {
        openNewTab(backend.current?.statusDashboardURL);
      }}
    />
  </Infobar>
{/if}
