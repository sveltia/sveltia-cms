<script>
  import { _, locale as appLocale, locales as appLocales } from '@sveltia/i18n';
  import { Alert, Divider, Option, Select, Toast } from '@sveltia/ui';

  import { appLocaleLoading } from '$lib/services/app/i18n';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { AUTO_APP_LOCALE, prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @import { SettingsPanelOnChangeArgs } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();

  /**
   * Locale list sorted by label.
   */
  const locales = $derived(
    appLocales
      .map((code) => {
        const localizedLabel = getLocaleLabel(code, { displayLocale: appLocale.current }) ?? code;
        const nativeLabel = getLocaleLabel(code, { displayLocale: code }) ?? code;

        const label =
          localizedLabel === nativeLabel ? localizedLabel : `${localizedLabel} — ${nativeLabel}`;

        return {
          value: code,
          searchValue: `${label} (${code})`,
          label,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  /**
   * Selected language preference, which is {@link AUTO_APP_LOCALE} rather than a locale code while
   * the UI follows the browser’s language settings.
   */
  const selectedLocale = $derived(prefs.locale ?? AUTO_APP_LOCALE);

  /**
   * Locale being switched to. Unlike `$appLocaleLoading`, this keeps the last value, so the message
   * doesn’t disappear while the toast is fading out.
   */
  let switchingLocale = $state('');

  $effect(() => {
    if ($appLocaleLoading) {
      switchingLocale = $appLocaleLoading;
    }
  });
</script>

<section>
  <h3>{_('prefs.language.ui_language.title')}</h3>
  <div role="none">
    {#key appLocale.current}
      <Select
        aria-label={_('prefs.language.ui_language.select_language')}
        value={selectedLocale}
        onChange={(event) => {
          prefs.locale = event.detail.value;
        }}
      >
        <Option
          value={AUTO_APP_LOCALE}
          label={_('automatic')}
          selected={selectedLocale === AUTO_APP_LOCALE}
        />
        <Divider />
        {#each locales as { value, searchValue, label } (value)}
          <Option {value} {searchValue} {label} selected={value === selectedLocale} />
        {/each}
      </Select>
    {/key}
  </div>
</section>

<!-- Hidden automatically once the strings are loaded, hence `duration={0}` -->
<Toast show={!!$appLocaleLoading} duration={0}>
  <Alert status="info">
    {#if switchingLocale}
      {_('switching_language', {
        values: { locale: getLocaleLabel(switchingLocale) ?? switchingLocale },
      })}
    {/if}
  </Alert>
</Toast>
