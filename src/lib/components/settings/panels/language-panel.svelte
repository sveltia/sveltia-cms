<script>
  import { Option, Select } from '@sveltia/ui';
  import { _, locale as appLocale, locales as appLocales } from 'svelte-i18n';

  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();
</script>

<section>
  <h4>{$_('prefs.language.ui_language.title')}</h4>
  <div role="none">
    {#key $appLocale}
      <Select
        aria-label={$_('prefs.language.ui_language.select_language')}
        value={$appLocale ?? undefined}
        onChange={(event) => {
          $prefs = { ...$prefs, locale: event.detail.value };
        }}
      >
        {#each $appLocales as locale}
          <Option
            label={getLocaleLabel(locale, { displayLocale: locale }) ?? locale}
            value={locale}
            selected={locale === $appLocale}
            dir="auto"
          />
        {/each}
      </Select>
    {/key}
  </div>
</section>
