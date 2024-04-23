<script>
  import { Button } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { version as userVersion } from '$lib/services/app';

  const interval = 60 * 60 * 1000; // 1 hour
  let timer = 0;
  let updateAvailable = false;

  /**
   * Check if an update is available.
   */
  const checkForUpdates = async () => {
    try {
      const response = await fetch('https://unpkg.com/@sveltia/cms/package.json');

      if (!response.ok) {
        return;
      }

      const { version: latestVersion } = await response.json();

      if (latestVersion && latestVersion !== userVersion) {
        updateAvailable = true;
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

    timer = window.setInterval(() => {
      checkForUpdates();
    }, interval);

    // onUnmount
    return () => {
      window.clearInterval(timer);
    };
  });
</script>

{#if updateAvailable}
  <div role="alert" class="wrapper">
    {$_('update_available')}
    <Button
      variant="link"
      label={$_('update_now')}
      on:click={() => {
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
    border-bottom: 1px solid var(--sui-secondary-border-color);
    font-size: var(--sui-font-size-small);

    :global(button) {
      font-size: inherit !important;
    }
  }
</style>
