<script>
  import { Dialog } from '@sveltia/ui';
  import { toCanvas } from 'qrcode';
  import { _ } from 'svelte-i18n';

  import { showMobileSignInDialog } from '$lib/services/app/onboarding';
  import { user } from '$lib/services/user';
  import { prefs } from '$lib/services/user/prefs';

  /** @type {HTMLCanvasElement | undefined} */
  let canvas = $state();

  $effect(() => {
    if (canvas && $showMobileSignInDialog) {
      const { origin, pathname } = window.location;
      const encodedData = btoa(JSON.stringify({ token: $user?.token, prefs: $prefs }));

      toCanvas(canvas, `${origin}${pathname}#/signin/${encodedData}`);
    }
  });
</script>

<Dialog
  bind:open={$showMobileSignInDialog}
  title={$_('sign_in_with_mobile')}
  size="small"
  showOk={false}
  showCancel={false}
  showClose={true}
  style="--sui-dialog-small-content-max-height:auto"
>
  <div>{$_('sign_in_with_mobile_instruction')}</div>
  <canvas bind:this={canvas}></canvas>
</Dialog>

<style lang="scss">
  canvas {
    display: block;
    margin: 32px auto 16px;
    width: 200px !important;
    height: 200px !important;
  }
</style>
