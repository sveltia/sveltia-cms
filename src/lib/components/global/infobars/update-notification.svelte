<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { version as userVersion } from '$lib/services/app';

  const PACKAGE_JSON_URL = 'https://unpkg.com/@sveltia/cms/package.json';
  const SCRIPT_URL = 'https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js';
  const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
  const CACHE_TIMEOUT = 10 * 60 * 1000; // 10 min

  let interval = 0;
  let timeout = 0;

  let updateAvailable = $state(false);

  /**
   * Check for a new version of the application. Behavior differs based on whether the script URL is
   * pinned to a specific version or not. If not pinned and an update is available, wait 10 minutes
   * before displaying the update notification, as redirects are cached by the UNPKG CDN. Otherwise,
   * an older script may still be served when the user reloads the page, and the notification will
   * persist. If pinned using a script tag or installed via npm, a reload won’t update the instance,
   * so a console warning is shown instead.
   * @see https://unpkg.com/#cache-behavior
   */
  const checkForUpdates = async () => {
    try {
      const response = await fetch(PACKAGE_JSON_URL);

      if (!response.ok) {
        return;
      }

      const { version: latestVersion } = await response.json();

      if (!latestVersion || latestVersion === userVersion) {
        return;
      }

      const hasUnpinnedScript = !!document.querySelector(`script[src="${SCRIPT_URL}"]`);

      if (hasUnpinnedScript) {
        timeout = window.setTimeout(() => {
          updateAvailable = true;
        }, CACHE_TIMEOUT);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[Sveltia CMS] A new version (${latestVersion}) is available. ` +
            'Update the pinned version in your script tag or package.json to upgrade.',
        );
      }
    } catch {
      //
    }
  };

  onMount(() => {
    if (import.meta.env.DEV) {
      return undefined;
    }

    checkForUpdates();

    interval = window.setInterval(() => {
      checkForUpdates();
    }, CHECK_INTERVAL);

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
