<script>
  import { _, locale as appLocale, locales as availableLocales } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import { getState, setState } from '$lib/services/app/onboarding';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { prefs } from '$lib/services/user/prefs.svelte';

  let newLocale = $state('');
  let showInfobar = $state(false);

  /**
   * Show the infobar if the user has not seen it yet, the user’s browser language is different from
   * the current app locale, and the user’s browser language is available in the app.
   */
  const showInfobarIfNeeded = async () => {
    if (await getState('newLanguageCta')) {
      return;
    }

    const currentLocale = appLocale.current;
    const longLang = navigator.language;
    const [shortLang] = longLang.split('-');

    if (longLang === currentLocale || shortLang === currentLocale) {
      return;
    }

    newLocale =
      availableLocales.find((locale) => locale === longLang) ??
      availableLocales.find((locale) => locale.split('-')[0] === shortLang) ??
      '';

    if (newLocale && newLocale !== currentLocale) {
      showInfobar = true;
    }
  };

  /**
   * Hide the infobar and set the state to indicate that the user has seen it.
   */
  const hideInfobar = () => {
    showInfobar = false;
    setState('newLanguageCta', true);
  };

  $effect.pre(() => {
    untrack(() => {
      showInfobarIfNeeded();
    });
  });
</script>

<Infobar show={showInfobar} dismissible={false} --sui-infobar-message-justify-content="center">
  {_('new_language_available', {
    locale: newLocale,
    values: { locale: getLocaleLabel(newLocale, { displayLocale: newLocale }) },
  })}
  <Button
    variant="link"
    label={_('change_language', { locale: newLocale })}
    onclick={() => {
      prefs.locale = newLocale;
      hideInfobar();
    }}
  />
  <Button
    variant="link"
    label={_('later', { locale: newLocale })}
    onclick={() => {
      hideInfobar();
    }}
  />
</Infobar>
