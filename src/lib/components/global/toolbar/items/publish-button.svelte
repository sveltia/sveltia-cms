<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Toast } from '@sveltia/ui';

  import { skipCIConfigured } from '$lib/services/backends/git/shared/integration';
  import { canTriggerDeployment, triggerDeployment } from '$lib/services/deployments/publish';
  import { env } from '$lib/services/user/env.svelte';

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
      await triggerDeployment();
    } catch (ex) {
      toastStatus = 'error';
      showToast = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };
</script>

{#if skipCIConfigured.current}
  <Button
    variant="secondary"
    size={env.isSmallScreen ? 'small' : 'medium'}
    label={_('publish_changes')}
    disabled={!canTriggerDeployment.current}
    onclick={() => publish()}
  />
  <Toast bind:show={showToast}>
    <Alert status={toastStatus}>
      {_(toastStatus === 'error' ? 'publishing_changes_failed' : 'publishing_changes')}
    </Alert>
  </Toast>
{/if}
