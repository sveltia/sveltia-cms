<script>
  import { Button, Infobar } from '@sveltia/ui';
  import { IndexedDB } from '@sveltia/utils/storage';
  import { _ } from 'svelte-i18n';
  import { showMobileSignInDialog } from '$lib/services/app/onboarding';
  import { backend } from '$lib/services/backends';

  /** @type {IndexedDB | undefined} */
  let uiSettingsDB;
  let showInfobar = $state(false);

  $effect(() => {
    const { databaseName } = $backend?.repository ?? {};

    if (databaseName) {
      uiSettingsDB = new IndexedDB(databaseName, 'ui-settings');

      (async () => {
        const onboardingState = (await uiSettingsDB.get('onboarding')) ?? {};

        if (!onboardingState.mobileCta) {
          showInfobar = true;
        }

        await uiSettingsDB.set('onboarding', { ...onboardingState, mobileCta: true });
      })();
    }
  });
</script>

<Infobar show={showInfobar} dismissible={false} --sui-infobar-message-justify-content="center">
  {$_('mobile_promo_title')}
  <Button
    variant="link"
    label={$_('mobile_promo_button')}
    onclick={() => {
      showInfobar = false;
      $showMobileSignInDialog = true;
    }}
  />
  <Button
    variant="link"
    label={$_('later')}
    onclick={() => {
      showInfobar = false;
    }}
  />
</Infobar>
