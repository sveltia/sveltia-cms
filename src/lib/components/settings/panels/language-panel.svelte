<script>
  import { _, locale as appLocale, locales as appLocales } from '@sveltia/i18n';
  import { Alert, Option, Select, Toast } from '@sveltia/ui';

  import { appLocaleLoading } from '$lib/services/app/i18n';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { prefs } from '$lib/services/user/prefs.svelte';

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
      .map((code) => ({
        value: code,
        label: getLocaleLabel(code, { displayLocale: code }) ?? code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

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
        value={appLocale.current}
        onChange={(event) => {
          prefs.locale = event.detail.value;
        }}
      >
        {#each locales as { value, label } (value)}
          <Option {value} {label} selected={value === appLocale.current} />
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
