<script>
  import { Alert, MenuItem, Toast } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { backend, backendName } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import { prefs } from '$lib/services/prefs';

  $: ({ backend: { automatic_deployments: autoDeployEnabled = undefined } = {} } =
    $siteConfig ?? /** @type {SiteConfig} */ ({}));
  $: ({ deployHookURL } = $prefs);
  $: ({ triggerDeployment } = $backend ?? /** @type {BackendService} */ ({}));
  $: showButton = $backendName !== 'local' && typeof autoDeployEnabled === 'boolean';
  $: canPublish = !!deployHookURL || typeof triggerDeployment === 'function';

  /** @type {'info' | 'error'} */
  let toastStatus = 'info';
  /** @type {boolean} */
  let showToast = false;

  /**
   * Trigger a manual deployment on the CI/CD provider.
   */
  const publish = async () => {
    toastStatus = 'info';
    showToast = true;

    try {
      const { ok, status } = deployHookURL
        ? await fetch(deployHookURL, { method: 'POST', mode: 'no-cors' })
        : ((await triggerDeployment?.()) ?? {});

      // If the `mode` is `no-cors`, the regular response status will be `0`
      if (!ok && status !== 0) {
        throw new Error(`Webhook returned ${status} error`);
      }
    } catch (/** @type {any} */ ex) {
      toastStatus = 'error';
      showToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };
</script>

{#if showButton}
  <MenuItem label={$_('publish_changes')} disabled={!canPublish} onclick={() => publish()} />
  <Toast bind:show={showToast}>
    <Alert status={toastStatus}>
      {$_(toastStatus === 'error' ? 'publishing_changes_failed' : 'publishing_changes')}
    </Alert>
  </Toast>
{/if}
