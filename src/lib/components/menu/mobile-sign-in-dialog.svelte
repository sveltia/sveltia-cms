<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog } from '@sveltia/ui';

  import { loadChunk } from '$lib/services/app/dependencies';
  import { showMobileSignInDialog } from '$lib/services/app/onboarding';
  import { user } from '$lib/services/user/account.svelte';
  import { encodeMagicLinkData } from '$lib/services/user/magic-link';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { watchAsync } from '$lib/services/utils/state.svelte';

  /** @type {HTMLCanvasElement | undefined} */
  let canvas = $state();

  // The QR code library is only loaded once the dialog is opened, as few users ever open it
  watchAsync(
    () => {
      if (!canvas || !showMobileSignInDialog.current) {
        return undefined;
      }

      const target = canvas;
      const { origin, pathname } = window.location;
      const snapshot = $state.snapshot(prefs);
      const encodedData = encodeMagicLinkData({ token: user.account?.token, prefs: snapshot });
      const url = `${origin}${pathname}#/signin/${encodedData}`;

      if (prefs.devModeEnabled) {
        // eslint-disable-next-line no-console
        console.info('Mobile sign-in URL:', url);
      }

      return loadChunk('qrcode').then(({ toCanvas }) => ({ toCanvas, target, url }));
    },
    ({ toCanvas, target, url }) => {
      toCanvas(target, url);
    },
    (error) => {
      // eslint-disable-next-line no-console
      console.error(error);
    },
  );
</script>

<Dialog
  bind:open={showMobileSignInDialog.current}
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
