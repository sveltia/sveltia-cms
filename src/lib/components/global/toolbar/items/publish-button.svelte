<script>
  import { Alert, Button, Toast } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { backend, backendName, isLastCommitPublished } from '$lib/services/backends';
  import { siteConfig } from '$lib/services/config';
  import { prefs } from '$lib/services/prefs';

  const { backend: { automatic_deployments: autoDeployEnabled = undefined } = {} } = $derived(
    $siteConfig ?? /** @type {SiteConfig} */ ({}),
  );
  const { deployHookURL } = $derived($prefs);
  const { triggerDeployment } = $derived($backend ?? /** @type {BackendService} */ ({}));
  const showButton = $derived($backendName !== 'local' && typeof autoDeployEnabled === 'boolean');
  const canPublish = $derived(
    (!!deployHookURL || typeof triggerDeployment === 'function') && !$isLastCommitPublished,
  );

  /** @type {'info' | 'error'} */
  let toastStatus = $state('info');
  /** @type {boolean} */
  let showToast = $state(false);

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

      $isLastCommitPublished = true;
    } catch (/** @type {any} */ ex) {
      toastStatus = 'error';
      showToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };
</script>

{#if showButton}
  <Button
    variant="secondary"
    label={$_('publish_changes')}
    disabled={!canPublish}
    onclick={() => publish()}
  />
  <Toast bind:show={showToast}>
    <Alert status={toastStatus}>
      {$_(toastStatus === 'error' ? 'publishing_changes_failed' : 'publishing_changes')}
    </Alert>
  </Toast>
{/if}
