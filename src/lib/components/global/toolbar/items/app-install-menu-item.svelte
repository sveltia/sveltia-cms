<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';
  import { onMount } from 'svelte';

  let canInstall = $state(false);
  /** @type {any} */
  let installPrompt;

  /**
   * Show the install button when the app is installable.
   * @param {any} event `BeforeInstallPromptEvent` event.
   * @see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
   */
  const beforeInstallPromptHandler = (event) => {
    event.preventDefault();
    installPrompt = event;
    canInstall = true;
  };

  /**
   * Hide the install button when the app is installed.
   */
  const appInstalledHandler = () => {
    installPrompt = null;
    canInstall = false;
  };

  onMount(() => {
    window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  });
</script>

{#if canInstall}
  <MenuItem
    label={_('install_as_app')}
    onclick={async () => {
      await installPrompt?.prompt();
    }}
  />
{/if}
