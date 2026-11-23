<!--
  @component
  Welcome the user to the demo once they’ve signed in, and tell them that their changes are only
  saved in the browser, not published online.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import { demoWelcomeNotice, showDemoWelcomeDialogIfNeeded } from '$lib/services/app/onboarding';

  onMount(() => {
    showDemoWelcomeDialogIfNeeded();
  });
</script>

<Dialog
  bind:open={demoWelcomeNotice.show.current}
  title={_('demo_welcome.title')}
  size="small"
  okLabel={_('demo_welcome.button_label')}
  showCancel={false}
  onClose={() => {
    // Covers the button, the Escape key and any other way out
    demoWelcomeNotice.hide();
  }}
>
  <p>{_('demo_welcome.description')}</p>
  <p>{_('demo_welcome.reset_hint')}</p>
</Dialog>

<style>
  p {
    margin: 0;

    &:not(:first-child) {
      margin-top: 1em;
    }
  }
</style>
