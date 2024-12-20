<script>
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { version as userVersion } from '$lib/services/app';

  const checkInterval = 60 * 60 * 1000; // 1 hour
  const cacheTimeout = 10 * 60 * 1000; // 10 min
  let interval = 0;
  let timeout = 0;

  let updateAvailable = $state(false);

  /**
   * Check for a new version of the application. If an update is available, wait 10 minutes before
   * displaying the update notification, as redirects are cached by the UNPKG CDN. Otherwise, an
   * older script may still be served when the user reloads the page, and then the notification will
   * persist.
   * @see https://unpkg.com/#cache-behavior
   */
  const checkForUpdates = async () => {
    try {
      const response = await fetch('https://unpkg.com/@sveltia/cms/package.json');

      if (!response.ok) {
        return;
      }

      const { version: latestVersion } = await response.json();

      if (latestVersion && latestVersion !== userVersion) {
        timeout = window.setTimeout(() => {
          updateAvailable = true;
        }, cacheTimeout);
      }
    } catch {
      //
    }
  };

  onMount(() => {
    // Enable update checking only if the script is installed on the site via UNPKG
    if (
      import.meta.env.DEV ||
      !document.querySelector('script[src^="https://unpkg.com/@sveltia/cms"]')
    ) {
      return void 0;
    }

    checkForUpdates();

    interval = window.setInterval(() => {
      checkForUpdates();
    }, checkInterval);

    // onUnmount
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  });
</script>

{#if updateAvailable}
  <div role="alert" class="wrapper">
    {$_('update_available')}
    <Button
      variant="link"
      label={$_('update_now')}
      onclick={() => {
        window.location.reload();
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
    border-bottom: 1px solid var(--sui-info-border-color);
    color: var(--sui-info-foreground-color);
    background-color: var(--sui-info-background-color);
    font-size: var(--sui-font-size-small);

    :global(button) {
      font-size: inherit !important;
    }
  }
</style>
