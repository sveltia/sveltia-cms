<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog } from '@sveltia/ui';
  import { toCanvas } from 'qrcode';

  import { showMobileSignInDialog } from '$lib/services/app/onboarding';
  import { user } from '$lib/services/user/account.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /** @type {HTMLCanvasElement | undefined} */
  let canvas = $state();

  $effect(() => {
    if (canvas && $showMobileSignInDialog) {
      const { origin, pathname } = window.location;
      const snapshot = $state.snapshot(prefs);
      const encodedData = btoa(JSON.stringify({ token: user.account?.token, prefs: snapshot }));
      const url = `${origin}${pathname}#/signin/${encodedData}`;

      toCanvas(canvas, url);

      if (prefs.devModeEnabled) {
        // eslint-disable-next-line no-console
        console.info('Mobile sign-in URL:', url);
      }
    }
  });
</script>

<Dialog
  bind:open={$showMobileSignInDialog}
  title={_('sign_in_with_mobile')}
  size="small"
  showOk={false}
  showCancel={false}
  showClose={true}
  style="--sui-dialog-small-content-max-height:auto"
>
  <div>{_('sign_in_with_mobile_instruction')}</div>
  <canvas bind:this={canvas}></canvas>
</Dialog>

<style>
  canvas {
    display: block;
    margin: 32px auto 16px;
    width: 200px !important;
    height: 200px !important;
  }
</style>
