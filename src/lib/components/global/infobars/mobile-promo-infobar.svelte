<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';

  import { createOneOffNotice, showMobileSignInDialog } from '$lib/services/app/onboarding';

  const notice = createOneOffNotice('mobileCta');

  $effect(() => {
    notice.showIfNeeded();
  });
</script>

<Infobar
  show={notice.show.current}
  dismissible={false}
  --sui-infobar-message-justify-content="center"
>
  {_('mobile_promo_title')}
  <Button
    variant="link"
    label={_('mobile_promo_button')}
    onclick={() => {
      showMobileSignInDialog.current = true;
      notice.hide();
    }}
  />
  <Button
    variant="link"
    label={_('later')}
    onclick={() => {
      notice.hide();
    }}
  />
</Infobar>
