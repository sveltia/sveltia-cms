<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import {
    isUpdateAvailable,
    UPDATE_CACHE_TIMEOUT,
    UPDATE_CHECK_INTERVAL,
  } from '$lib/services/app/update';

  let interval = 0;
  let timeout = 0;

  let updateAvailable = $state(false);

  /**
   * Check for a new version of the application, and show the notification after a delay if a
   * reload would pick it up. See {@link UPDATE_CACHE_TIMEOUT} for the reason of the delay.
   */
  const checkForUpdates = async () => {
    if (await isUpdateAvailable()) {
      timeout = window.setTimeout(() => {
        updateAvailable = true;
      }, UPDATE_CACHE_TIMEOUT);
    }
  };

  onMount(() => {
    if (import.meta.env.DEV) {
      return undefined;
    }

    checkForUpdates();

    interval = window.setInterval(() => {
      checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);

    // onUnmount
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  });
</script>

{#if updateAvailable}
  <Infobar --sui-infobar-message-justify-content="center">
    {_('update_available')}
    <Button
      variant="link"
      label={_('update_now')}
      onclick={() => {
        window.location.reload();
      }}
    />
  </Infobar>
{/if}
