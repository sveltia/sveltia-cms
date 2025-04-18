<script>
  import { Button, Infobar } from '@sveltia/ui';
  import { IndexedDB } from '@sveltia/utils/storage';
  import { _ } from 'svelte-i18n';
  import { backend } from '$lib/services/backends';
  import { showMobileSignInDialog } from '$lib/services/app/onboarding';

  /** @type {IndexedDB | undefined} */
  let uiSettingsDB;
  let closed = false;
  let showInfobar = $state(false);

  $effect(() => {
    const { databaseName } = $backend?.repository ?? {};

    if (databaseName) {
      uiSettingsDB = new IndexedDB(databaseName, 'ui-settings');

      (async () => {
        if (!(await uiSettingsDB.get('onboarding'))?.mobileCta) {
          showInfobar = true;
        }
      })();
    }
  });

  $effect(() => {
    if (uiSettingsDB && !closed && !showInfobar) {
      closed = true;

      (async () => {
        await uiSettingsDB.set('onboarding', {
          ...((await uiSettingsDB.get('onboarding')) ?? {}),
          mobileCta: true,
        });
      })();
    }
  });
</script>

<Infobar show={showInfobar} --sui-infobar-message-justify-content="center">
  {$_('mobile_promo_title')}
  <Button
    variant="link"
    label={$_('mobile_promo_button')}
    onclick={() => {
      showInfobar = false;
      $showMobileSignInDialog = true;
    }}
  />
</Infobar>
