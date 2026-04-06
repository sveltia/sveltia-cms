<script>
  import { _, locale as appLocale, locales as appLocales } from '@sveltia/i18n';
  import { Option, Select } from '@sveltia/ui';

  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { prefs } from '$lib/services/user/prefs';

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
</script>

<section>
  <h3>{_('prefs.language.ui_language.title')}</h3>
  <div role="none">
    {#key appLocale.current}
      <Select
        aria-label={_('prefs.language.ui_language.select_language')}
        value={appLocale.current}
        onChange={(event) => {
          $prefs = { ...$prefs, locale: event.detail.value };
        }}
      >
        {#each appLocales as locale (locale)}
          <Option
            label={getLocaleLabel(locale, { displayLocale: locale }) ?? locale}
            value={locale}
            selected={locale === appLocale.current}
            dir="auto"
          />
        {/each}
      </Select>
    {/key}
  </div>
</section>
