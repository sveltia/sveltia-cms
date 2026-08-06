<!--
  @component
  Notify the user that the strings for the selected language couldn’t be downloaded from the CDN,
  and that the UI is displayed in the default locale instead.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import { appLocaleLoadError } from '$lib/services/app/i18n';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  let showToast = $state(false);

  $effect(() => {
    if ($appLocaleLoadError) {
      showToast = true;
    }
  });
</script>

{#if $appLocaleLoadError}
  {@const { locale } = $appLocaleLoadError}
  <Toast bind:show={showToast}>
    <Alert status="error">
      {_('locale_load_failed', { values: { locale: getLocaleLabel(locale) ?? locale } })}
    </Alert>
  </Toast>
{/if}
