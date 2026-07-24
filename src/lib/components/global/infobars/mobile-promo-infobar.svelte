<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';

  import { getState, setState, showMobileSignInDialog } from '$lib/services/app/onboarding';

  let showInfobar = $state(false);

  /**
   * Show the infobar if the user has not seen it yet.
   */
  const showInfobarIfNeeded = async () => {
    showInfobar = !(await getState('mobileCta'));
  };

  /**
   * Hide the infobar and set the state to indicate that the user has seen it.
   */
  const hideInfobar = () => {
    showInfobar = false;
    setState('mobileCta', true);
  };

  $effect(() => {
    showInfobarIfNeeded();
  });
</script>

<Infobar show={showInfobar} dismissible={false} --sui-infobar-message-justify-content="center">
  {_('mobile_promo_title')}
  <Button
    variant="link"
    label={_('mobile_promo_button')}
    onclick={() => {
      $showMobileSignInDialog = true;
      hideInfobar();
    }}
  />
  <Button
    variant="link"
    label={_('later')}
    onclick={() => {
      hideInfobar();
    }}
  />
</Infobar>
