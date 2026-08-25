<script>
  import { _, locale as appLocale, locales as availableLocales } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import { getState, setState } from '$lib/services/app/onboarding';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { AUTO_PREF_VALUE, prefs } from '$lib/services/user/prefs.svelte';

  let newLocale = $state('');
  let showInfobar = $state(false);
  /** Whether the check below has already been made, so it’s not repeated on a preference change. */
  let checked = false;

  /**
   * Show the infobar if the user has not seen it yet, the user’s browser language is different from
   * the current app locale, and the user’s browser language is available in the app. Only relevant
   * when the user has explicitly picked a language; see the effect below.
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

  $effect(() => {
    const { locale } = prefs;

    untrack(() => {
      // Wait for the preferences to be loaded. The infobar is pointless while the language
      // preference is `auto`, because the UI already follows the browser’s language settings
      if (checked || !locale || locale === AUTO_PREF_VALUE) {
        return;
      }

      checked = true;
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
